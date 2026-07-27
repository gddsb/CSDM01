import dayjs from 'dayjs'

export const DATE_TIME_FORMAT = 'YYYY/MM/DD HH:mm'
export const DATE_FORMAT = 'YYYY/MM/DD'
export const TIME_FORMAT = 'HH:mm'

export function formatDateTime(value: string | number | Date | dayjs.Dayjs | undefined | null): string {
  if (!value) return '-'
  return dayjs(value).format(DATE_TIME_FORMAT)
}

export function formatDate(value: string | number | Date | dayjs.Dayjs | undefined | null): string {
  if (!value) return '-'
  return dayjs(value).format(DATE_FORMAT)
}

export function formatTime(value: string | number | Date | dayjs.Dayjs | undefined | null): string {
  if (!value) return '-'
  return dayjs(value).format(TIME_FORMAT)
}

export function formatVersionNo(version: string | number | undefined): string {
  if (!version || version === '-' || version === '0' || version === 0) return '000'
  const num = Number(version)
  if (isNaN(num)) return String(version).padStart(3, '0')
  return num.toString().padStart(3, '0')
}

export function formatFilmVersion(filmVersion: string | undefined, versionNo: string | undefined): string {
  if (!filmVersion && !versionNo) return ''
  const filmPart = filmVersion ? filmVersion.replace(/[^A-Za-z0-9]/g, '') : ''
  const versionPart = versionNo ? formatVersionNo(versionNo.replace(/^[Vv]/, '')) : ''
  return filmPart + versionPart
}
