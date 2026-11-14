// ========== 工序物料规则（前后端共享，后续可迁移到后端配置表 bas_process_material_rule）==========
// 移动端 ProcessMaterialPanel + PC 端 ProcessReporting 共用此文件

export type MaterialRule =
  | { type: 'prefix_map'; autoPrefix: string; allowedPrefixes: string[] }
  | { type: 'prefix'; allowedPrefixes: string[] }
  | { type: 'exact'; allowedCodes: string[] }
  | { type: 'dynamic_prefix'; basePrefixes: string[] }

/** 工序编码 → 物料规则 */
export const PROCESS_MATERIAL_RULES: Record<string, MaterialRule> = {
  // 裁剪下料：自动匹配前缀→T1；候选 T1/T9/D1/Y20 开头，排序同
  'P-01': { type: 'prefix_map', autoPrefix: 'T1', allowedPrefixes: ['T1', 'T9', 'D1', 'Y20'] },
  // 成圆焊接：自动匹配前缀→D1；候选 D1 开头
  'P-03': { type: 'prefix_map', autoPrefix: 'D1', allowedPrefixes: ['D1'] },
  // 补涂烘干：仅两个固定料号
  'P-04': { type: 'exact', allowedCodes: ['H32-000-001', 'F40-000-076'] },
  // 翻边封口：候选前缀 = basePrefixes + 报工单料号第3位
  'P-06': { type: 'dynamic_prefix', basePrefixes: ['P0', 'P2', 'P3', 'P4'] },
  // 码垛包装：B 开头
  'P-10': { type: 'prefix', allowedPrefixes: ['B'] },
}

/** 取工序规则（无规则返回 undefined，调用方应放行全部） */
export function getProcessMaterialRule(processCode: string | undefined): MaterialRule | undefined {
  if (!processCode) return undefined
  return PROCESS_MATERIAL_RULES[processCode]
}

/** 候选是否在规则允许范围内 */
export function isMaterialAllowed(code: string, rule: MaterialRule, reportCode?: string): boolean {
  switch (rule.type) {
    case 'prefix_map':
    case 'prefix':
      return rule.allowedPrefixes.some(p => code.startsWith(p))
    case 'exact':
      return rule.allowedCodes.some(c => code === c || code.startsWith(c))
    case 'dynamic_prefix': {
      if (!reportCode || reportCode.length < 3) return true // 报工单料号异常时放行
      const third = reportCode[2] // 第3位（0-indexed: 2）
      return rule.basePrefixes.some(p => code.startsWith(p + third))
    }
  }
}

/** 候选排序（按 allowedPrefixes 顺序，不在列表里放最后；exact/dynamic 按料号字母序） */
export function sortMaterialsByRule<T extends { material_code: string }>(
  list: T[],
  rule: MaterialRule,
): T[] {
  if (rule.type === 'prefix_map' || rule.type === 'prefix') {
    const order = rule.allowedPrefixes
    return [...list].sort((a, b) => {
      const ia = order.findIndex(p => a.material_code.startsWith(p))
      const ib = order.findIndex(p => b.material_code.startsWith(p))
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      return a.material_code.localeCompare(b.material_code)
    })
  }
  return [...list].sort((a, b) => a.material_code.localeCompare(b.material_code))
}

/** 自动匹配料号：把报工单料号前缀替换为 autoPrefix */
export function buildAutoMatchCode(reportCode: string, autoPrefix: string): string | null {
  if (!reportCode || reportCode.length < 2) return null
  return autoPrefix + reportCode.substring(2)
}

/** 规则描述（Popup 顶部提示/PC 端 Tooltip 用） */
export function ruleSummary(rule: MaterialRule, reportCode?: string): string {
  switch (rule.type) {
    case 'prefix_map':
    case 'prefix':
      return rule.allowedPrefixes.join('/') + ' 开头'
    case 'exact':
      return rule.allowedCodes.join('、')
    case 'dynamic_prefix': {
      if (!reportCode || reportCode.length < 3) return 'P0/P2/P3/P4 第三位匹配'
      const third = reportCode[2]
      return ['P0', 'P2', 'P3', 'P4'].map(p => p + third).join('/') + ' 开头'
    }
  }
}
