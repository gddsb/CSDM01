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
 * authRequired 每请求都调 computeFinalPerms（→ PermissionEngine），
 * 没有任何缓存时每请求 4~6 次 SQL。这里给结果加一层 60s 内存缓存，
 * key = permCodes:{userId}_{terminal}（terminal 区分 PC/mobile）。
 * 失效钩子由 permissionCache.ts 统一管理：
 *   - onRolePermissionChange → 清所有 permCodes:*
 *   - onUserScopeChange      → 清指定用户 permCodes
 *   - onDataScopeChange      → 清指定用户 permCodes
 * 业务代码（RoleService/UserExtPermissionService）CRUD 时已经在调这些钩子了。
 */

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
   */
  static async computeFinalPerms(userId: number, terminal: number = 1): Promise<string[]> {
    // L1: 内存缓存命中 → 直接返回（60s TTL）
    const cacheKey = `permCodes:${userId}_${terminal}`
    const cached = getCache<string[]>(cacheKey)
    if (cached) return cached

    const result = await PermissionEngine._computeFinalPermsRaw(userId, terminal)

    // L1: 写入缓存（失效钩子由 permissionCache.ts 统一管理）
    try { setCache(cacheKey, result, TTL.permCodes) } catch { /* ignore */ }
    return result
  }

  /** 原始计算逻辑（无缓存，真实 SQL 计算） */
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

  /** 超级管理员判定（role_code = super_admin） */
  static async isSuperAdmin(userId: number): Promise<boolean> {
    const user = await User.findByPk(userId, { attributes: ['role_id'] })
    if (!user?.role_id) return false
    const role = await Role.findByPk(user.role_id, { attributes: ['role_code'] })
    return String((role as any)?.role_code ?? '').toLowerCase() === 'super_admin'
  }

  /** 权限池全量（超级管理员用） */
  static async getAllPermCodes(): Promise<string[]> {
    const rows: any[] = await sequelize.query(
      'SELECT perm_code FROM sys_permission WHERE status = 1',
      { type: 'SELECT' as any }
    )
    return rows.map((r: any) => r.perm_code).filter(Boolean)
  }

  /**
   * 角色权限（raw SQL JOIN 避开 Sequelize through.where 陷阱）
   * 取该用户所属全部角色在该终端的权限并集
   */
  static async getRolePermCodes(userId: number, terminal: number): Promise<string[]> {
    const [rows]: any = await sequelize.query(
      `SELECT DISTINCT p.perm_code
       FROM sys_permission p
       INNER JOIN sys_role_permission rp ON rp.perm_id = p.perm_id AND rp.terminal = :terminal
       INNER JOIN sys_user u ON u.role_id = rp.role_id
       WHERE u.user_id = :userId AND u.status = 1 AND p.status = 1`,
      { replacements: { userId, terminal } }
    )
    return rows.map((r: any) => r.perm_code).filter(Boolean)
  }

  /** 用户级附加授予（ext_type=1） */
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

  /** 用户级附加排除（ext_type=2） */
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
   * 读取角色自带权限码集合（auth.ts authRequired 用）
   * 这是 role 级权限，不感知用户 add/deny
   * 返回值加了 '*' 通配符判定
   */
  static async getRolePermCodesByRoleId(roleId: number, terminal: number): Promise<string[]> {
    const [rows]: any = await sequelize.query(
      `SELECT p.perm_code
       FROM sys_permission p
       INNER JOIN sys_role_permission rp ON rp.perm_id = p.perm_id
       WHERE rp.role_id = :roleId AND rp.terminal = :terminal
       ORDER BY p.perm_code`,
      { replacements: { roleId, terminal } }
    )
    return rows.map((r: any) => r.perm_code).filter(Boolean)
  }
}
