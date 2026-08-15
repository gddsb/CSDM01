import { Request, Response, NextFunction } from 'express'
import sequelize from '../config/database.js'
import { logger } from '../utils/logger.js'

const SLOW_API_THRESHOLD = Number(process.env.SLOW_API_MS) || 1000
const SLOW_SQL_THRESHOLD = Number(process.env.SLOW_SQL_MS) || 500

let sqlHooksInstalled = false

/**
 * 安装 Sequelize SQL 计时 Hook。
 * beforeQuery 记录开始时间，afterQuery 计算耗时并记录慢 SQL。
 */
export function installSqlProfiler(): void {
  if (sqlHooksInstalled) return
  if (process.env.SQL_PROFILER !== '1') return

  const startTimes = new WeakMap<object, number>()

  sequelize.addHook('beforeQuery', (options: any) => {
    if (options?.logging === false) return
    startTimes.set(options, Date.now())
  })

  sequelize.addHook('afterQuery', (_: unknown, options: any) => {
    const start = startTimes.get(options)
    if (!start) return
    startTimes.delete(options)
    const duration = Date.now() - start
    if (duration >= SLOW_SQL_THRESHOLD) {
      const sql = typeof options?.sql === 'string' ? options.sql.replace(/\s+/g, ' ').slice(0, 300) : ''
      const binds = options?.bind ? ` bind=${JSON.stringify(options.bind).slice(0, 120)}` : ''
      logger.warn(`[慢SQL] ${duration}ms ${sql}${binds}`)
    }
  })

  sqlHooksInstalled = true
  logger.info(`[性能监控] SQL Profiler 已启用，慢 SQL 阈值 ${SLOW_SQL_THRESHOLD}ms`)
}

/**
 * HTTP 接口耗时监控中间件。
 * 对超过阈值的接口记录警告日志，包含方法、路径、状态码、耗时与用户信息。
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6
    if (durationMs < SLOW_API_THRESHOLD) return

    const user = (req as any).user
    const userId = user?.userId ?? user?.user_id ?? '-'
    const query = Object.keys(req.query).length ? `?${new URLSearchParams(req.query as Record<string, string>).toString()}` : ''
    logger.warn(
      `[慢接口] ${durationMs.toFixed(0)}ms ${req.method} ${req.originalUrl || req.path}${query} ` +
      `status=${res.statusCode} user=${userId} ip=${req.ip}`
    )
  })

  next()
}

/**
 * 数据库连接健康检查与连接池信息。
 */
export async function getDbPoolStats(): Promise<{
  pool: { used: number; idle: number; waiting: number; size: number }
  dialect: string
  database: string
}> {
  const pool = (sequelize as any).connectionManager?.pool
  const writePool = pool?.write || pool?.read || pool
  return {
    pool: {
      used: writePool?.used ?? 0,
      idle: writePool?.idle ?? 0,
      waiting: writePool?.pending ?? (writePool?.waiting || 0),
      size: writePool?.size ?? 0,
    },
    dialect: sequelize.getDialect(),
    database: sequelize.getDatabaseName?.() || process.env.DB_NAME || '',
  }
}
