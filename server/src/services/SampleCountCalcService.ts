/**
 * 样品量自动计算服务（v2 - 基于新抽样方案）
 * 支持 AQL抽样、按数量抽样、固定数量抽样、全检
 * 基于 GB/T 2828.1 检验水平Ⅱ
 */

// ============================================================
// AQL 抽样表（检验水平Ⅱ，扩展至 50 万）
// ============================================================
interface AQLRow {
  min_qty: number
  max_qty: number
  n: number  // 样本量
  data: Record<string, { Ac: number; Re: number }>
}

const AQL_TABLE: AQLRow[] = [
  { min_qty: 1, max_qty: 8,      n: 2,   data: { '0.65': {Ac:0,Re:1}, '1.0': {Ac:0,Re:1}, '2.5': {Ac:0,Re:1}, '4.0': {Ac:0,Re:1}, '6.5': {Ac:0,Re:1} } },
  { min_qty: 9, max_qty: 15,     n: 3,   data: { '0.65': {Ac:0,Re:1}, '1.0': {Ac:0,Re:1}, '2.5': {Ac:0,Re:1}, '4.0': {Ac:0,Re:1}, '6.5': {Ac:0,Re:1} } },
  { min_qty: 16, max_qty: 25,    n: 5,   data: { '0.65': {Ac:0,Re:1}, '1.0': {Ac:0,Re:1}, '2.5': {Ac:0,Re:1}, '4.0': {Ac:0,Re:1}, '6.5': {Ac:0,Re:1} } },
  { min_qty: 26, max_qty: 50,    n: 8,   data: { '0.65': {Ac:0,Re:1}, '1.0': {Ac:0,Re:1}, '2.5': {Ac:0,Re:1}, '4.0': {Ac:1,Re:2}, '6.5': {Ac:1,Re:2} } },
  { min_qty: 51, max_qty: 90,    n: 13,  data: { '0.65': {Ac:0,Re:1}, '1.0': {Ac:0,Re:1}, '2.5': {Ac:0,Re:1}, '4.0': {Ac:1,Re:2}, '6.5': {Ac:1,Re:2} } },
  { min_qty: 91, max_qty: 150,   n: 13,  data: { '0.65': {Ac:0,Re:1}, '1.0': {Ac:0,Re:1}, '2.5': {Ac:0,Re:1}, '4.0': {Ac:1,Re:2}, '6.5': {Ac:2,Re:3} } },
  { min_qty: 151, max_qty: 280,  n: 20,  data: { '0.65': {Ac:0,Re:1}, '1.0': {Ac:0,Re:1}, '2.5': {Ac:1,Re:2}, '4.0': {Ac:1,Re:2}, '6.5': {Ac:3,Re:4} } },
  { min_qty: 281, max_qty: 500,  n: 32,  data: { '0.65': {Ac:0,Re:1}, '1.0': {Ac:1,Re:2}, '2.5': {Ac:1,Re:2}, '4.0': {Ac:2,Re:3}, '6.5': {Ac:4,Re:5} } },
  { min_qty: 501, max_qty: 1200, n: 50,  data: { '0.65': {Ac:1,Re:2}, '1.0': {Ac:1,Re:2}, '2.5': {Ac:2,Re:3}, '4.0': {Ac:3,Re:4}, '6.5': {Ac:6,Re:7} } },
  { min_qty: 1201, max_qty: 3200, n: 80, data: { '0.65': {Ac:1,Re:2}, '1.0': {Ac:2,Re:3}, '2.5': {Ac:3,Re:4}, '4.0': {Ac:5,Re:6}, '6.5': {Ac:9,Re:10} } },
  { min_qty: 3201, max_qty: 10000, n: 125, data: { '0.65': {Ac:2,Re:3}, '1.0': {Ac:3,Re:4}, '2.5': {Ac:5,Re:6}, '4.0': {Ac:7,Re:8}, '6.5': {Ac:14,Re:15} } },
  { min_qty: 10001, max_qty: 35000, n: 200, data: { '0.65': {Ac:3,Re:4}, '1.0': {Ac:5,Re:6}, '2.5': {Ac:7,Re:8}, '4.0': {Ac:10,Re:11}, '6.5': {Ac:21,Re:22} } },
  { min_qty: 35001, max_qty: 150000, n: 315, data: { '0.65': {Ac:5,Re:6}, '1.0': {Ac:7,Re:8}, '2.5': {Ac:11,Re:12}, '4.0': {Ac:16,Re:17}, '6.5': {Ac:32,Re:33} } },
  { min_qty: 150001, max_qty: 500000, n: 500, data: { '0.65': {Ac:7,Re:8}, '1.0': {Ac:10,Re:11}, '2.5': {Ac:16,Re:17}, '4.0': {Ac:24,Re:25}, '6.5': {Ac:50,Re:51} } },
]

