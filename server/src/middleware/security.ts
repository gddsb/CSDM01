import type { Request, Response, NextFunction, RequestHandler } from 'express'
import rateLimit from 'express-rate-limit'

/**
 * 限流 keyGenerator：优先取反向代理后的真实 IP，回退到 req.ip（已正确处理 IPv6）
 */
function rateLimitKeyGenerator(req: { ip?: string; headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
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
      // 同源请求（无 Origin，如 curl、服务器内部、同源 fetch）直接放行
      if (!origin) return cb(null, true)
      if (!isProd) return cb(null, true)
      if (allowlist.length === 0) return cb(null, true) // 未配置白名单时默认放行（兜底，生产建议配置）
      if (allowlist.includes(origin)) return cb(null, true)
      return cb(new Error(`CORS 策略禁止该来源访问: ${origin}`))
    },
    credentials: true,
    maxAge: 86400,
  }
}

/**
 * 登录接口限流：防暴力破解
 * 默认 1 分钟内同一 IP 最多 10 次（可通过 LOGIN_RATE_LIMIT / LOGIN_RATE_WINDOW 配置）
 */
export const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_WINDOW_MS || 60 * 1000),
  max: Number(process.env.LOGIN_RATE_LIMIT || 10),
  standardHeaders: true,
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
 * 默认 1 分钟 120 次/IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT || 120),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 健康检查、静态上传资源不限流
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
