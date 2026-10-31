/**
 * 时间工具 — 本项目统一约定：
 *
 *   1. 所有时间存储：MySQL DATETIME/DATE 列，纯北京时间字符串，不带时区
 *   2. Sequelize 连接层：timezone '+08:00' 自动处理 Date ↔ DATETIME 互转
 *   3. 前端/后端都只传 "YYYY-MM-DD HH:mm:ss" 或 Date 对象（服务器本地时间）
 *   4. ❌ 禁止 toISOString()、UTC 转换、手动 +8 小时偏移
 *
 * 服务器本身应运行在 Asia/Shanghai 时区；即使不是，Sequelize timezone '+08:00'
 * 也已保证 MySQL 读写用北京时间。此处不再做额外时区偏移。
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date / string / timestamp → "YYYY-MM-DD HH:mm:ss"（服务器本地时间，不再手动转 +08:00） */
export function formatDateTime(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Date / string / timestamp → "YYYY-MM-DD" */
export function formatDate(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 当前时间 "YYYY-MM-DD HH:mm:ss"（服务器本地） */
export function nowStr(): string {
  return formatDateTime(new Date())
}

/** 当前日期 "YYYY-MM-DD"（服务器本地） */
export function todayStr(): string {
  return formatDate(new Date())
}

/** 当前 Date 对象（服务器本地 —— 不再手动 +8 小时） */
export function now(): Date {
  return new Date()
}

/** ⚠️ 保留旧函数名（兼容已导入的调用方），内部不再做时区偏移 */
export const nowBeijingStr = nowStr
export const nowBeijingDateStr = todayStr
export const nowBeijingDate = now

/** 解析字符串为 Date（不做时区转换） */
export function parseDateTime(s: string | null | undefined): Date | null {
  if (s === null || s === undefined || s === '') return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d
}

/** 解析 "YYYY-MM-DD" 为 Date（不做时区转换） */
export function parseDateOnly(s: string | null | undefined): Date | null {
  if (s === null || s === undefined || s === '') return null
  const d = new Date(s + ' 00:00:00')
  if (isNaN(d.getTime())) return null
  return d
}
