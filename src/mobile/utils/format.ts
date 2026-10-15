/**
 * 整数格式化工具 —— 后端 DECIMAL 字段 Sequelize 统一返回 string ".00"
 * 展示层必须走 fmtInt 才能保证整数渲染
 */
export function fmtInt(v: unknown): number {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : 0
}
