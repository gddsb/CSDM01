/**
 * 样品量自动计算服务
 * 根据抽样模式 + need_sample_count + 到货数量 计算实际样本量
 */

export type SampleCountMode = 'fixed' | 'percent' | 'auto'

/**
 * 计算实际样品量
 * @param mode 抽样模式：fixed固定值/percent百分比/auto自动
 * @param needSampleCount 检验标准配置的默认抽样数
 * @param quantity 到货数量（仅 percent 模式使用）
 * @returns 实际样品量（最小1）
 */
export function calcSampleCount(
  mode: SampleCountMode | string | null | undefined,
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
    case 'auto':
    default:
      return Math.max(1, n)
  }
}

/**
 * 批量计算：根据到货数量更新所有 items 的 need_sample_count
 */
export function recalcItemSampleCounts(
  items: any[],
  quantity: number | null | undefined,
): any[] {
  if (!items || items.length === 0) return items
  return items.map(item => ({
    ...item,
    need_sample_count: calcSampleCount(
      item.sample_count_mode,
      item.need_sample_count,
      quantity,
    ),
  }))
}
