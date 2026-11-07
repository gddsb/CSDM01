import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt.js'
import { fail, ErrorCode } from '../utils/response.js'
import { OperationLog, Role, Permission } from '../models/index.js'
import { logger } from '../utils/logger.js'

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'pwd', 'access_token', 'refresh_token']

const PERM_CACHE_TTL = 60_000
// Phase 2: cache key 从 roleId 升级为 roleId_terminal（不同终端权限独立缓存）
const permCache: Record<string, { codes: Set<string>; roleCode: string | null; roleName: string | null; ts: number }> = {}

/** 超级管理员通配符：角色在 role_permission 里手动配了 '*' 就拥有全部权限 */
export const WILDCARD_PERM = '*'

/** 权限码语义后缀分类（用于分层联动：view 类联动、action 类不联动） */
const VIEW_SUFFIXES = new Set([
  'view', 'list', 'dashboard', 'oee', 'inspection', 'check-record',
  'statistics', 'stats', 'document', 'history', 'plan', 'matrix',
])
const ACTION_SUFFIXES = new Set([
  'create', 'update', 'delete', 'assign', 'approve', 'submit',
  'start', 'skip', 'batch_submit', 'generate', 'cleanup',
  'stock_in', 'stock_out', 'stock_adjust', 'upload', 'close',
])

function isViewLike(permCode: string): boolean {
  const last = permCode.split(':').pop() ?? ''
  return VIEW_SUFFIXES.has(last)
}

function isActionLike(permCode: string): boolean {
  const last = permCode.split(':').pop() ?? ''
  return ACTION_SUFFIXES.has(last)
}

/**
 * 加载某角色在指定终端下的权限码集合（带 60s LRU 缓存）
 * Phase 2: 加 terminal 终端维度，cache key = roleId_terminal
 */
async function loadRolePermissionCodes(roleId: number, terminal: number = 1): Promise<{ codes: Set<string>; roleCode: string | null; roleName: string | null }> {
  const now = Date.now()
  const cacheKey = `${roleId}_${terminal}`
  const cached = permCache[cacheKey]
  if (cached && now - cached.ts < PERM_CACHE_TTL) {
    return { codes: cached.codes, roleCode: cached.roleCode, roleName: cached.roleName }
  }

  const role = await Role.findOne({
    where: { role_id: roleId },
    attributes: ['role_id', 'role_code', 'role_name'],
    include: [
      {
        model: Permission,
        as: 'permissions',
        attributes: ['perm_code'],
        through: { where: { terminal } },
      },
    ],
  })

  const roleCode = role ? String((role as any).role_code ?? '') : null
  const roleName = role ? String((role as any).role_name ?? '') : null
  const codes = new Set<string>()

  // 统一从 role_permission 关联表读取所有权限码（包括 '*' 通配）
  if (role && Array.isArray((role as any).permissions)) {
    for (const p of (role as any).permissions) {
      if (p?.perm_code) codes.add(p.perm_code)
    }
  }

  permCache[cacheKey] = { codes, roleCode, roleName, ts: now }
  return { codes, roleCode, roleName }
}

/**
 * 清除权限缓存
 * Phase 2: 加 terminal 参数
 *   - 只传 roleId: 清除该角色所有终端的缓存
 *   - 传 roleId + terminal: 只清除该角色该终端的缓存（推荐，范围最小）
 *   - 不传参数: 清除全部缓存
 */
