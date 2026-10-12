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

/** 北京时间 ISO 时间戳（UTC+8）
 * pino timestamp 函数要求返回完整 JSON 片段（含前导逗号和 key）
 * 参考 pino.stdTimeFunctions.isoTime 的格式：,"time":"2026-10-12T13:59:39.807+08:00"
 */
function beijingIsoTime(): string {
  const now = new Date()
  // UTC+8：在 UTC 上加 8 小时
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const t = `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}T${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}:${pad(bj.getUTCSeconds())}.${pad(bj.getUTCMilliseconds(), 3)}+08:00`
  return `,"time":"${t}"`
}

const pinoInstance = isProd
  ? pino({
      level,
      base: undefined,
      timestamp: beijingIsoTime,
    })
  : pino({
      level,
      base: undefined,
      timestamp: beijingIsoTime,
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
