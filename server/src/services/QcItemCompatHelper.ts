/**
 * 检验数据统一存储改造（阶段3.3-3.5）
 * 三 controller 共用 helper：旧子表 → 新统一子表，前端无感切换
 *
 * 职责：
 * - getDetail 切流量：include 从旧子表 IncomingInspectionItem/ProductInspectionItem/MicrobeInspectionItem
 *   改为新统一子表 QcInspectionItem（as: 'qc_items'），并级联 include sample_values
 * - 字段映射兼容前端：
 *   - qc_item.actual_value_text → 前端字段 actual_value
 *   - qc_item.result (TINYINT 0/1) → 前端字符串 '合格'/'不合格'（与旧子表 getter 一致）
 *   - 把 qc_items 重命名为 items（前端用 detail.items）
 *   - 附加 sample_values 字段（阶段4 前端组件会用）
 * - 关闭双写：create/update 直接写 QcInspectionItem，不再调 syncQcItems
 *   - 提供 buildQcItemData() 把前端 item payload 转为 QcInspectionItem.bulkCreate 格式
 */
import QcInspectionItem from '../models/QcInspectionItem.js'
import QcInspectionSampleValue from '../models/QcInspectionSampleValue.js'
import { Op, type Transaction } from 'sequelize'

export type SourceType = '来料' | '产品' | '微生物'

const RESULT_TO_STR: Record<number, string> = { 0: '不合格', 1: '合格' }
const RESULT_FROM_STR: Record<string, number> = { '合格': 1, '不合格': 0 }

/** 前端 result 字符串转 TINYINT（兼容 null/数字输入） */
export function convertItemResult(v: any): number | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    if (RESULT_FROM_STR[v] !== undefined) return RESULT_FROM_STR[v]
    const n = Number(v)
    if (!Number.isNaN(n)) return n
    return null
  }
  return Number(v)
}

/** TINYINT 0/1 → 前端字符串 '合格'/'不合格'（与旧子表 getter 一致） */
export function resultToStr(v: any): string | any {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return RESULT_TO_STR[v] ?? v
  return v
}

/**
 * 把前端 items payload 转为 QcInspectionItem.bulkCreate 格式
 * 用在 create/update 中替代旧子表 bulkCreate + syncQcItems
 */
export function buildQcItemData(
  sourceType: SourceType,
  inspectionId: number,
  items: any[],
  user: { userId?: number; realName?: string; username?: string } = {},
): any[] {
  if (!items || items.length === 0) return []
  return items.map((item, idx) => ({
    source_type: sourceType,
    inspection_id: inspectionId,
    item_cfg_id: item.item_cfg_id || null,
    item_name: item.item_name,
    category: item.category || null,
    standard_value: item.standard_value || null,
    actual_value_text: item.actual_value || null,
    sample_count: item.sample_count ?? null,
    summary: item.summary || null,
    result: convertItemResult(item.result),
    inspector_id: item.inspector_id ?? user.userId ?? null,
    inspector_name: item.inspector_name || user.realName || user.username || null,
    inspection_time: item.inspection_time ? new Date(item.inspection_time) : null,
    unit: item.unit || null,
    // 阶段回填：从检验标准 / 前端 payload 持久化配置字段
    item_type: item.item_type || null,
    need_sample_count: item.need_sample_count ?? 0,
    upper_limit: item.upper_limit ?? null,
    lower_limit: item.lower_limit ?? null,
    sampling_plan: item.sampling_plan || 'AQL抽样',
    sampling_detail: item.sampling_detail ? (typeof item.sampling_detail === 'string' ? item.sampling_detail : JSON.stringify(item.sampling_detail)) : null,
    accept_number: item.accept_number ?? null,
    reject_number: item.reject_number ?? null,
    sort_order: item.sort_order !== undefined ? item.sort_order : idx,
    remarks: item.remarks || null,
  }))
}

/**
 * 替换式写入新子表（旧子表停止写入）
 * - 策略：若前端 item 带 item_id，走 upsert（按 (source_type, inspection_id, item_id) 保留），
 *   这样 item_id 稳定不变，前端后续调用 /inspection-items/:item_id/sample-values 不会 "检验项不存在"。
 * - 不带 item_id 的旧 item（前端首次新建/纯标准引用项）走 delete+bulkCreate。
 * - QcInspectionItem.hasMany(sample_values) 配置了 onDelete: CASCADE，删除 item 会自动级联清理 sample_value。
 */
