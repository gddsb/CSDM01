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
 *
 * 含样本量后端强制截断：need_sample_count > 20 时自动截断到 20，
 * Ac/Re 同步调整（AQL抽样用 n=20 行值，其他保留原 Ac/Re）
 */
const MAX_SAMPLE_COUNT = 20

/** n=20 时 AQL 表的 Ac/Re（检验水平Ⅱ，批量 151-280） */
const AQL_N20: Record<number, { Ac: number; Re: number }> = {
  0.65: { Ac: 0, Re: 1 },
  1.0:  { Ac: 0, Re: 1 },
  2.5:  { Ac: 1, Re: 2 },
  4.0:  { Ac: 1, Re: 2 },
  6.5:  { Ac: 3, Re: 4 },
}

/** 截断 need_sample_count 到上限以内 */
function capNeedSampleCount(item: any): any {
  const nsc = Number(item.need_sample_count) || 0
  if (nsc <= MAX_SAMPLE_COUNT) return item

  const capped = { ...item, need_sample_count: MAX_SAMPLE_COUNT }

  // AQL抽样：用 n=20 行的 Ac/Re 替换
  if (item.sampling_plan === 'AQL抽样' && item.sampling_detail) {
    try {
      const detail = typeof item.sampling_detail === 'string'
        ? JSON.parse(item.sampling_detail)
        : item.sampling_detail
      const aqlVal = Number(detail?.aql_value) || 2.5
      const n20 = AQL_N20[aqlVal] || AQL_N20[2.5]
      capped.accept_number = n20.Ac
      capped.reject_number = n20.Re
      // 更新 sampling_detail JSON
      const newDetail = { ...detail, sample_size: MAX_SAMPLE_COUNT, accept_number: n20.Ac, reject_number: n20.Re }
      capped.sampling_detail = typeof item.sampling_detail === 'string' ? JSON.stringify(newDetail) : newDetail
    } catch {
      capped.accept_number = 0
      capped.reject_number = 2
    }
  }

  // 全检：Ac=19, Re=20
  if (item.sampling_plan === '全检') {
    capped.accept_number = MAX_SAMPLE_COUNT - 1
    capped.reject_number = MAX_SAMPLE_COUNT
  }

  return capped
}

export function buildQcItemData(
  sourceType: SourceType,
  inspectionId: number,
  items: any[],
  user: { userId?: number; realName?: string; username?: string } = {},
): any[] {
  if (!items || items.length === 0) return []
  return items.map((item, idx) => {
    const capped = capNeedSampleCount(item)
    return {
      source_type: sourceType,
      inspection_id: inspectionId,
      item_cfg_id: capped.item_cfg_id || null,
      item_name: capped.item_name,
      category: capped.category || null,
      standard_value: capped.standard_value || null,
      actual_value_text: capped.actual_value || null,
      sample_count: capped.sample_count ?? null,
      summary: capped.summary || null,
      result: convertItemResult(capped.result),
      inspector_id: capped.inspector_id ?? user.userId ?? null,
      inspector_name: capped.inspector_name || user.realName || user.username || null,
      inspection_time: capped.inspection_time ? new Date(capped.inspection_time) : null,
      unit: capped.unit || null,
      // 阶段回填：从检验标准 / 前端 payload 持久化配置字段
      item_type: capped.item_type || null,
      need_sample_count: capped.need_sample_count ?? 0,
      upper_limit: capped.upper_limit ?? null,
      lower_limit: capped.lower_limit ?? null,
      sampling_plan: capped.sampling_plan || 'AQL抽样',
      sampling_detail: capped.sampling_detail ? (typeof capped.sampling_detail === 'string' ? capped.sampling_detail : JSON.stringify(capped.sampling_detail)) : null,
      accept_number: capped.accept_number ?? null,
      reject_number: capped.reject_number ?? null,
      sort_order: capped.sort_order !== undefined ? capped.sort_order : idx,
      remarks: capped.remarks || null,
    }
  })
}

/**
 * 替换式写入新子表（旧子表停止写入）
 *
 * 核心策略：按 item_id 做 upsert，保证 item_id 稳定不变，
 * 前端后续调用 /inspection-items/:item_id/sample-values 不会报 "检验项不存在"。
 *
 * - 前端 item 带 item_id 且 DB 存在 → UPDATE
 * - 前端 item 带 item_id 但 DB 不存在 → CREATE（保留指定 item_id）
 * - 前端 item 不带 item_id → CREATE（自增）
 * - DB 中存在但前端已删除的 item → DELETE（级联清理 sample_values）
 *
 * 注意：QcInspectionItem.hasMany(sample_values) 配置了 onDelete: CASCADE，
 * 删除 item 会自动级联清理 sample_value。
 */
export async function replaceQcItems(
  sourceType: SourceType,
  inspectionId: number,
  items: any[],
  t?: Transaction,
): Promise<void> {
  // 1) 先查询当前 DB 中已有的 item_ids，用于判断是 update 还是 create
  const existingRows = await QcInspectionItem.findAll({
    where: { source_type: sourceType, inspection_id: inspectionId },
    attributes: ['item_id'],
    transaction: t,
  })
  const existingIds = new Set(existingRows.map((r: any) => Number(r.item_id)))

  if (!items || items.length === 0) {
    // 没有要写的 → 直接清空
    await QcInspectionItem.destroy({
      where: { source_type: sourceType, inspection_id: inspectionId },
      transaction: t,
    })
    return
  }

  // 2) 分拆：带 item_id（数值有效）的 vs 不带的
  const withId: any[] = []
  const withoutId: any[] = []
  for (const item of items) {
    if (item && item.item_id !== undefined && item.item_id !== null && !isNaN(Number(item.item_id))) {
      withId.push(item)
    } else if (item) {
      withoutId.push(item)
    }
  }

  // 3) 处理带 item_id 的项：已存在则 UPDATE，不存在则 CREATE（保留 item_id）
  const incomingIds = new Set<number>()
  if (withId.length > 0) {
    for (const item of withId) {
      const id = Number(item.item_id)
      incomingIds.add(id)
      const data = buildQcItemData(sourceType, inspectionId, [item])[0] || {}
      if (existingIds.has(id)) {
        // UPDATE：已存在
        await QcInspectionItem.update(data, {
          where: { item_id: id },
          transaction: t,
        })
      } else {
        // CREATE：不存在（如创建流程带了 item_id，或旧数据被清理）
        await QcInspectionItem.create(
          { item_id: id, ...data },
          { transaction: t },
        )
      }
    }
  }

  // 4) 处理不带 item_id 的项：bulkCreate（自增）
  if (withoutId.length > 0) {
    const newRows = buildQcItemData(sourceType, inspectionId, withoutId)
    const created = await QcInspectionItem.bulkCreate(newRows, { transaction: t })
    for (const c of created) {
      incomingIds.add(Number((c as any).item_id))
    }
  }

  // 5) 清理：DB 中存在但前端不再提交的 item（已被用户删除的项）
  //    同时保留 incomingIds 中的项（包括 step 3 的 withId 和 step 4 新建的）
  if (incomingIds.size > 0) {
    await QcInspectionItem.destroy({
      where: {
        source_type: sourceType,
        inspection_id: inspectionId,
        item_id: { [Op.notIn]: Array.from(incomingIds) },
      },
      transaction: t,
    })
  } else {
    // 极端情况：所有 item 都被删了 → 清空
    await QcInspectionItem.destroy({
      where: { source_type: sourceType, inspection_id: inspectionId },
      transaction: t,
    })
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
