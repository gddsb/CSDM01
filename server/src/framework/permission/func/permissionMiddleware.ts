/**
 * 权限引擎 V2 — 功能权限中间件
 *
 * Phase 2 关键改造：所有权限码加载都带 terminal 终端维度
 *
 * 用法：
 *   router.get('/orders', authRequired, requirePerm({ permCode: 'production:order:view' }), controller.list)
 *
 * 终端来源优先级：
 *   1. req.user.terminal（JWT payload 中写入）
 *   2. req.platform（authRequired 中间件检测推断）
 *   3. 默认 terminal=1（PC 端）
 */

import type { Request, Response, NextFunction } from 'express'
import { fail, ErrorCode } from '../../../utils/response.js'
import { getCache, setCache, TTL } from '../cache/permissionCache.js'
import { Permission, Role, User } from '../../../models/index.js'
import { PermissionEngine } from '../../../services/PermissionEngine.js'
import { logger } from '../../../utils/logger.js'
import type { RequirePermOptions } from '../types.js'

const WILDCARD = '*'

// ============================================================================
// 工具函数：加载用户权限码全集（带缓存 + terminal 终端维度）
// ============================================================================

async function loadUserPermCodes(userId: number, terminal: number = 1): Promise<{
  permCodes: Set<string>
  roleId: number | null
  roleCode: string | null
  roleName: string | null
  username: string
}> {
  // Phase 2: cache key 加 terminal 维度，避免不同终端权限串缓存
  const CACHE_KEY = `permCodes:${userId}:${terminal}`
  const cached = getCache<{ permCodes: Set<string>; roleId: number | null; roleCode: string | null; roleName: string | null; username: string }>(CACHE_KEY)
  if (cached) return cached

  // 先查 user + role 基础信息
  const user = await User.findByPk(userId, { attributes: ['user_id', 'username', 'role_id'] })
  let roleId: number | null = null
  let roleCode: string | null = null
  let roleName: string | null = null
  let username = ''

  if (user) {
    username = user.username
    roleId = user.role_id
    if (user.role_id) {
      const role = await Role.findByPk(user.role_id, { attributes: ['role_id', 'role_code', 'role_name'] })
      if (role) {
        roleCode = (role as any).role_code ?? null
        roleName = (role as any).role_name ?? null
      }
    }
  }

  // Phase 3: 用 PermissionEngine 计算最终权限（rolePerms | addPerms & ~denyPerms）
  let permCodes = new Set<string>()
  if (roleId) {
    const finalCodes = await PermissionEngine.computeFinalPerms(userId, terminal)
    permCodes = new Set(finalCodes)
  }

  const result = { permCodes, roleId, roleCode, roleName, username }
  setCache(CACHE_KEY, result, TTL.permCodes)
  return result
}

// ============================================================================
// Express 中间件工厂
// ============================================================================

export function requirePerm(options: RequirePermOptions | string): RequestHandler {
  const opts: RequirePermOptions = typeof options === 'string' ? { permCode: options } : options
  const required = Array.isArray(opts.permCode) ? opts.permCode : [opts.permCode]
  const logic = opts.logic ?? 'ALL'

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 必须先经过 authRequired — req.user 应该存在
    if (!(req as any).user) {
      fail(res, '未登录', ErrorCode.UNAUTHORIZED)
      return
    }

    const userId = (req as any).user.userId ?? (req as any).user.user_id ?? (req as any).user.id
    if (!userId) {
      fail(res, '用户信息缺失', ErrorCode.UNAUTHORIZED)
      return
    }

    // Phase 2: 从 req.user.terminal 取终端值（authRequired 已注入）
    // 优先 JWT payload 中的 terminal，其次 req.terminal（authRequired 注入），最后默认 1
    const terminal = (req as any).user?.terminal ?? (req as any).terminal ?? 1

    try {
      const { permCodes, roleId, roleCode, roleName, username } = await loadUserPermCodes(userId, terminal)

      // '*' 通配符直接放行
      if (permCodes.has(WILDCARD)) {
        injectContext(req, { userId, roleId, roleCode, roleName, username, permCodes })
        next()
        return
      }

      const check = logic === 'ALL'
        ? required.every(pc => permCodes.has(pc))
        : required.some(pc => permCodes.has(pc))

      if (!check) {
        logger.warn(`[V2Auth] ${username}(${userId}) 无权限 ${logic}: ${required.join(',')}`)
        fail(res, `权限不足，需要: ${required.join(',')}`, ErrorCode.PERMISSION_DENIED)
        return
      }

      injectContext(req, { userId, roleId, roleCode, roleName, username, permCodes })
      next()
    } catch (err) {
      logger.error('[V2Auth] requirePerm 执行异常:', err)
      fail(res, '权限校验异常', ErrorCode.SYSTEM_ERROR)
    }
  }
}

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

function injectContext(
  req: Request,
  ctx: { userId: number; roleId: number | null; roleCode: string | null; roleName: string | null; username: string; permCodes: Set<string> }
) {
  req.permV2 = {
    ...ctx,
    scopeType: 'all', // 默认值，datascope 中间件会覆盖
  }
}

// ============================================================================
// 便捷写法：直接传权限码
// ============================================================================

/** 单个权限码快捷写法：requirePermCode('production:order:view') */
export function requirePermCode(permCode: string): RequestHandler {
  return requirePerm({ permCode })
}

/** 任意匹配快捷写法（如"具备任一按钮即可查看列表"） */
export function requireAnyPerm(...permCodes: string[]): RequestHandler {
  return requirePerm({ permCode: permCodes, logic: 'ANY' })
}

export { loadUserPermCodes }
