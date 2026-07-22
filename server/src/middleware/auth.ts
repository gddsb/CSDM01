import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt.js'
import { fail, ErrorCode } from '../utils/response.js'
import { OperationLog } from '../models/index.js'

// HTTP 方法到操作名称的映射
const methodActionMap: Record<string, string> = {
  GET: '查询',
  POST: '新增',
  PUT: '修改',
  PATCH: '修改',
  DELETE: '删除',
}

/**
 * JWT 认证中间件
 * 从请求头 Authorization: Bearer xxx 中读取并验证 token
 * 验证通过后将解码后的 user 信息挂载到 req.user
 */
export function authRequired(req: Request, res: Response, next: NextFunction): any {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, '未提供认证令牌', ErrorCode.UNAUTHORIZED)
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return fail(res, '认证令牌为空', ErrorCode.UNAUTHORIZED)
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return fail(res, '认证令牌无效或已过期', ErrorCode.UNAUTHORIZED)
  }

  (req as any).user = decoded
  next()
}

/**
 * 权限校验中间件（暂时简化，所有登录用户都有权限）
 * @param permCode - 权限编码
 */
export function permissionRequired(permCode: string) {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!(req as any).user) {
      return fail(res, '用户未登录', ErrorCode.UNAUTHORIZED)
    }
    // 简化处理：所有登录用户都有权限
    next()
  }
}

/**
 * 操作日志记录中间件
 * 在响应结束后异步记录用户操作到 OperationLog 表
 * @param module - 业务模块名称
 */
export function logOperation(module: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      try {
        const action = methodActionMap[req.method] || req.method
        const userInfo: any = (req as any).user || {}
        const forwarded = req.headers['x-forwarded-for']
        const ip = (forwarded && String(forwarded).split(',')[0].trim()) || req.ip || (req.socket as any)?.remoteAddress || ''

        OperationLog.create({
          user_id: userInfo.userId || null,
          username: userInfo.username || '匿名',
          module,
          operation: `${action} ${module}`,
          method: req.method,
          params: req.originalUrl || req.url || '',
          ip,
          status: 1,
        }).catch((err: any) => {
          console.error('[logOperation] 记录操作日志失败:', err.message)
        })
      } catch (err: any) {
        console.error('[logOperation] 记录操作日志异常:', err.message)
      }
    })
    next()
  }
}

export default { authRequired, permissionRequired, logOperation }
