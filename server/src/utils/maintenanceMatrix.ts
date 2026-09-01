// ============================================================
// 设备保养矩阵视图纯工具函数（可独立测试）
// ============================================================

/** ISO 周号：返回 'YYYY-Www'（如 '2026-W36'） */
export function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/** 仅日期字符串 YYYY-MM-DD */
export function dateOnlyStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 当前日期字符串 */
export function todayStr(): string {
  return dateOnlyStr(new Date())
}

/** period_key 生成：统一四种 trigger_mode 的周期标识 */
export function buildPeriodKey(
  triggerMode: string,
  targetDate: Date,
  standardId?: number,
  deviceId?: number,
  threshold?: number,
): string {
  switch (triggerMode) {
    case 'daily':
      return dateOnlyStr(targetDate)
    case 'weekly':
      return getISOWeek(targetDate)
    case 'monthly':
      return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`
    case 'runtime':
      return `RUNTIME:${deviceId ?? 0}:${standardId ?? 0}:${threshold ?? 0}`
    default:
      return dateOnlyStr(targetDate)
  }
}

/** 解析混合输入的状态值（中文/数字）→ 数字数组 */
export function parseMultiStatus(
  status: unknown,
  STATUS_REVERSE: Record<string, number>,
): number[] | null {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach((s: any) => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach((p: string) => {
        const n = STATUS_REVERSE[p] !== undefined ? STATUS_REVERSE[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = STATUS_REVERSE[s] !== undefined ? STATUS_REVERSE[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

/** 从月份 + 年份生成当月所有日期 period_key（daily） */
export function dailyPeriodKeys(yr: number, mo: number): string[] {
  const daysInMonth = new Date(yr, mo, 0).getDate()
  return Array.from(
    { length: daysInMonth },
    (_, i) => `${yr}-${String(mo).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  )
}

/** 从月份 + 年份生成当月覆盖的所有 ISO 周 period_key（weekly） */
export function weeklyPeriodKeys(yr: number, mo: number): string[] {
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const set = new Set<string>()
  for (let d = 1; d <= daysInMonth; d++) {
    set.add(getISOWeek(new Date(yr, mo - 1, d)))
  }
  return Array.from(set).sort()
}

/** 每月计划解析：JSON → 数字数组 */
export function parseMonthlyPlan(raw: unknown): number[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    // 数组形式：[true, true, ..., true]（12长度） 或 [1,15,28]（数字）
    const arr = raw as unknown[]
    const boolArr = arr.every(v => typeof v === 'boolean')
    if (boolArr) {
      const out: number[] = []
      arr.forEach((v, i) => { if (v) out.push(i + 1) })
      return out
    }
    return arr.map(v => Number(v)).filter(v => !Number.isNaN(v))
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parseMonthlyPlan(parsed)
    } catch {
      return raw.split(/[,，]/).map(s => Number(s.trim())).filter(v => !Number.isNaN(v))
    }
  }
  return []
}

/** 判断 monthly standard 是否在目标月启用（按 monthly_plan） */
export function monthlyStandardActive(rawMonthlyPlan: unknown, mo: number /* 1-12 */): boolean {
  if (rawMonthlyPlan == null) return false
  if (Array.isArray(rawMonthlyPlan) && rawMonthlyPlan.length === 12) {
    return Boolean(rawMonthlyPlan[mo - 1])
  }
  return true
}