export const AQL_VALUES = [0.65, 1.0, 2.5, 4.0, 6.5]

/** 样本量上限：超过此值的样本量自动截断（含 Ac/Re 同步调整） */
export const MAX_SAMPLE_COUNT = 20

// ============================================================
// 类型定义
// ============================================================
export type SamplingPlan = 'AQL抽样' | '按数量抽样' | '固定数量抽样' | '全检'

export interface SegmentConfig {
  max_qty: number
  sample_count: number
  accept_number: number
  reject_number: number
}

export interface FixedCountConfig {
  fixed_count: number
  accept_number: number
  reject_number: number
}

export interface AQLConfig {
  aql_value: number
  inspection_level: string
  sample_size: number
  accept_number: number
  reject_number: number
}

export interface SamplingDetail {
  // AQL抽样
  aql_value?: number
  inspection_level?: string
  sample_size?: number
  accept_number?: number
  reject_number?: number
  // 按数量抽样
  segments?: SegmentConfig[]
  // 固定数量抽样
  fixed_count?: number
  // 全检无配置
}

export interface CalcResult {
  sample_count: number
  accept_number: number
  reject_number: number
  sampling_plan: SamplingPlan
}

// ============================================================
// AQL 查表
// ============================================================
export function lookupAQL(batchQty: number, aql: number): { sample_size: number; accept_number: number; reject_number: number } {
  const row = AQL_TABLE.find(r => batchQty >= r.min_qty && batchQty <= r.max_qty)
  const targetRow = row || AQL_TABLE[AQL_TABLE.length - 1]
  const aqlKey = aql.toString()
  const val = targetRow.data[aqlKey] || { Ac: 0, Re: 1 }
  return { sample_size: targetRow.n, accept_number: val.Ac, reject_number: val.Re }
}

// ============================================================
// 样本量上限截断（n=20 时的 Ac/Re 同步调整）
// ============================================================

/** n=20 时的 AQL 行索引（检验水平Ⅱ，批量 151-280） */
const AQL_N20_ROW = AQL_TABLE.find(r => r.n === MAX_SAMPLE_COUNT)

/**
 * 将样本量截断到 MAX_SAMPLE_COUNT 以内
 * - AQL抽样：使用 n=20 行的 Ac/Re 替代原大样本 Ac/Re
 * - 全检：样本量=20, Ac=19, Re=20
 * - 固定数量/按数量抽样：仅截断样本量，保留原 Ac/Re
 */
function capToMax(
  result: CalcResult,
  aqlValue: number | null | undefined = null,
): CalcResult {
  if (result.sample_count <= MAX_SAMPLE_COUNT) return result

  const capped: CalcResult = {
    ...result,
    sample_count: MAX_SAMPLE_COUNT,
  }

  // AQL抽样：用 n=20 行的 Ac/Re 替换
  if (aqlValue !== null && AQL_N20_ROW) {
    const aqlKey = aqlValue.toString()
    const val = AQL_N20_ROW.data[aqlKey]
    if (val) {
      capped.accept_number = val.Ac
      capped.reject_number = val.Re
    }
  }

  // 全检兜底：样本量=20, Ac=19, Re=20
  if (result.sampling_plan === '全检') {
    capped.accept_number = MAX_SAMPLE_COUNT - 1
    capped.reject_number = MAX_SAMPLE_COUNT
  }

  return capped
}

// ============================================================
// 主计算函数
// ============================================================
/**
 * 根据抽样方案 + 到货数量计算实际样本量和 Ac/Re
 */
