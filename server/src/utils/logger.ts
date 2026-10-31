/**
 * 结构化日志（pino）
 *
 * 与旧版 console 包装器保持相同的 API 签名（debug/info/warn/error，接受任意参数），
 * 业务代码无需改动即可获得 JSON 结构化输出。
 *
 * ⚠️ 时区统一：所有时间戳强制北京时间（UTC+8）
 *   pino.stdTimeFunctions.isoTime 返回的是标准 UTC ISO（如 2026-10-12T05:55:23.456Z），
 *   跟 PM2 显示、MySQL 存的 CST 时间不一致。这里自定义 time 函数返回
 *   北京时间 ISO 格式（如 2026-10-12T13:55:23.456+08:00）。
 *
 * 开发环境：pino-pretty transport，彩色可读，translateTime 用 UTC+8
 * 生产环境：纯 JSON 输出，PM2 自动轮转
 */
import 'dotenv/config' // ⚠️ 必须在最顶部！确保 process.env 在所有顶层常量求值前就加载
import pino from 'pino'

const level = (process.env.LOG_LEVEL || 'info').toLowerCase()
const isProd = process.env.NODE_ENV === 'production'

/** 北京时间时间戳（无 T/Z，空格分隔）
 * 服务器已设 Asia/Shanghai (+08:00)，new Date() 直接就是本地时间。
 * 输出格式与 MySQL DATETIME 一致：,"time":"2026-10-31 18:07:04.123"
 * pino timestamp 函数要求返回完整 JSON 片段（含前导逗号和 key）
 */
function beijingTime(): string {
  const d = new Date()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const t = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  return `,"time":"${t}"`
}

const pinoInstance = isProd
  ? pino({
      level,
      base: undefined,
      timestamp: beijingTime,
    })
  : pino({
      level,
      base: undefined,
      timestamp: beijingTime,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    })

/**
 * pino API 是 (obj, msg, ...args)，业务代码是 console 风格 (...args)
 * 把第一个非 Error 对象当作结构化 fields，其余拼成 msg
 */
function normalizeArgs(args: any[]): [Record<string, unknown> | null, string] {
  if (args.length === 0) return [null, '']
  const first = args[0]

  if (first instanceof Error) {
    const fields = { err: pino.stdSerializers.err(first) }
    const restMsg = args.slice(1).map((a) => String(a)).join(' ')
    return [fields, restMsg]
  }

  if (first && typeof first === 'object') {
    const fields = first as Record<string, unknown>
    const restMsg = args.slice(1).map((a) => {
      if (a == null) return String(a)
      if (typeof a === 'object') { try { return JSON.stringify(a) } catch { return String(a) } }
      return String(a)
    }).join(' ')
    return [fields, restMsg]
  }

  const msg = args.map((a) => {
    if (a == null) return String(a)
    if (typeof a === 'object') { try { return JSON.stringify(a) } catch { return String(a) } }
    return String(a)
  }).join(' ')
  return [null, msg]
}

/** 原生 pino 实例，供 pino-http 等需要原生 API 的库使用 */
export const pinoLogger = pinoInstance

export const logger = {
  debug: (...args: any[]) => {
    const [fields, msg] = normalizeArgs(args)
    fields ? pinoInstance.debug(fields, msg) : pinoInstance.debug(msg)
  },
  info: (...args: any[]) => {
    const [fields, msg] = normalizeArgs(args)
    fields ? pinoInstance.info(fields, msg) : pinoInstance.info(msg)
  },
  warn: (...args: any[]) => {
    const [fields, msg] = normalizeArgs(args)
    fields ? pinoInstance.warn(fields, msg) : pinoInstance.warn(msg)
  },
  error: (...args: any[]) => {
    const [fields, msg] = normalizeArgs(args)
    fields ? pinoInstance.error(fields, msg) : pinoInstance.error(msg)
  },
}

export default logger
