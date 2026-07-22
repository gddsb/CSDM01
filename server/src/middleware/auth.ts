import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt.js'
import { fail, ErrorCode } from '../utils/response.js'
import { OperationLog, Role, Permission } from '../models/index.js'
import { logger } from '../utils/logger.js'

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'pwd', 'access_token', 'refresh_token']

const PERM_CACHE_TTL = 60000
const permCache: Record<number, { codes: Set<string>; ts: number }> = {}

async function loadRolePermissionCodes(roleId: number): Promise<Set<string>> {
  const now = Date.now()
  const cached = permCache[roleId]
  if (cached && now - cached.ts < PERM_CACHE_TTL) {
    return cached.codes
  }
  const role = await Role.findOne({
    where: { role_id: roleId },
    include: [{ model: Permission, as: 'permissions', attributes: ['perm_code'] }],
  })
  const codes = new Set<string>()
  if (role && (role as any).permissions) {
    for (const p of (role as any).permissions) {
      codes.add(p.perm_code)
    }
  }
  permCache[roleId] = { codes, ts: now }
  return codes
}

export function clearPermissionCache(roleId?: number): void {
  if (roleId !== undefined) {
    delete permCache[roleId]
  } else {
    for (const key of Object.keys(permCache)) delete permCache[Number(key)]
  }
}

function maskSensitive(obj: any, depth: number = 0): any {
  if (depth > 5 || obj == null) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((item) => maskSensitive(item, depth + 1))
  const result: any = {}
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '***'
    } else {
      result[key] = maskSensitive(obj[key], depth + 1)
    }
  }
  return result
}

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

  (async () => {
    const user: any = decoded
    if (user.roleId) {
      try {
        user.permCodes = await loadRolePermissionCodes(user.roleId)
      } catch (err: any) {
        logger.warn('[authRequired] 加载用户权限失败:', err.message)
        user.permCodes = new Set()
      }
    } else {
      user.permCodes = new Set()
    }
    ;(req as any).user = user
    next()
  })()
}

/**
 * 权限校验中间件
 * @param permCode - 权限编码
 */
export function permissionRequired(permCode: string) {
  return (req: Request, res: Response, next: NextFunction): any => {
    const user = (req as any).user
    if (!user) {
      return fail(res, '用户未登录', ErrorCode.UNAUTHORIZED)
    }
    const permCodes: Set<string> = user.permCodes || new Set()
    let hasPermission = permCodes.has(permCode)
    if (!hasPermission) {
      const parts = permCode.split(':')
      for (let i = parts.length - 1; i >= 1; i--) {
        const parentCode = parts.slice(0, i).join(':')
        if (permCodes.has(parentCode)) {
          hasPermission = true
          break
        }
      }
    }
    if (!hasPermission) {
      logger.warn('[permissionRequired] 权限不足', { userId: user.userId, username: user.username, requiredPerm: permCode, url: req.originalUrl })
      return fail(res, `权限不足，缺少权限: ${permCode}`, ErrorCode.PERMISSION_DENIED)
    }
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

        let bodyContent = ''
        if (req.body && Object.keys(req.body).length > 0) {
          try {
            bodyContent = JSON.stringify(maskSensitive(req.body))
          } catch (e) {
            bodyContent = '[无法序列化的请求体]'
          }
        }

        OperationLog.create({
          user_id: userInfo.userId || null,
          username: userInfo.username || '匿名',
          module,
          operation: `${action} ${module}`,
          method: req.method,
          params: req.originalUrl || req.url || '',
          content: bodyContent || null,
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
