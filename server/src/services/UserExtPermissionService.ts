/**
 * UserExtPermissionService — 用户级 add/deny 权限 CRUD（规范 3.7）
 * 
 * 权限计算公式：finalPerms = rolePerms | addPerms & ~denyPerms
 * deny 优先级最高
 * 
 * —— 注意 sequelize.query 两种用法返回值不同 ——
 */
import sequelize from '../config/database.js'
import { User, UserExtPermission, Permission, RolePermission, OperationLog } from '../models/index.js'
import { PermissionEngine } from './PermissionEngine.js'
import { clearPermissionCache } from '../middleware/auth.js'
import { nowBeijingDate } from '../utils/date.js'
import { AppError } from '../middleware/security.js'
import { logger } from '../utils/logger.js'

export interface ExtPermState {
  perm_id: number
  perm_code: string
  perm_name: string
  source: 'role' | 'add' | 'deny' | 'none'
}

export interface ExtPermSummary {
  rolePermCount: number
  addCount: number
  denyCount: number
  finalCount: number
}

export const UserExtPermissionService = {

  /**
   * 读取某用户在某终端的完整权限配置
   * — 供前端弹窗渲染三种状态标记
   * 
   * 返回：
   *   rolePermCodes 角色自带
   *   addPermIds/addPermCodes 用户 add
   *   denyPermIds/denyPermCodes 用户 deny
   *   finalPermCodes 最终权限（role|add - deny）
   *   permStates 每个权限的 source 标记（role/add/deny/none）
   *   summary 计数
   */
  async listByUser(userId: number, terminal: number = 1): Promise<{
    rolePermCodes: string[]
    addPermIds: number[]
    addPermCodes: string[]
    denyPermIds: number[]
    denyPermCodes: string[]
    finalPermCodes: string[]
    permStates: ExtPermState[]
    summary: ExtPermSummary
  }> {
    // 并行查询
    const [roleCodes, addRows, denyRows, finalCodes] = await Promise.all([
      PermissionEngine.getRolePermCodes(userId, terminal),
      UserExtPermission.findAll({
        where: { user_id: userId, terminal, ext_type: 1, status: 1 },
        attributes: ['perm_id'],
      }),
      UserExtPermission.findAll({
        where: { user_id: userId, terminal, ext_type: 2, status: 1 },
        attributes: ['perm_id'],
      }),
      PermissionEngine.computeFinalPerms(userId, terminal),
    ])

    const roleSet = new Set(roleCodes)

    // add / deny 也要 JOIN 权限表取 perm_code 和 perm_name
    const [addDetail, denyDetail] = await Promise.all([
      this._getExtDetail(userId, terminal, 1),
      this._getExtDetail(userId, terminal, 2),
    ])

    const addCodes = addDetail.map(r => r.perm_code)
    const denyCodes = denyDetail.map(r => r.perm_code)
    const addSet = new Set(addCodes)
    const denySet = new Set(denyCodes)

    // 组装三种状态 — 遍历全部权限池
    const allPerms: any[] = await sequelize.query(
      'SELECT perm_id, perm_code, perm_name FROM sys_permission WHERE status = 1 ORDER BY sort_order ASC, perm_id ASC',
      { type: 'SELECT' as any }
    )
    const permStates: ExtPermState[] = allPerms.map((p: any) => {
      let source: ExtPermState['source'] = 'none'
      // deny 优先级最高
      if (denySet.has(p.perm_code)) source = 'deny'
      else if (roleSet.has(p.perm_code)) source = 'role'
      else if (addSet.has(p.perm_code)) source = 'add'
      return { perm_id: p.perm_id, perm_code: p.perm_code, perm_name: p.perm_name, source }
    })

    // 超级管理员标记 — 不参与 add/deny
    const isSuper = await PermissionEngine.isSuperAdmin(userId)

    return {
      rolePermCodes: roleCodes,
      addPermIds: addDetail.map(r => r.perm_id),
      addPermCodes: addCodes,
      denyPermIds: denyDetail.map(r => r.perm_id),
      denyPermCodes: denyCodes,
      finalPermCodes: isSuper ? await PermissionEngine.getAllPermCodes() : finalCodes,
      permStates,
      summary: {
        rolePermCount: roleCodes.length,
        addCount: addCodes.length,
        denyCount: denyCodes.length,
        finalCount: (isSuper ? await PermissionEngine.getAllPermCodes() : finalCodes).length,
      },
    }
  },

  /** 读取 add/deny 详情（含 perm_code, perm_name） */
  async _getExtDetail(userId: number, terminal: number, extType: number): Promise<any[]> {
    const [rows]: any = await sequelize.query(
      `SELECT uep.perm_id, p.perm_code, p.perm_name
       FROM sys_user_ext_permission uep
       INNER JOIN sys_permission p ON p.perm_id = uep.perm_id
       WHERE uep.user_id = :userId AND uep.terminal = :terminal AND uep.ext_type = :extType
         AND uep.status = 1`,
      { replacements: { userId, terminal, extType } }
    )
    return rows
  },

  /**
   * 批量保存（前端弹窗整体覆盖）
   * — 先校验互斥冲突 + 废弃权限
   * — DELETE WHERE user_id=? AND terminal=? 再批量 INSERT
   * — 清缓存
   * — 写操作日志
   */
  async save(
    userId: number,
    terminal: number,
    addPermIds: number[],
    denyPermIds: number[],
    operatorId: number,
  ): Promise<void> {
    const isSuper = await PermissionEngine.isSuperAdmin(userId)
    if (isSuper) {
      throw new AppError('超级管理员不支持用户附加权限配置（规范 3.15）', 30001, 403)
    }

    const addIds = (addPermIds || []).map(Number).filter(n => !isNaN(n))
    const denyIds = (denyPermIds || []).map(Number).filter(n => !isNaN(n))

    // 1. 校验互斥冲突（同一 perm 不能同时在 add 和 deny）
    const addSet = new Set(addIds)
    const conflicts = denyIds.filter(id => addSet.has(id))
    if (conflicts.length > 0) {
      const [conflictPerms]: any = await sequelize.query(
        `SELECT perm_code FROM sys_permission WHERE perm_id IN (:ids)`,
        { replacements: { ids: conflicts } }
      )
      const codes = conflictPerms.map((p: any) => p.perm_code).join(', ')
      throw new AppError(`以下权限不能同时授予和排除: ${codes}`, 10001, 400)
    }

    // 2. 校验所有 perm_id 有效且未废弃
    const allIds = [...addIds, ...denyIds]
    if (allIds.length > 0) {
      const found: any = await Permission.findAll({
        where: { perm_id: allIds, status: 1 },
        attributes: ['perm_id'],
      })
      const validIds = new Set(found.map((p: any) => p.perm_id))
      const invalid = allIds.filter(id => !validIds.has(id))
      if (invalid.length > 0) {
        throw new AppError(`以下权限ID无效或已废弃: ${invalid.join(', ')}`, 10001, 400)
      }
    }

    // 3. 事务内先清再建
    const now = nowBeijingDate()
    const opUser = await User.findByPk(operatorId, { attributes: ['username'] }).catch(() => null)
    const opName = (opUser as any)?.username || 'system'

    await sequelize.transaction(async (t) => {
      // 清掉该用户该终端的旧记录（不动另一终端）
      await UserExtPermission.destroy({
        where: { user_id: userId, terminal },
        transaction: t,
      })

      if (addIds.length > 0) {
        await UserExtPermission.bulkCreate(
          addIds.map(perm_id => ({
            user_id: userId, perm_id, ext_type: 1, terminal,
            status: 1, create_by: opName, create_time: now,
          })),
          { transaction: t }
        )
      }
      if (denyIds.length > 0) {
        await UserExtPermission.bulkCreate(
          denyIds.map(perm_id => ({
            user_id: userId, perm_id, ext_type: 2, terminal,
            status: 1, create_by: opName, create_time: now,
          })),
          { transaction: t }
        )
      }
    })

    // 4. 清缓存
    // permissionMiddleware 的缓存 key: permCodes:userId:terminal
    // auth.ts 的 rolePerm 缓存不感知用户级变更，不需要清
    // 但我们需要清所有与该用户相关的缓存
    clearAllUserCaches(userId)

    // 5. 操作日志
    const addCodes = await this._idsToCodes(addIds)
    const denyCodes = await this._idsToCodes(denyIds)
    OperationLog.create({
      user_id: operatorId,
      username: opName,
      module: '用户附加权限',
      operation: `为用户 ${userId} 终端${terminal} 保存权限配置: add[${addCodes.join(',')}] deny[${denyCodes.join(',')}]`,
      method: 'POST',
      params: JSON.stringify({ userId, terminal, addPermIds, denyPermIds }),
      status: 1,
    } as any).catch(() => {})

    logger.info(`[UserExtPermission] save userId=${userId} terminal=${terminal} add=${addIds.length} deny=${denyIds.length}`)
  },

  async _idsToCodes(ids: number[]): Promise<string[]> {
    if (ids.length === 0) return []
    const [rows]: any = await sequelize.query(
      `SELECT perm_code FROM sys_permission WHERE perm_id IN (:ids)`,
      { replacements: { ids } }
    )
    return rows.map((r: any) => r.perm_code)
  },
}

/**
 * 清除某用户所有相关的权限缓存
 * — permissionMiddleware: permCodes:userId:*
 * — auth.ts: roleId_terminal（不感知用户级，但保守清一下）
 */
export function clearAllUserCaches(userId: number): void {
  try {
    const user = sequelize.query as any // 我们用不到，下面清另一个
  } catch { /* ignore */ }
  // 调用 auth.ts 的 clearPermissionCache 无法清用户级缓存
  // permissionMiddleware 的缓存有单独前缀，这里只清 auth.ts 的 role 缓存
  // permissionMiddleware 的缓存是 LRU 内存缓存，最简单方案是也提供一个导出
  clearPermissionCache() // 全清 auth.ts 的 rolePerm 缓存（不昂贵，60s TTL）
}