export async function replaceQcItems(
  sourceType: SourceType,
  inspectionId: number,
  items: any[],
  t?: Transaction,
): Promise<void> {
  if (!items || items.length === 0) {
    // 没有要写的 → 直接清空
    await QcInspectionItem.destroy({
      where: { source_type: sourceType, inspection_id: inspectionId },
      transaction: t,
    })
    return
  }

  const withId = items.filter(i => i && i.item_id && !isNaN(Number(i.item_id)))
  const withoutId = items.filter(i => i && !(i.item_id && !isNaN(Number(i.item_id))))

  // 1) 先处理带 item_id 的项：upsert（update 而不是 delete+create）
  if (withId.length > 0) {
    for (const item of withId) {
      const id = Number(item.item_id)
      const data = buildQcItemData(sourceType, inspectionId, [item])[0] || {}
      delete data.item_id  // 不写入 ID 字段
      // 兼容 create/update 字段：若前端传了 sample_values，保留不被覆盖（sample_values 作为子表独立管理）
      await QcInspectionItem.update(data, {
        where: {
          source_type: sourceType,
          inspection_id: inspectionId,
          item_id: id,
        },
        transaction: t,
      })
    }
  }

  // 2) 处理不带 item_id 的项：全部先删除再创建（保留已在 withId 中的那些 item_id）
  if (withoutId.length > 0) {
    // 先删除本 inspection 下已被替换的旧项（不保留的 item_id 全部清掉）
    const keepIds = new Set(withId.map(i => Number(i.item_id)))
    if (keepIds.size === 0) {
      await QcInspectionItem.destroy({
        where: { source_type: sourceType, inspection_id: inspectionId },
        transaction: t,
      })
    } else {
      await QcInspectionItem.destroy({
        where: {
          source_type: sourceType,
          inspection_id: inspectionId,
          item_id: { [Op.notIn]: Array.from(keepIds) },
        },
        transaction: t,
      })
    }
    await QcInspectionItem.bulkCreate(
      buildQcItemData(sourceType, inspectionId, withoutId),
      { transaction: t },
    )
  } else {
    // 没有不带 id 的项 → 只清掉已被删除的旧项（不在 items 里的）
    const keepIds = new Set(withId.map(i => Number(i.item_id)))
    if (keepIds.size > 0) {
      await QcInspectionItem.destroy({
        where: {
          source_type: sourceType,
          inspection_id: inspectionId,
          item_id: { [Op.notIn]: Array.from(keepIds) },
        },
        transaction: t,
      })
    }
  }
}

/**
 * 把 QcInspectionItem 实例数组转为前端兼容的 items 格式
 * - 字段名映射 actual_value_text → actual_value
 * - result 转字符串 '合格'/'不合格'
 * - 附加 sample_values（已 include 进来的）
 */
export function mapQcItemsToFrontend(qcItems: any[]): any[] {
  if (!qcItems) return []
  return qcItems.map((qi: any) => {
    const raw = qi && typeof qi.toJSON === 'function' ? qi.toJSON() : qi
    return {
      item_id: raw.item_id,
      inspection_id: raw.inspection_id,
      item_cfg_id: raw.item_cfg_id,
      item_name: raw.item_name,
      category: raw.category,
      standard_value: raw.standard_value,
      // 兼容前端 actual_value 字段名
      actual_value: raw.actual_value_text,
      sample_count: raw.sample_count,
      summary: raw.summary,
      result: resultToStr(raw.result),
      inspector_id: raw.inspector_id,
      inspector_name: raw.inspector_name,
      inspection_time: raw.inspection_time,
      unit: raw.unit,
      // 阶段回填：暴露配置字段给前端 InspectionItemEditor
      item_type: raw.item_type ?? null,
      need_sample_count: raw.need_sample_count ?? null,
      upper_limit: raw.upper_limit ?? null,
      lower_limit: raw.lower_limit ?? null,
      sampling_plan: raw.sampling_plan ?? null,
      sampling_detail: raw.sampling_detail ?? null,
      accept_number: raw.accept_number ?? null,
      reject_number: raw.reject_number ?? null,
      sort_order: raw.sort_order,
      remarks: raw.remarks,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      // 阶段4 前端组件会用 sample_values
      sample_values: raw.sample_values || [],
    }
  })
}

/**
 * 删除某检验单的所有 qc_item + sample_value（按 source_type）
 * - 主表删除时调用，替代旧 deleteQcItems
 * - 由于 sample_values 是 onDelete: CASCADE，删除 QcInspectionItem 会级联清理
 */
export async function deleteQcItemsForSource(
  sourceType: SourceType,
  inspectionId: number,
  t?: Transaction,
): Promise<void> {
  await QcInspectionItem.destroy({
    where: { source_type: sourceType, inspection_id: inspectionId },
    transaction: t,
  })
}