export function calcSampleInfo(
  samplingPlan: SamplingPlan | string | null | undefined,
  samplingDetail: SamplingDetail | string | null | undefined,
  samplingRatio: number | null | undefined,
  quantity: number | null | undefined,
): CalcResult {
  const q = Number(quantity) || 0
  const plan = (samplingPlan || 'AQL抽样') as SamplingPlan

  // 解析 samplingDetail
  let detail: SamplingDetail = {}
  if (typeof samplingDetail === 'string' && samplingDetail) {
    try {
      detail = JSON.parse(samplingDetail)
    } catch {
      detail = {}
    }
  } else if (samplingDetail && typeof samplingDetail === 'object') {
    detail = samplingDetail
  }

  switch (plan) {
    case 'AQL抽样': {
      const aqlVal = Number(detail.aql_value) || 2.5
      const info = lookupAQL(q > 0 ? q : 1, aqlVal)
      // 如果详情中已有计算值且匹配，则使用详情中的值（已固定的检验数据）
      if (detail.sample_size && detail.accept_number !== undefined && detail.reject_number !== undefined) {
        return capToMax({
          sample_count: detail.sample_size,
          accept_number: detail.accept_number,
          reject_number: detail.reject_number,
          sampling_plan: plan,
        }, aqlVal)
      }
      return capToMax({
        sample_count: info.sample_size,
        accept_number: info.accept_number,
        reject_number: info.reject_number,
        sampling_plan: plan,
      }, aqlVal)
    }

    case '按数量抽样': {
      const segments = (detail.segments || []) as SegmentConfig[]
      if (segments.length === 0) {
        return { sample_count: 1, accept_number: 0, reject_number: 1, sampling_plan: plan }
      }
      // 按到货数量匹配分段
      const matched = segments.find(s => q <= s.max_qty)
      if (matched) {
        return capToMax({
          sample_count: Math.max(1, matched.sample_count),
          accept_number: matched.accept_number,
          reject_number: matched.reject_number,
          sampling_plan: plan,
        })
      }
      // 超过最大分段，取最后一段
      const last = segments[segments.length - 1]
      return capToMax({
        sample_count: Math.max(1, last.sample_count),
        accept_number: last.accept_number,
        reject_number: last.reject_number,
        sampling_plan: plan,
      })
    }

    case '固定数量抽样': {
      const fixedCfg = detail as FixedCountConfig
      const fixedCount = Number(fixedCfg.fixed_count) || 1
      return capToMax({
        sample_count: Math.max(1, fixedCount),
        accept_number: fixedCfg.accept_number ?? 0,
        reject_number: fixedCfg.reject_number ?? 1,
        sampling_plan: plan,
      })
    }

    case '全检': {
      const total = Math.max(1, q)
      return capToMax({
        sample_count: total,
        accept_number: total,  // 全检：不合格数<1 即合格
        reject_number: total + 1,
        sampling_plan: plan,
      })
    }

    default: {
      // 兜底：AQL 2.5
      return calcSampleInfo('AQL抽样', { aql_value: 2.5 }, samplingRatio, quantity)
    }
  }
}

// ============================================================
// 兼容旧接口：calcSampleCount
// ============================================================
/** @deprecated 请使用 calcSampleInfo */
export function calcSampleCount(
  mode: string | null | undefined,
  needSampleCount: number | null | undefined,
  quantity: number | null | undefined,
): number {
  const n = Number(needSampleCount) || 0
  const q = Number(quantity) || 0
  switch (mode) {
    case 'fixed':
      return Math.max(1, n)
    case 'percent':
      if (q <= 0 || n <= 0) return 1
      return Math.max(1, Math.ceil(q * n / 100))
    default:
      return Math.max(1, n)
  }
}

/**
 * 批量计算：根据到货数量更新所有 items 的样本量和 Ac/Re
 */
export function recalcItemSampleCounts(items: any[], quantity: number | null | undefined): any[] {
  if (!items || items.length === 0) return items
  return items.map(item => {
    const info = calcSampleInfo(
      item.sampling_plan,
      item.sampling_detail,
      null,
      quantity,
    )
    return {
      ...item,
      need_sample_count: info.sample_count,
      accept_number: info.accept_number,
      reject_number: info.reject_number,
    }
  })
}

/**
 * 判定结果：根据 Ac/Re 判定该检验项是否合格
 */
export function judgeItemResult(
  defectCount: number,
  acceptNumber: number | null | undefined,
  rejectNumber: number | null | undefined,
): '合格' | '不合格' | '继续' {
  const ac = acceptNumber ?? 0
  const re = rejectNumber ?? 1
  if (defectCount <= ac) return '合格'
  if (defectCount >= re) return '不合格'
  return '继续'  // 处于 Ac < x < Re，需要继续抽样
}

/**
 * 构建 AQL 抽样详情 JSON
 */
export function buildAQLDetail(aqlValue: number, batchQty: number): AQLConfig {
  const info = lookupAQL(batchQty, aqlValue)
  const capped = capToMax({
    sample_count: info.sample_size,
    accept_number: info.accept_number,
    reject_number: info.reject_number,
    sampling_plan: 'AQL抽样',
  }, aqlValue)
  return {
    aql_value: aqlValue,
    inspection_level: 'Ⅱ',
    sample_size: capped.sample_count,
    accept_number: capped.accept_number,
    reject_number: capped.reject_number,
  }
}
