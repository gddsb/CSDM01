/**
 * PermissionEngine — Phase 3 统一权限计算引擎
 * 
 * 替代散落在 AuthService / auth.ts / permissionMiddleware 三处的重复 raw SQL。
 * 三处调用点统一委托到此模块，确保权限计算公式唯一口径。
 * 
 * 核心公式（规范 2.4）：
 *   finalPerms(userId, terminal) = rolePerms | addPerms & ~denyPerms
 *   deny 优先级最高，命中 deny 即不可用
 * 
 * —— 注意 sequelize.query 两种用法返回值不同 ——
 *   带 type:'SELECT' → 直接返回 rows[]
 *   不带 type        → 返回 [rows, metadata] 二元组
 */
import sequelize from '../config/database.js'
import { Permission, RolePermission, Role, User } from '../models/index.js'
import { getCache, setCache, TTL } from '../framework/permission/cache/permissionCache.js'

/**
 * L1 内存缓存 — 三层结构：
 * 
 * Layer 1: computeFinalPerms 入口缓存（60s）
 *   key = permCodes:{userId}_{terminal}
 *   命中直接返回，跳过所有内部 SQL
 *   失效钩子由 permissionCache.ts 统一管理
 *     onRolePermissionChange → 清所有 permCodes:*
 *     onUserScopeChange      → 清指定用户 permCodes
 *     onDataScopeChange      → 清指定用户 permCodes
 * 
 * Layer 2: helper mini 缓存（就地 TTL）
 *   isSuperAdmin       → 独立 60s（多次被裸调，见 auth.ts:230 / UserExtPermissionService）
 *   getAllPermCodes    → 独立 120s（权限池极少变，超级管理员短路分支用）
 *   getRolePermCodes   → 独立 60s（被 UserExtPermissionService 裸调）
 *   getUserAddCodes / getUserDenyCodes → 不走独立缓存（只被 _computeFinalPermsRaw 内部调用，
 *                                        已被 Layer 1 入口缓存覆盖）
 *   getRolePermCodesByRoleId → 60s（auth.ts 注释说 authRequired 用，当前实际未用，
 *                                 但缓存开销接近零）
 * 
 * —— 为什么 Layer 2 不也用 permissionCache.ts 的 getCache/setCache ——
 *   因为这些 helper 缓存 key 分散（superAdmin:{userId} / allPermCodes / rolePermCodes:{uid}_{term}），
 *   放进 permissionCache.ts 反而会让统一失效钩子变复杂（需要知道哪些 key 前缀属于哪类失效）。
 *   就地 TTL 策略：到期自然过期，对权限变更最多 2 分钟延迟（可接受），
 *   比加钩子复杂度 + 漏钩子导致脏数据要好。
 */

// —— Layer 2: helper 就地缓存 ——
interface HelperCacheEntry<T> { at: number; value: T }
const _saCache = new Map<number, HelperCacheEntry<boolean>>()                       // isSuperAdmin  per userId
let _allPermsCache: HelperCacheEntry<string[]> | null = null  // getAllPermCodes 全局一份
const _rolePermCache = new Map<string, HelperCacheEntry<string[]>>()               // getRolePermCodes  per userId_terminal
const _rolePermByRoleIdCache = new Map<string, HelperCacheEntry<string[]>>()        // getRolePermCodesByRoleId  per roleId_terminal

const SA_TTL = 60_000
const ALLPERMS_TTL = 120_000
const ROLEPERM_TTL = 60_000

function isExpired<T>(entry: HelperCacheEntry<T> | null | undefined, ttlMs: number): boolean {
  return !entry || Date.now() - entry.at >= ttlMs
}

export class PermissionEngine {