export function clearPermissionCache(roleId?: number, terminal?: number): void {
  if (roleId !== undefined && terminal !== undefined) {
    const key = `${roleId}_${terminal}`
    delete permCache[key]
  } else if (roleId !== undefined) {
    // 清除该角色所有终端的缓存
    for (const key of Object.keys(permCache)) {
      if (key.startsWith(`${roleId}_`)) delete permCache[key]
    }
  } else {
    for (const key of Object.keys(permCache)) delete permCache[key]
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
 * 核心权限判定：通配反转 + 子→父继承
 * - 配了子权限 → 自动拥有父级入口权限（例：device:fault:create → 自动有 device:fault 菜单）
 * - 配了父权限 **不自动放权** 给子级（从根本上解决"父级=全 CRUD"的粗糙问题）
 * - '*' 通配优先匹配（超级管理员显式配置）
 */
export function checkPermission(
  permCodes: Set<string>,
  required: string,
  opts: { platform?: 'pc' | 'mobile' | 'all'; allowLegacy?: boolean } = {},
): boolean {
  if (permCodes.has(WILDCARD_PERM)) return true

  const { platform, allowLegacy = true } = opts

  // 候选码列表：按优先级从高到低匹配
  const candidates: string[] = []
  if (platform && platform !== 'all') {
    candidates.push(`${platform}:${required}`)
    // 分层联动：view 类（device:fault:view）查 all:，action 类（device:fault:create）不查 all:
    if (isViewLike(required)) {
      candidates.push(`all:${required}`)
    }
  } else if (platform === 'all') {
    candidates.push(`all:${required}`)
  }
  // 向后兼容：老权限码不带 platform 前缀
  if (allowLegacy) {
    candidates.push(required)
    // 去掉 platform 前缀：pc:device:fault:view → device:fault:view
    const stripped = required.replace(/^(all|pc|mobile):/, '')
    if (stripped !== required) {
      candidates.push(stripped)
      // 更旧父级码：device:fault:view → device:fault
      const parts = stripped.split(':')
      if (parts.length >= 3) candidates.push(parts.slice(0, 2).join(':'))
    }
  }

  // 精确匹配
  for (const c of candidates) {
    if (permCodes.has(c)) return true
  }

  // 子→父继承：codes 里的某个码如果比 required 更细（以 required 为前缀），自动通过
  // 例：codes 有 pc:device:fault:view → 自动通过 pc:device:fault（菜单入口）
  //     codes 有 device:fault:create → 自动通过 device:fault（菜单入口）
  for (const code of permCodes) {
    for (const c of candidates) {
      if (code.startsWith(c + ':') || code.startsWith(c + '.')) return true
    }
  }

  return false
}

/**
 * 检测请求平台（用于 platformAwarePermissionRequired）
 * 优先级：Header X-Client-Platform > ?platform= > User-Agent(Capacitor) > query.mobile=1
 */
function detectRequestPlatform(req: Request): 'pc' | 'mobile' | 'web' {
  const hdr = (req.headers['x-client-platform'] as string)?.toLowerCase()
  if (hdr === 'mobile' || hdr === 'pc' || hdr === 'web') return hdr as any
  const ua = (req.headers['user-agent'] || '').toLowerCase()
  if (/capacitor|android|ios|mobiledevice/i.test(ua)) return 'mobile'
  const url = (req as any).url ?? ''
  if (url.includes('mobile=1')) return 'mobile'
  return 'pc'
}

/**
 * JWT 认证中间件
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

  ;(async () => {
    const user: any = decoded
    // Phase 2: 提取 terminal 终端标识
    // 1. 优先从 JWT payload 读（登录时写入）
    // 2. 没有则从 platform 推断（pc→1, mobile→2, web→1）
    // 3. 最终 fallback 1（PC 端）
    const platform = detectRequestPlatform(req)
    const terminal = user.terminal ?? (platform === 'mobile' ? 2 : 1)

    if (user.roleId) {
      try {
        const { codes, roleCode, roleName } = await loadRolePermissionCodes(user.roleId, terminal)
        user.permCodes = codes
        user.roleCode = roleCode
        user.roleName = roleName
        user.isSuperAdmin = codes.has(WILDCARD_PERM)
      } catch (err: any) {
        logger.warn('[authRequired] 加载用户权限失败:', err.message)
        user.permCodes = new Set()
      }
    } else {
      user.permCodes = new Set()
    }
    // Phase 2: terminal 注入 req.user，供后续中间件（requirePerm / datascope）使用
    user.terminal = terminal
    // 平台检测结果挂到 req 上，后续 permissionRequired 可以读
    ;(req as any).platform = platform
    ;(req as any).terminal = terminal
    ;(req as any).user = user
    next()
  })()
}

/**
 * 基础权限校验：向后兼容旧调用（不带 platform，纯模块码匹配）
 */
export function permissionRequired(permCode: string) {
  return (req: Request, res: Response, next: NextFunction): any => {
    const user = (req as any).user
    if (!user) return fail(res, '用户未登录', ErrorCode.UNAUTHORIZED)
    if (checkPermission(user.permCodes || new Set(), permCode)) return next()
    logger.warn('[permissionRequired] 权限不足', { userId: user.userId, username: user.username, requiredPerm: permCode, url: req.originalUrl })
    return fail(res, `权限不足，缺少权限: ${permCode}`, ErrorCode.PERMISSION_DENIED)
  }
}

/**
 * 平台感知权限校验：自动根据请求来源（Capacitor / ?mobile=1 / 默认 PC）决定查 pc: / mobile: / all:
 * 分层联动规则：view 类自动回退 all:（两端联动），action 类不回退（PC 配了不自动传移动端）
 */
export function platformAwarePermissionRequired(permCode: string) {
  return (req: Request, res: Response, next: NextFunction): any => {
    const user = (req as any).user
    if (!user) return fail(res, '用户未登录', ErrorCode.UNAUTHORIZED)
    const platform: 'pc' | 'mobile' | 'web' = (req as any).platform ?? 'pc'
    // web 视为 pc 处理（WebView 里的浏览器端 = PC）
    const effective: 'pc' | 'mobile' = platform === 'mobile' ? 'mobile' : 'pc'
    if (checkPermission(user.permCodes || new Set(), permCode, { platform: effective })) return next()
    logger.warn('[platformAwarePermissionRequired] 权限不足', { userId: user.userId, requiredPerm: permCode, platform: effective, url: req.originalUrl })
    return fail(res, `权限不足（${effective}端），缺少权限: ${permCode}`, ErrorCode.PERMISSION_DENIED)
  }
}

/**
 * 操作日志记录中间件
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
          logger.error('[logOperation] 记录操作日志失败:', err.message)
        })
      } catch (err: any) {
        logger.error('[logOperation] 记录操作日志异常:', err.message)
      }
    })
    next()
  }
}

export default {
  authRequired,
  permissionRequired,
  platformAwarePermissionRequired,
  logOperation,
  checkPermission,
  WILDCARD_PERM,
}
