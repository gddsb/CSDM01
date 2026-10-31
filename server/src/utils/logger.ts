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

/** 是否启用系统日志 DB 存储（默认 true，可用 DISABLE_DB_LOG=1 关闭） */
const ENABLE_DB_LOG = process.env.DISABLE_DB_LOG !== '1'

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

// ========== 系统日志 DB 批量写入（fire-and-forget，不阻塞主流程） ==========
// pino 日志同时写入 sys_system_log 表（方案 B：系统日志改从 DB 读）
// 设计：内存 buffer + debounce flush + 失败静默 catch

const DB_FLUSH_INTERVAL_MS = 500
const DB_FLUSH_BATCH_SIZE = 50
const DB_MAX_BUFFER_SIZE = 5000 // 防溢出：超过直接丢弃 oldest

interface DbLogEntry {
  level: string
  category: string
  message: string
  details: string | null
  duration_ms: number | null
  path: string | null
  method: string | null
  status: number | null
  source: string | null
}

let dbBuffer: DbLogEntry[] = []
let dbFlushTimer: ReturnType<typeof setTimeout> | null = null

/** 把 pino 原始对象转换成 DB entry（失败时不阻塞主流程） */
function extractDbEntry(levelName: string, fields: Record<string, unknown> | null, msg: string): DbLogEntry | null {
  try {
    const f = fields || {}
    const hasReq = typeof (f.req as any)?.url === 'string'
    const hasRes = typeof (f.res as any)?.statusCode === 'number'
    const category = (hasReq ? 'request' : null)
    const path = typeof (f.req as any)?.url === 'string' ? String((f.req as any).url).slice(0, 255) : null
    const method = typeof (f.req as any)?.method === 'string' ? String((f.req as any).method) : null
    const status = typeof (f.res as any)?.statusCode === 'number' ? Number((f.res as any).statusCode) : null
    const duration_ms = typeof (f.responseTime) === 'number' ? Number(f.responseTime) : null
    const source = typeof f.source === 'string' ? String(f.source).slice(0, 100) : null
    const cleanFields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(f)) {
      if (k === 'req' || k === 'res' || k === 'err') continue // 敏感/大对象不冗余
      if (typeof v === 'function') continue
      cleanFields[k] = v
    }
    const details = Object.keys(cleanFields).length > 0 ? JSON.stringify(cleanFields).slice(0, 8000) : null
    return {
      level: levelName.toUpperCase(),
      category,
      message: (msg || '-').slice(0, 1000),
      details,
      duration_ms,
      path,
      method,
      status,
      source,
    }
  } catch {
    return null
  }
}

/**
 * 直接 hook pinoInstance 本身的各 level 方法
 * — 这样 pino-http 传入的 { req, res, responseTime } 也会进入 DB
 */
function hookPinoForDb() {
  const levels: Array<'info' | 'warn' | 'error' | 'debug'> = ['info', 'warn', 'error', 'debug']
  for (const lvl of levels) {
    const orig = pinoInstance[lvl].bind(pinoInstance)
    ;(pinoInstance as any)[lvl] = function (first: any, ...rest: any[]) {
      // 原始 pino 调用（输出到 pm2 文件，不阻塞）
      orig(first, ...rest)
      // 解析并存 DB（fire-and-forget）
      let fields: Record<string, unknown> | null = null
      let msg = ''
      if (first && typeof first === 'object' && !(first instanceof Error)) {
        fields = first
        msg = rest.map(a => String(a)).join(' ')
      } else if (first instanceof Error) {
        msg = rest.map(a => String(a)).join(' ')
        if (!msg) msg = String(first)
      } else {
        msg = [first, ...rest].map(a => String(a)).join(' ')
      }
      const dbEntry = extractDbEntry(lvl, fields, msg)
      pushToDbBuffer(dbEntry)
    }
  }
}

// 立即 hook（logger.ts 被 import 时生效）
if (ENABLE_DB_LOG) hookPinoForDb()

async function flushDbBuffer(): Promise<void> {
  dbFlushTimer = null
  if (!ENABLE_DB_LOG || dbBuffer.length === 0) return
  const batch = dbBuffer.splice(0, Math.min(dbBuffer.length, DB_FLUSH_BATCH_SIZE))
  if (batch.length === 0) return
  try {
    const { SystemLog } = await import('../models/index.js')
    await SystemLog.bulkCreate(batch, { validate: false })
  } catch {
    // DB 写入失败绝对不能影响主流程
  }
}

function scheduleDbFlush(): void {
  if (dbFlushTimer == null) {
    dbFlushTimer = setTimeout(flushDbBuffer, DB_FLUSH_INTERVAL_MS)
  }
}

function pushToDbBuffer(entry: DbLogEntry | null): void {
  if (!ENABLE_DB_LOG || !entry) return
  if (dbBuffer.length >= DB_MAX_BUFFER_SIZE) dbBuffer.shift() // 防内存溢出
  dbBuffer.push(entry)
  if (dbBuffer.length >= DB_FLUSH_BATCH_SIZE) {
    if (dbFlushTimer != null) clearTimeout(dbFlushTimer)
    flushDbBuffer() // 达到阈值立即刷
  } else {
    scheduleDbFlush() // 否则 debounce
  }
}

/** 对外导出的 logger：走 hook 过的 pinoInstance（已自动写 pm2 + DB） */
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