  /**
   * 核心入口：计算指定用户在指定终端的最终权限码集合
   * 
   * 流程：
   * 1. 超级管理员短路 → 全量权限池
   * 2. 取 rolePerms (sys_role_permission JOIN sys_permission WHERE terminal=?)
   * 3. 取 addPerms (sys_user_ext_permission WHERE ext_type=1 AND terminal=?)
   * 4. 取 denyPerms (sys_user_ext_permission WHERE ext_type=2 AND terminal=?)
   * 5. final = rolePerms ∪ addPerms − denyPerms
   * 
   * —— 缓存策略（两层，双保险）——
   *   Layer 1 (入口): getCache `permCodes:{userId}_{terminal}` → 60s
   *   Layer 2 (helper): isSuperAdmin / getAllPermCodes / getRolePermCodes 各自 mini 缓存
   *                     即使 Layer 1 过期，Layer 2 仍能在 _computeFinalPermsRaw 内部省 SQL
   */
  static async computeFinalPerms(userId: number, terminal: number = 1): Promise<string[]> {
    // Layer 1: 入口缓存命中 → 直接返回（60s TTL，由 permissionCache.ts getCache/setCache）
    const cacheKey = `permCodes:${userId}_${terminal}`
    const cached = getCache<string[]>(cacheKey)
    if (cached) return cached

    const result = await PermissionEngine._computeFinalPermsRaw(userId, terminal)

    // Layer 1: 写入入口缓存
    try { setCache(cacheKey, result, TTL.permCodes) } catch { /* ignore */ }
    return result
  }

  /** 原始计算逻辑（无 Layer 1 入口缓存，但 Layer 2 helper 缓存仍生效） */
  private static async _computeFinalPermsRaw(userId: number, terminal: number): Promise<string[]> {
    // 1. 超级管理员短路：返回全量权限池 + 注入通配符 '*'
    //    通配符是 has('*') / includes('*') 等业务代码的核心判断标志
    if (await PermissionEngine.isSuperAdmin(userId)) {
      const allCodes = await PermissionEngine.getAllPermCodes()
      return ['*', ...allCodes]
    }

    // 2. 并行查 rolePerms + addPerms + denyPerms
    const [roleCodes, addCodes, denyCodes] = await Promise.all([
      PermissionEngine.getRolePermCodes(userId, terminal),
      PermissionEngine.getUserAddCodes(userId, terminal),
      PermissionEngine.getUserDenyCodes(userId, terminal),
    ])

    const denySet = new Set(denyCodes)
    const result: string[] = []

    // rolePerms ∪ addPerms − denyPerms
    for (const code of roleCodes) {
      if (!denySet.has(code)) result.push(code)
    }
    for (const code of addCodes) {
      if (!denySet.has(code)) result.push(code)
    }

    return Array.from(new Set(result)).sort()
  }

  /**
   * 超级管理员判定（role_code = super_admin）
   * 
   * Layer 2 缓存：60s，key=userId
   *   被以下裸调场景复用：
   *     - auth.ts:230 冗余调用（每请求额外多 1 次 SQL）
   *     - UserExtPermissionService.listByUser:97
   *     - UserExtPermissionService 其他路径
   *   缓存省的是这些"入口缓存过期后又单独裸调"的 SQL
   */
  static async isSuperAdmin(userId: number): Promise<boolean> {
    const cached = _saCache.get(userId)
    if (!isExpired(cached, SA_TTL)) return cached!.value

    const user = await User.findByPk(userId, { attributes: ['role_id'] })
    if (!user?.role_id) {
      _saCache.set(userId, { at: Date.now(), value: false })
      return false
    }
    const role = await Role.findByPk(user.role_id, { attributes: ['role_code'] })
    const result = String((role as any)?.role_code ?? '').toLowerCase() === 'super_admin'
    _saCache.set(userId, { at: Date.now(), value: result })
    return result
  }

  /**
   * 权限池全量（超级管理员短路分支 + UserExtPermissionService 裸调）
   * 
   * Layer 2 缓存：120s 全局一份（权限池极少变）
   *   sys_permission 新增/删除/改状态属于低频运维操作，120s 延迟可接受
   */
  static async getAllPermCodes(): Promise<string[]> {
    if (!isExpired(_allPermsCache, ALLPERMS_TTL)) return _allPermsCache!.value

    const rows: any[] = await sequelize.query(
      'SELECT perm_code FROM sys_permission WHERE status = 1',
      { type: 'SELECT' as any }
    )
    const result = rows.map((r: any) => r.perm_code).filter(Boolean)
    _allPermsCache = { at: Date.now(), value: result }
    return result
  }

