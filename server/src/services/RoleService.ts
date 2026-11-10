/**
 * 角色 Service（RoleController 下沉）
 *
 * 业务：Role CRUD + listPermissions(flat) + getRolePermissions + assignPermissions
 * Phase 2 关键改造：所有权限读写都带 terminal 终端维度（规范 3.6）
 *   terminal=1 PC端 (默认)
 *   terminal=2 移动端APP
 *
 * 核心：initDefaultPermissions 初始化（被 app.ts / init-db.ts 直接调用）
 * 默认权限种子数据已抽离到 services/seeds/DefaultPermissions.ts
 * clearPermissionCache 来自 middleware/auth.js（登录态缓存清理）
 */
import { Op } from 'sequelize'
import { Role, User, Permission, RolePermission } from '../models/index.js'
import sequelize from '../config/database.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { clearPermissionCache } from '../middleware/auth.js'
import { defaultPermissions } from './seeds/DefaultPermissions.js'
import { logger } from "../utils/logger.js"

const LEGACY_PARENT_MAP: Record<number, string> = {
  1: 'system',
  3: 'system:role',
  10: 'basic',
  13: 'basic:line',
  14: 'basic:process',
  20: 'production',
  21: 'production:order',
  23: 'production:reporting',
  30: 'quality',
  37: 'quality:complaint',
  50: 'device',
  51: 'device:list',
  60: 'bigscreen',
  70: 'report',
}

