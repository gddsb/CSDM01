import type { Request, Response, NextFunction, RequestHandler } from 'express'
import rateLimit from 'express-rate-limit'

interface RateLimitRequest {
  ip?: string
  path?: string
  headers?: Record<string, unknown>
  socket?: { remoteAddress?: string }
  user?: { userId?: number; username?: string }
}

/**
 * 限流 keyGenerator：
 * - 已登录用户优先使用 username，避免沙箱/反向代理后所有请求共用同一 IP 导致误限流
 * - 未登录请求取真实 IP
 */
function rateLimitKeyGenerator(req: RateLimitRequest): string {
  if (req.user?.username) return `user:${req.user.username}`
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return `ip:${first}`
  }
  return `ip:${req.ip || req.socket?.remoteAddress || '127.0.0.1'}`
}

/**
 * 通用业务异常：抛出后由全局错误中间件统一转为标准响应
 */
export class AppError extends Error {
  public readonly code: number
  public readonly statusCode: number
  constructor(message: string, code = 50000, statusCode = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
  }
}

/**
 * asyncHandler：包裹异步路由处理函数，自动把 rejected promise / 抛出的异常
 * 转发给 Express 的错误中间件，避免 Express 4 无法捕获 async 错误导致进程挂起。
 */
export const asyncHandler =
  <P = any, ResBody = any, ReqBody = any, ReqQuery = any>(
    fn: (
      req: Request<P, ResBody, ReqBody, ReqQuery>,
      res: Response<ResBody>,
      next: NextFunction
    ) => Promise<unknown> | unknown
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    Promise.resolve(fn(req as any, res as any, next)).catch(next)
  }

/**
 * CORS 白名单
 * - 生产环境：只允许 CORS_ORIGIN 配置的来源（逗号分隔），默认放行同源
 * - 开发环境：允许所有来源（Vite dev server 跨端口访问）
 */
export function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN || ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function corsOptions(): {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void
  credentials: boolean
  maxAge: number
} {
  const isProd = process.env.NODE_ENV === 'production'
  const allowlist = getAllowedOrigins()
  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true)
      if (!isProd) return cb(null, true)
      if (allowlist.length === 0) return cb(null, true)
      if (allowlist.includes(origin)) return cb(null, true)
      return cb(new Error(`CORS 策略禁止该来源访问: ${origin}`))
    },
    credentials: true,
    maxAge: 86400,
  }
}

/**
 * 登录接口限流：防暴力破解
 * 默认 1 分钟内同一 IP 最多 30 次（可通过 LOGIN_RATE_LIMIT / LOGIN_RATE_WINDOW 配置）
 */
export const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_WINDOW_MS || 60 * 1000),
  max: Number(process.env.LOGIN_RATE_LIMIT || 30),
  standardHeaders: true,
  validate: false,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  message: {
    success: false,
    code: 42900,
    message: '登录尝试过于频繁，请稍后再试',
  },
})

/**
 * 通用 API 限流：兜底保护，防止接口被刷
 * 注意：apiRateLimiter 注册在 authRequired 之前，此时 req.user 尚未挂载，
 * 因此这里按真实 IP 限流；已登录用户的细粒度保护由业务层/权限层承担。
 * 默认 1 分钟 1000 次/IP（内网 MES 系统 + 反向代理场景，避免共享 IP 误杀）。
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT || 1000),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: rateLimitKeyGenerator,
  skip: (req) => {
    if (req.path === '/api/health') return true
    if (req.path.startsWith('/uploads/')) return true
    return false
  },
  message: {
    success: false,
    code: 42900,
    message: '请求过于频繁，请稍后再试',
  },
})
