/**
 * 权限引擎 V2 — 功能权限中间件
 *
 * 替代原 auth.ts 里的 permissionRequired() 函数，用法变为 Express 中间件：
 *
 *   // 旧写法（直接函数调用）:
 *   router.get('/orders', authRequired, permissionRequired('production:order:view'), controller.list)
 *
 *   // 新写法（Express 中间件链）:
 *   router.get('/orders', authRequired, requirePerm({ permCode: 'production:order:view' }), controller.list)
 *   router.post('/orders', authRequired, requirePerm({ permCode: ['production:order:create', 'production:order:update'], logic: 'ANY' }), controller.save)
 *
 * 核心逻辑（V2 — 复用 auth.ts 已注入的权限码，不重复查 DB）：
 *   1. authRequired 中间件已完成 JWT 校验 → 注入 req.user.permCodes(Set)、roleId、username
 *   2. requirePerm 直接从 req.user 读取，零 DB 查询、零额外缓存
 *   3. '*' 通配符自动放行
 *   4. 仅当 req.user.permCodes 为空/不存在时，才 fallback 到 loadUserPermCodes()（兜底）
 */

import type { Request, Response, NextFunction } from 'express'
import { fail, ErrorCode } from '../../../utils/response.js'
import { getCache, setCache, TTL } from '../cache/permissionCache.js'
import { Permission, Role, User } from '../../../models/index.js'
import { logger } from '../../../utils/logger.js'
import type { RequirePermOptions } from '../types.js'

const WILDCARD = '*'

// ============================================================================
// 兜底：首次加载用户权限码全集（带缓存）
// 仅当 authRequired 未注入 req.user.permCodes 时才调用
// ============================================================================

async function loadUserPermCodes(userId: number): Promise<{
  permCodes: Set<string>
  roleId: number | null
  roleCode: string | null
  roleName: string | null
  username: string
}> {
  const CACHE_KEY = `permCodes:${userId}`
  const cached = getCache<{ permCodes: Set<string>; roleId: number | null; roleCode: string | null; roleName: string | null; username: string }>(CACHE_KEY)
  if (cached) return cached

  const user = await User.findByPk(userId, {
    attributes: ['user_id', 'username', 'role_id'],
    include: [
      {
        model: Role,
        as: 'role',
        attributes: ['role_id', 'role_code', 'role_name'],
        include: [{ model: Permission, as: 'permissions', attributes: ['perm_code'] }],
      },
    ],
  })

  const permCodes = new Set<string>()
  let roleId: number | null = null
  let roleCode: string | null = null
  let roleName: string | null = null
  let username = ''

  if (user) {
    username = user.username
    roleId = user.role_id
    const u: any = user
    if (u.role) {
      roleCode = u.role.role_code ?? null
      roleName = u.role.role_name ?? null
      const perms = u.role.permissions ?? []
      for (const p of perms) {
        if (p?.perm_code) permCodes.add(p.perm_code)
      }
    }
  }

  const result = { permCodes, roleId, roleCode, roleName, username }
  setCache(CACHE_KEY, result, TTL.permCodes)
  return result
}

// ============================================================================
// Express 中间件工厂 — V2 复用 req.user.permCodes
// ============================================================================

export function requirePerm(options: RequirePermOptions | string): RequestHandler {
  const opts: RequirePermOptions = typeof options === 'string' ? { permCode: options } : options
  const required = Array.isArray(opts.permCode) ? opts.permCode : [opts.permCode]
  const logic = opts.logic ?? 'ALL'

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user: any = (req as any).user
    if (!user) {
      fail(res, '未登录', ErrorCode.UNAUTHORIZED)
      return
    }

    const userId: number | undefined = user.userId ?? user.user_id ?? user.id
    if (!userId) {
      fail(res, '用户信息缺失', ErrorCode.UNAUTHORIZED)
      return
    }

    try {
      // ==== V2 核心：优先复用 authRequired 已注入的 req.user.permCodes ====
      let permCodes: Set<string> | undefined = user.permCodes
      let roleId: number | null = user.roleId ?? null
      let roleCode: string | null = user.roleCode ?? null
      let roleName: string | null = user.roleName ?? null
      const username: string = user.username ?? ''

      if (!permCodes || !(permCodes instanceof Set)) {
        // authRequired 没注入或注入异常 — fallback 兜底加载一次
        logger.debug(`[V2Auth] req.user.permCodes 缺失，fallback loadUserPermCodes userId=${userId}`)
        const loaded = await loadUserPermCodes(userId)
        permCodes = loaded.permCodes
        roleId = loaded.roleId
        roleCode = loaded.roleCode
        roleName = loaded.roleName
      }

      // '*' 通配符直接放行
      if (permCodes.has(WILDCARD)) {
        injectContext(req, { userId, roleId, roleCode, roleName, username, permCodes })
        next()
        return
      }

      const check = logic === 'ALL'
        ? required.every(pc => permCodes!.has(pc))
        : required.some(pc => permCodes!.has(pc))

      if (!check) {
        logger.warn(`[V2Auth] ${username}(${userId}) 无权限 ${logic}: ${required.join(',')} url=${req.originalUrl}`)
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
