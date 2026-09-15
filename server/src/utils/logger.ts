/**
 * 结构化日志（pino）
 *
 * 与旧版 console 包装器保持相同的 API 签名（debug/info/warn/error，接受任意参数），
 * 业务代码无需改动即可获得 JSON 结构化输出。
 *
 * 开发环境：pino-pretty transport，彩色可读
 * 生产环境：纯 JSON 输出，PM2 自动轮转
 */
import pino from 'pino'

const level = (process.env.LOG_LEVEL || 'info').toLowerCase()
const isProd = process.env.NODE_ENV === 'production'

const pinoInstance = isProd
  ? pino({
      level,
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
    })
  : pino({
      level,
      base: undefined,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
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
