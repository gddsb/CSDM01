/**
 * 前端统一时间格式化工具 — 输出"YYYY-MM-DD HH:mm:ss"本地时区字符串
 *
 * 背景：后端 MySQL 连接强制 timezone '+08:00'，DATETIME 列不带时区信息。
 * 前端传时间字符串给后端时，必须是"本地时区（北京时间）"格式化的字符串，
 * 不能用 toISOString()（UTC 时间戳，会被后端当作本地时间导致 -8 小时）。
 */
import dayjs from 'dayjs'

/** Date / ISO 字符串 / 时间戳 → "YYYY-MM-DD HH:mm:ss"（本地时区） */
export function fmtLocalDateTime(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return ''
  return dayjs(d).format('YYYY-MM-DD HH:mm:ss')
}

/** Date / ISO 字符串 / 时间戳 → "YYYY-MM-DD"（本地时区） */
export function fmtLocalDate(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return ''
  return dayjs(d).format('YYYY-MM-DD')
}

/** 当前本地时间 "YYYY-MM-DD HH:mm:ss" */
export function nowLocalStr(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss')
}

/** 当前本地日期 "YYYY-MM-DD" */
export function nowLocalDateStr(): string {
  return dayjs().format('YYYY-MM-DD')
}
