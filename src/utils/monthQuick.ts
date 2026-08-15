import dayjs, { Dayjs } from 'dayjs'

export const MONTH_QUICK_OPTIONS = [
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '近3个月', value: 'last_3' },
  { label: '近6个月', value: 'last_6' },
  { label: '今年', value: 'this_year' },
  { label: '去年', value: 'last_year' },
]

export function getMonthRange(key: string): [Dayjs, Dayjs] | null {
  const now = dayjs()
  switch (key) {
    case 'this_month': return [now.startOf('month'), now.endOf('month')]
    case 'last_month': return [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')]
    case 'last_3': return [now.subtract(3, 'month').startOf('month'), now.endOf('month')]
    case 'last_6': return [now.subtract(6, 'month').startOf('month'), now.endOf('month')]
    case 'this_year': return [now.startOf('year'), now.endOf('year')]
    case 'last_year': return [now.subtract(1, 'year').startOf('year'), now.subtract(1, 'year').endOf('year')]
    default: return null
  }
}

export function validateRange(range: [Dayjs, Dayjs] | null): { ok: boolean; msg?: string; warn?: boolean } {
  if (!range || !range[0] || !range[1]) return { ok: true }
  const months = range[1].endOf('month').diff(range[0].startOf('month'), 'month') + 1
  if (months > 12) return { ok: false, msg: '查询时间跨度不能超过12个月' }
  if (months > 3) return { ok: true, warn: true }
  return { ok: true }
}

export function getThisMonth(): [Dayjs, Dayjs] {
  return [dayjs().startOf('month'), dayjs().endOf('month')]
}
