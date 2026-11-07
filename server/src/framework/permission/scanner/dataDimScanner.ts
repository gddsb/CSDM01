/**
 * 权限引擎 V2 — 数据维度扫描器
 *
 * 扫描 sys_data_scope 规则中使用的 dim_code
 * 对比 sys_data_dimension 字典
 *
 * ⚠️ 红线：只报告差异，**禁止自动新增维度字典记录**
 */

import { DataScope as ScopeModel, DataDimension as DimModel } from '../../../models/index.js'
import logger from '../../../utils/logger.js'
import type { ScannerDiff, ScannerReport } from '../types.js'

export async function runDataDimensionAudit(): Promise<ScannerReport> {
  const [rules, dims] = await Promise.all([
    ScopeModel.findAll({ attributes: ['dim_code'] }),
    DimModel.findAll({ attributes: ['dim_code', 'dim_name', 'target_column'] }),
  ])

  const used = new Set<string>()
  for (const r of rules) {
    const dc = (r as any).dim_code
    if (dc) used.add(dc)
  }

  const dict = new Set(dims.map(d => (d as any).dim_code))

  const diffs: ScannerDiff[] = []

  // 规则里用了但字典缺失
  for (const code of used) {
    if (!dict.has(code)) {
      diffs.push({
        type: 'missing',
        dim_code: code,
        message: `sys_data_scope 规则使用了 dim_code=${code} 但 sys_data_dimension 字典中不存在`,
      })
    }
  }

  // 字典存在但没被任何规则使用（提示，不严重）
  for (const d of dims) {
    const dc = (d as any).dim_code
    if (!used.has(dc)) {
      diffs.push({
        type: 'extra',
        dim_code: dc,
        message: `sys_data_dimension 字典存在 ${dc}(${JSON.stringify((d as any).dim_name)}) 但当前没有任何 sys_data_scope 规则使用它`,
      })
    }
  }

  return {
    scanner: 'data-dimension-scanner',
    generatedAt: new Date().toISOString(),
    total: diffs.length,
    diffs,
  }
}