  /**
   * 角色权限（raw SQL JOIN 避开 Sequelize through.where 陷阱）
   * 取该用户所属全部角色在该终端的权限并集
   * 
   * Layer 2 缓存：60s，key=userId_terminal
   *   被 UserExtPermissionService.listByUser:57 裸调复用
   */
  static async getRolePermCodes(userId: number, terminal: number): Promise<string[]> {
    const cacheKey = `${userId}_${terminal}`
    const cached = _rolePermCache.get(cacheKey)
    if (!isExpired(cached, ROLEPERM_TTL)) return cached!.value

    const [rows]: any = await sequelize.query(
      `SELECT DISTINCT p.perm_code
       FROM sys_permission p
       INNER JOIN sys_role_permission rp ON rp.perm_id = p.perm_id AND rp.terminal = :terminal
       INNER JOIN sys_user u ON u.role_id = rp.role_id
       WHERE u.user_id = :userId AND u.status = 1 AND p.status = 1`,
      { replacements: { userId, terminal } }
    )
    const result = rows.map((r: any) => r.perm_code).filter(Boolean)
    _rolePermCache.set(cacheKey, { at: Date.now(), value: result })
    return result
  }

  /** 用户级附加授予（ext_type=1） — 仅内部调用，不单独加缓存 */
  static async getUserAddCodes(userId: number, terminal: number): Promise<string[]> {
    const [rows]: any = await sequelize.query(
      `SELECT p.perm_code
       FROM sys_user_ext_permission uep
       INNER JOIN sys_permission p ON p.perm_id = uep.perm_id
       WHERE uep.user_id = :userId AND uep.ext_type = 1 AND uep.terminal = :terminal
         AND uep.status = 1 AND p.status = 1`,
      { replacements: { userId, terminal } }
    )
    return rows.map((r: any) => r.perm_code).filter(Boolean)
  }

  /** 用户级附加排除（ext_type=2） — 仅内部调用，不单独加缓存 */
  static async getUserDenyCodes(userId: number, terminal: number): Promise<string[]> {
    const [rows]: any = await sequelize.query(
      `SELECT p.perm_code
       FROM sys_user_ext_permission uep
       INNER JOIN sys_permission p ON p.perm_id = uep.perm_id
       WHERE uep.user_id = :userId AND uep.ext_type = 2 AND uep.terminal = :terminal
         AND uep.status = 1 AND p.status = 1`,
      { replacements: { userId, terminal } }
    )
    return rows.map((r: any) => r.perm_code).filter(Boolean)
  }

  /**
   * 读取角色自带权限码集合（role 级，不感知用户 add/deny）
   * 
   * Layer 2 缓存：60s，key=roleId_terminal
   *   auth.ts 注释说 authRequired 曾用这个，但当前实际已经不用了
   *   保留 + 加缓存：成本极低，未来恢复使用时直接生效
   */
  static async getRolePermCodesByRoleId(roleId: number, terminal: number): Promise<string[]> {
    const cacheKey = `${roleId}_${terminal}`
    const cached = _rolePermByRoleIdCache.get(cacheKey)
    if (!isExpired(cached, ROLEPERM_TTL)) return cached!.value

    const [rows]: any = await sequelize.query(
      `SELECT p.perm_code
       FROM sys_permission p
       INNER JOIN sys_role_permission rp ON rp.perm_id = p.perm_id
       WHERE rp.role_id = :roleId AND rp.terminal = :terminal
       ORDER BY p.perm_code`,
      { replacements: { roleId, terminal } }
    )
    const result = rows.map((r: any) => r.perm_code).filter(Boolean)
    _rolePermByRoleIdCache.set(cacheKey, { at: Date.now(), value: result })
    return result
  }

  /**
   * 主动失效所有 helper 缓存
   * 权限数据变更时调用（role_permission / user_ext_permission / sys_permission CRUD）
   * 业务层已经在调 permissionCache.ts 的 onRolePermissionChange 等钩子，
   * 那个会清 Layer 1 入口缓存；这里 Layer 2 helper 缓存同步清掉，保持两层一致
   */
  static invalidateAll(): void {
    _saCache.clear()
    _allPermsCache = null
    _rolePermCache.clear()
    _rolePermByRoleIdCache.clear()
  }
}
