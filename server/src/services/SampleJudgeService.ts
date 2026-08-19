/**
 * 检验数据统一存储改造（阶段3.2）
 * 样品测量值自动判定 service
 *
 * 职责：
 * - 单值判定：measure_value_num 按配置的 nominal_value/upper_limit/lower_limit 判 is_qualified
 *   定性值（measure_value_text）：OK/合格→1，NG/不合格/无→0；其他文本不自动判定保留 null
 * - 项目汇总：取该项目所有 sample_value 的 is_qualified 聚合
 *   - 任一 0 → item.result = 0
 *   - 全部 1 → item.result = 1
 *   - 全部 null（无 sample_value 或无 is_qualified） → 保留原 item.result 不变
 * - 主表汇总：根据该主表所有 item.result 聚合
 *   - 任一 0 → inspection.result = '不合格'
 *   - 全部 1 → inspection.result = '合格'
 *
 * 用法：被 SampleValueController 在 create/update/delete 后调用
 */
import QcInspectionItem from '../models/QcInspectionItem.js'
import QcInspectionSampleValue from '../models/QcInspectionSampleValue.js'
import InspectionStandardItem from '../models/InspectionStandardItem.js'
import { logger } from '../utils/logger.js'

/** 单个 sample_value 的判定（不写库，仅返回 0/1/null） */
export function judgeSampleValue(sample: {
  measure_value_num?: number | null
  measure_value_text?: string | null
}, cfg: {
  nominal_value?: number | null
  upper_limit?: number | null
  lower_limit?: number | null
}): number | null {
  // 1. 定性值优先判（measure_value_text 非空）
  const text = (sample.measure_value_text || '').trim()
  if (text) {
    const lower = text.toLowerCase()
    if (['ok', '合格', 'pass'].includes(lower) || text === 'OK') return 1
    if (['ng', '不合格', 'fail', '无'].some(kw => text.includes(kw))) return 0
    // 其他描述文本不自动判定
    return null
  }

  // 2. 定量值按配置上下限判定
  const num = sample.measure_value_num
  if (num === null || num === undefined || Number.isNaN(Number(num))) return null

  const n = Number(num)
  // 优先用上下限，其次用标称值（默认 ±0，即必须严格等于）
  const { upper_limit, lower_limit, nominal_value } = cfg
  if (upper_limit !== null && upper_limit !== undefined && n > Number(upper_limit)) return 0
  if (lower_limit !== null && lower_limit !== undefined && n < Number(lower_limit)) return 0
  // 仅有 nominal_value 且无上下限时，严格等于（容差 0）
  if ((upper_limit === null || upper_limit === undefined) &&
      (lower_limit === null || lower_limit === undefined) &&
      nominal_value !== null && nominal_value !== undefined &&
      Math.abs(n - Number(nominal_value)) > 1e-9) {
    return 0
  }
  return 1
}

/**
 * 取某 item_cfg 的判定配置（nominal/upper/lower）
 * 优先用 item_cfg_id 关联查询；没有时尝试从 item.summary 解析（旧数据无 cfg 时不强求）
 */
async function loadItemCfg(item: { item_cfg_id?: number | null; item_id: number }) {
  if (!item.item_cfg_id) return null
  try {
    const cfg = await InspectionStandardItem.findOne({
      where: { item_id: item.item_cfg_id },
      raw: true,
      attributes: ['item_type', 'nominal_value', 'upper_limit', 'lower_limit'],
    })
    return cfg
  } catch (err: any) {
    logger.warn(`[SampleJudge] loadItemCfg item_id=${item.item_id} cfg_id=${item.item_cfg_id} 失败:`, err.message)
    return null
  }
}

/**
 * 重算并更新某 qc_item 的所有 sample_value.is_qualified
 * 同时更新 qc_item.result
 * @returns 新的 item.result（0/1/null）
 */
export async function recalcItemAndSamples(itemId: number): Promise<number | null> {
  const item = await QcInspectionItem.findOne({
    where: { item_id: itemId },
    raw: true,
    attributes: ['item_id', 'item_cfg_id', 'result'],
  })
  if (!item) return null

  const samples = await QcInspectionSampleValue.findAll({
    where: { item_id: itemId },
    order: [['sample_no', 'ASC'], ['dimension_code', 'ASC']],
  })
  if (samples.length === 0) {
    // 无 sample_value，保留原 item.result
    return item.result
  }

  const cfg = await loadItemCfg({ item_cfg_id: item.item_cfg_id, item_id: itemId })

  // 更新每个 sample 的 is_qualified
  let allNull = true
  let anyFail = false
  for (const s of samples) {
    const judged = judgeSampleValue(
      {
        measure_value_num: s.get('measure_value_num') as number | null,
        measure_value_text: s.get('measure_value_text') as string | null,
      },
      {
        nominal_value: cfg?.nominal_value ?? null,
        upper_limit: cfg?.upper_limit ?? null,
        lower_limit: cfg?.lower_limit ?? null,
      },
    )
    if (judged !== null) {
      allNull = false
      if (judged === 0) anyFail = true
    }
    if (s.get('is_qualified') !== judged) {
      await s.update({ is_qualified: judged })
    }
  }

  // 汇总 item.result
  const newItemResult = allNull ? item.result : (anyFail ? 0 : 1)
  if (newItemResult !== item.result) {
    await QcInspectionItem.update(
      { result: newItemResult },
      { where: { item_id: itemId } },
    )
  }
  return newItemResult
}

/**
 * 重算某主表下所有 qc_item 的 sample_value 和 result，并汇总主表 result
 * @param sourceType '来料'|'产品'|'微生物'
 * @param inspectionId 主表 inspection_id
 * @param mainModel 主表模型（用于更新主表 result）
 * @returns 主表新的 result 字符串 '合格'|'不合格'|null
 */
export async function recalcInspection(
  sourceType: '来料' | '产品' | '微生物',
  inspectionId: number,
  mainModel: any,
): Promise<string | null> {
  const items = await QcInspectionItem.findAll({
    where: { source_type: sourceType, inspection_id: inspectionId },
    attributes: ['item_id'],
    raw: true,
  })

  let anyFail = false
  let allNull = true
  for (const it of items) {
    const r = await recalcItemAndSamples(it.item_id)
    if (r !== null) {
      allNull = false
      if (r === 0) anyFail = true
    }
  }

  const newResult = allNull ? null : (anyFail ? '不合格' : '合格')
  if (mainModel) {
    await mainModel.update(
      { result: newResult },
      { where: { inspection_id: inspectionId } },
    )
  }
  return newResult
}
