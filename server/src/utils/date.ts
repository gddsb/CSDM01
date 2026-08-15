const BEIJING_OFFSET = 8 * 60

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toBeijingDate(d: Date | string | number | null | undefined): Date {
  if (d === null || d === undefined) return new Date()
  const date = d instanceof Date ? d : new Date(d)
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000
  return new Date(utcMs + BEIJING_OFFSET * 60 * 1000)
}

export function formatDateTime(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return ''
  const bj = toBeijingDate(d)
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`
}

export function formatDate(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return ''
  const bj = toBeijingDate(d)
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())}`
}

export function nowBeijingStr(): string {
  return formatDateTime(new Date())
}

export function nowBeijingDateStr(): string {
  return formatDate(new Date())
}

export function nowBeijingDate(): Date {
  return toBeijingDate(new Date())
}

export function parseDateTime(s: string | null | undefined): Date | null {
  if (s === null || s === undefined || s === '') return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d
}

export function parseDateOnly(s: string | null | undefined): Date | null {
  if (s === null || s === undefined || s === '') return null
  const d = new Date(s + ' 00:00:00')
  if (isNaN(d.getTime())) return null
  return d
}