export const RoleService = {
  async list(query: any) {
    const { keyword, status, page = 1, pageSize = 50 } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { role_name: { [Op.like]: `%${keyword}%` } },
        { role_code: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap: Record<string, number> = { '启用': 1, '禁用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await Role.findAndCountAll({
      where, limit, offset,
      order: [['sort_order', 'ASC'], ['role_id', 'DESC']],
    })
  },

  async create(body: any) {
    const { role_name, role_code } = body
    if (!role_name || !role_code) throw new AppError('角色名称和角色编码不能为空', 10001, 400)
    const exists = await Role.findOne({ where: { role_code } })
    if (exists) throw new AppError('角色编码已存在', 20001, 409)
    return await Role.create({
      ...body,
      sort_order: body.sort_order || 0,
      status: body.status !== undefined ? body.status : 1,
    } as any)
  },

  async update(id: number | string, body: any) {
    const role = await Role.findOne({ where: { role_id: Number(id) } })
    if (!role) throw new AppError('角色不存在', 10002, 404)
    if ((role as any).role_code === 'SUPER_ADMIN' || (role as any).is_system_default === 1) {
      throw new AppError('系统默认角色禁止编辑', 30001, 403)
    }
    if (body.role_code && body.role_code !== (role as any).role_code) {
      const exists = await Role.findOne({ where: { role_code: body.role_code, role_id: { [Op.ne]: Number(id) } } })
      if (exists) throw new AppError('角色编码已存在', 20001, 409)
    }
    await role.update({ role_name: body.role_name, role_code: body.role_code, type: body.type, scope: body.scope, sort_order: body.sort_order, status: body.status })
    clearPermissionCache(Number(id))
    return role
  },

  async remove(id: number | string) {
    const role = await Role.findOne({ where: { role_id: Number(id) } })
    if (!role) throw new AppError('角色不存在', 10002, 404)
    if ((role as any).role_code === 'SUPER_ADMIN' || (role as any).is_system_default === 1) {
      throw new AppError('系统默认角色禁止删除', 30001, 403)
    }
    const userCount = await User.count({ where: { role_id: Number(id) } })
    if (userCount > 0) throw new AppError(`该角色下存在 ${userCount} 个用户，无法删除`, 20001, 409)
    await role.destroy()
    return true
  },

  async detail(id: number | string) {
    const role = await Role.findByPk(Number(id))
    if (!role) throw new AppError('角色不存在', 10002, 404)
    return role
  },

  async listPermissions() {
    return await Permission.findAll({ order: [['sort_order', 'ASC'], ['perm_id', 'ASC']] })
  },

  /**
   * 读取某角色在指定终端下的权限 ID 列表
   * Phase 2: 加 terminal 终端维度（默认 1=PC 端）
   */
  async getRolePermissions(id: number | string, terminal: number = 1): Promise<number[]> {
    const role = await Role.findOne({
      where: { role_id: Number(id) },
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { where: { terminal } },
        },
      ],
    })
    if (!role) throw new AppError('角色不存在', 10002, 404)
    return (role as any).permissions?.map((p: any) => p.perm_id) || []
  },

  /**
   * 为某角色在指定终端下整体覆盖权限
   *
   * Migration 035 改造：实现三条权限规则 + 双端自动同步
   * ---------------------------------------------------------
   * 规则①  给控件/操作权限 → 自动授予页面查看权限（expandAncestors 父级祖先链补齐）
   * 规则②  多层级子页面控件权限 → 自动授予上级所有页面查看权限（expandAncestors 递归 parent_id）
   * 规则③  一端授权 → 自动同步到另一端（expandTerminal：perm_id 在两端共享时双写）
   *
   * expandTerminal 判定：SUPER_ADMIN(role_id=1) 的 role_permission 两端都有该 perm_id
   *   → 说明此 perm_id 双端都支持，自动同步
   *
   * 事务模式：清当前终端 + 写当前终端(含祖先链) + 清另一端 + 写另一端(仅共享码)
   */
  async assignPermissions(id: number | string, permIdsRaw: any, terminal: number = 1): Promise<boolean> {
    const role = await Role.findOne({ where: { role_id: Number(id) } })
    if (!role) throw new AppError('角色不存在', 10002, 404)
    if ((role as any).role_code === 'SUPER_ADMIN' || (role as any).is_system_default === 1) {
      throw new AppError('系统默认角色禁止修改权限', 30001, 403)
    }
    const rawIds = permIdsRaw || []
    if (!Array.isArray(rawIds)) throw new AppError('perm_ids 必须是数组', 10001, 400)
    const roleId = Number(id)
    const now = new Date()

    const validIds = rawIds.map((x: any) => Number(x)).filter((x: number) => !isNaN(x))

    // —— Step 1: 校验 ——
    if (validIds.length > 0) {
      const permissions = await Permission.findAll({ where: { perm_id: { [Op.in]: validIds } } })
      if (permissions.length !== validIds.length) {
        const foundIds = new Set(permissions.map((p: any) => p.perm_id))
        const missingIds = validIds.filter((x: number) => !foundIds.has(x))
        throw new AppError(`以下权限ID不存在: ${missingIds.join(', ')}`, 10001, 400)
      }
    }

    // —— Step 2: expandAncestors（规则①②）——
    // 递归查 parent_id 祖先链，补齐所有父级 perm_id
    const allIds = new Set<number>(validIds)
    let expandBatch = validIds.slice()
    let safetyCounter = 0
    while (expandBatch.length > 0 && safetyCounter < 20) {
      safetyCounter++
      const batchPerms = await Permission.findAll({
        where: { perm_id: { [Op.in]: expandBatch } },
        attributes: ['perm_id', 'parent_id'],
      })
      const nextBatch: number[] = []
      for (const p of batchPerms) {
        const pid = Number((p as any).parent_id) || 0
        if (pid > 0 && !allIds.has(pid)) {
          allIds.add(pid)
          nextBatch.push(pid)
        }
      }
      expandBatch = nextBatch
    }
    const finalIds = Array.from(allIds)

    // —— Step 3: expandTerminal（规则③）——
    // 查哪些 perm_id 在 SUPER_ADMIN 角色两端都存在（判定为双端共享）
    const otherTerminal = terminal === 1 ? 2 : 1
    let sharedIds: number[] = []
    if (finalIds.length > 0) {
      const superPcIds = await RolePermission.findAll({
        where: { role_id: 1, terminal: 1, perm_id: { [Op.in]: finalIds } },
        attributes: ['perm_id'],
      }).then(rs => rs.map((r: any) => r.perm_id))
      const superAppIds = await RolePermission.findAll({
        where: { role_id: 1, terminal: 2, perm_id: { [Op.in]: finalIds } },
        attributes: ['perm_id'],
      }).then(rs => rs.map((r: any) => r.perm_id))
      const pcSet = new Set(superPcIds), appSet = new Set(superAppIds)
      sharedIds = finalIds.filter(id => pcSet.has(id) && appSet.has(id))
    }

    // —— Step 4: 事务内双端写 ——
    await sequelize.transaction(async (t) => {
      await RolePermission.destroy({ where: { role_id: roleId, terminal }, transaction: t })
      if (finalIds.length > 0) {
        await RolePermission.bulkCreate(
          finalIds.map(pid => ({ role_id: roleId, perm_id: pid, terminal, create_time: now })),
          { transaction: t }
        )
      }
      await RolePermission.destroy({ where: { role_id: roleId, terminal: otherTerminal }, transaction: t })
      if (sharedIds.length > 0) {
        await RolePermission.bulkCreate(
          sharedIds.map(pid => ({ role_id: roleId, perm_id: pid, terminal: otherTerminal, create_time: now })),
          { transaction: t }
        )
      }
    })

    clearPermissionCache(roleId, terminal)
    clearPermissionCache(roleId, otherTerminal)
    return true
  },

  /** 启动时初始化默认权限菜单（被 app.ts / init-db.ts 直接调用） */
  async initDefaultPermissions() {
    const defaultCodes = defaultPermissions.map(p => p.perm_code)
    const codeToId: Record<string, number> = {}
    const topLevels = defaultPermissions.filter(p => p.parent_id === 0 && !(p as any).parent_code)
    for (const perm of topLevels) {
      const [record] = await Permission.findOrCreate({ where: { perm_code: perm.perm_code }, defaults: perm })
      codeToId[perm.perm_code] = record.perm_id
    }
    for (const perm of defaultPermissions) {
      if (!codeToId[perm.perm_code]) {
        const rec = await Permission.findOne({ where: { perm_code: perm.perm_code } })
        if (rec) codeToId[perm.perm_code] = rec.perm_id
      }
    }
    for (const perm of defaultPermissions) {
      if (topLevels.includes(perm)) continue
      const finalPerm: any = { ...perm }
      if (finalPerm.parent_code) {
        const parentId = codeToId[finalPerm.parent_code]
        if (parentId) {
          finalPerm.parent_id = parentId
        } else {
          const parentRec = await Permission.findOne({ where: { perm_code: finalPerm.parent_code } })
          if (parentRec) { finalPerm.parent_id = parentRec.perm_id; codeToId[finalPerm.parent_code] = parentRec.perm_id }
        }
      } else if (finalPerm.parent_id && LEGACY_PARENT_MAP[finalPerm.parent_id]) {
        const parentCode = LEGACY_PARENT_MAP[finalPerm.parent_id]
        const parentId = codeToId[parentCode] || (await Permission.findOne({ where: { perm_code: parentCode } }))?.perm_id
        if (parentId) { finalPerm.parent_id = parentId; codeToId[parentCode] = parentId }
      }
      const [record, created] = await Permission.findOrCreate({ where: { perm_code: perm.perm_code }, defaults: finalPerm })
      codeToId[perm.perm_code] = record.perm_id
      if (!created) {
        await record.update({
          perm_name: finalPerm.perm_name, parent_id: finalPerm.parent_id, icon: finalPerm.icon, path: finalPerm.path,
          sort_order: finalPerm.sort_order, type: finalPerm.type,
          visible: finalPerm.visible !== undefined ? finalPerm.visible : 1,
          status: finalPerm.status !== undefined ? finalPerm.status : 1,
          component: finalPerm.component || null,
        })
      }
    }
    // 清理废弃菜单
    const allPerms = await Permission.findAll()
    const toRemove = allPerms.filter((p: any) => !defaultCodes.includes(p.perm_code) && p.type === 'menu')
    if (toRemove.length > 0) {
      logger.info(`🧹 清理废弃菜单项: ${toRemove.map((p: any) => p.perm_name).join(', ')}`)
      await Permission.destroy({ where: { perm_id: { [Op.in]: toRemove.map((p: any) => p.perm_id) } } })
    }
    const adminRole = await Role.findOne({ where: { role_code: 'SUPER_ADMIN' } })
    if (adminRole) {
      const allPermsAfter = await Permission.findAll()
      const roleId = (adminRole as any).role_id
      // Phase 3: 超级管理员 PC + APP 两端都显式分配全量权限
      //           即使 PermissionEngine.isSuperAdmin 短路，也保证 role_permission 表里有数据
      //           → 排查问题时直接 SQL 能看到，不依赖短路逻辑
      for (const terminal of [1, 2]) {
        await RolePermission.destroy({ where: { role_id: roleId, terminal } })
        await RolePermission.bulkCreate(
          allPermsAfter.map((p: any) => ({
            role_id: roleId,
            perm_id: p.perm_id,
            terminal,
            create_time: new Date(),
          }))
        )
      }
      logger.info(`👑 超级管理员初始化: ${allPermsAfter.length} 条权限 × 2 终端 (terminal=1+PC / terminal=2+APP)`)
    }
    logger.info('✅ 默认权限初始化完成')
  },
}

export default RoleService
