/**
 * 检验数据统一存储改造（阶段1.7）双写辅助
 *
 * 在三 controller 的 create/update 写入旧子表后，同步写入新统一子表 qc_inspection_item
 * - 不处理 sample_value（新数据录入时由前端组件 + 阶段3 SampleValueController 处理）
 * - 双写失败仅记录日志，不阻断主流程，避免影响生产
 * - 旧字段 actual_value 映射到新表 actual_value_text 保持兼容
 */
import type { Transaction } from 'sequelize'
import QcInspectionItem from '../models/QcInspectionItem.js'
import { logger } from '../utils/logger.js'

type SourceType = '来料' | '产品' | '微生物'

interface SyncItemInput {
  inspection_id: number
  item_name: string
  category?: string
  standard_value?: string
  actual_value?: string
  result?: number
  inspector_id?: number | null
  inspector_name?: string
  inspection_time?: string | Date | null
  unit?: string
  sort_order?: number
  remarks?: string
  item_cfg_id?: number | null
}

/**
 * 双写统一检验子表（事务内调用，与旧子表写入同一事务）
 *
 * @param sourceType 来源类型
 * @param inspectionId 主表 inspection_id
 * @param items 同写入旧子表的 items 数组
 * @param t 事务
 */
export async function syncQcItems(
  sourceType: SourceType,
  inspectionId: number,
  items: SyncItemInput[],
  t?: Transaction,
): Promise<void> {
  if (!items || items.length === 0) return
  try {
    const qcItemData = items.map((item, idx) => ({
      source_type: sourceType,
      inspection_id: inspectionId,
      item_cfg_id: item.item_cfg_id || null,
      item_name: item.item_name,
      category: item.category || null,
      standard_value: item.standard_value || null,
      actual_value_text: item.actual_value || null,
      sample_count: null, // 阶段1不填，由前端录入时计算
      summary: null,
      result: item.result,
      inspector_id: item.inspector_id || null,
      inspector_name: item.inspector_name || null,
      inspection_time: item.inspection_time ? new Date(item.inspection_time) : null,
      unit: item.unit || null,
      sort_order: item.sort_order !== undefined ? item.sort_order : idx,
      remarks: item.remarks || null,
    }))
    await QcInspectionItem.bulkCreate(qcItemData, { transaction: t })
  } catch (err: any) {
    // 双写失败仅记录日志，不阻断主流程（旧子表写入仍生效）
    logger.error(`[QcItemSync] ${sourceType} inspection_id=${inspectionId} 双写失败:`, err.message)
  }
}

/**
 * 同步删除统一子表（主表删除时调用，级联清理 qc_items + sample_values）
 * sample_values 通过外键 ON DELETE CASCADE 自动清理
 */
export async function deleteQcItems(
  sourceType: SourceType,
  inspectionId: number,
  t?: Transaction,
): Promise<void> {
  try {
    await QcInspectionItem.destroy({
      where: { source_type: sourceType, inspection_id: inspectionId },
      transaction: t,
    })
  } catch (err: any) {
    logger.error(`[QcItemSync] ${sourceType} inspection_id=${inspectionId} 删除失败:`, err.message)
  }
}
