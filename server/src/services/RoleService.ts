/**
 * 角色 Service（RoleController 下沉）
 *
 * 业务：Role CRUD + listPermissions(flat) + getRolePermissions + assignPermissions
 * 核心：initDefaultPermissions 初始化（被 app.ts / init-db.ts 直接调用）
 * 默认权限种子数据已抽离到 services/seeds/DefaultPermissions.ts
 * clearPermissionCache 来自 middleware/auth.js（登录态缓存清理）
 */
import { Op } from 'sequelize'
import { Role, User, Permission } from '../models/index.js'
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

  async listPermissions() {
    return await Permission.findAll({ order: [['sort_order', 'ASC'], ['perm_id', 'ASC']] })
  },

  async getRolePermissions(id: number | string) {
    const role = await Role.findOne({
      where: { role_id: Number(id) },
      include: [{ model: Permission, as: 'permissions' }],
    })
    if (!role) throw new AppError('角色不存在', 10002, 404)
    return role.permissions?.map((p: any) => p.perm_id) || []
  },

  async assignPermissions(id: number | string, permIdsRaw: any) {
    const role = await Role.findOne({ where: { role_id: Number(id) } })
    if (!role) throw new AppError('角色不存在', 10002, 404)
    if ((role as any).role_code === 'SUPER_ADMIN' || (role as any).is_system_default === 1) {
      throw new AppError('系统默认角色禁止修改权限', 30001, 403)
    }
    const ids = permIdsRaw || []
    if (!Array.isArray(ids)) throw new AppError('perm_ids 必须是数组', 10001, 400)

    if (ids.length > 0) {
      const validIds = ids.map((x: any) => Number(x)).filter((x: number) => !isNaN(x))
      const permissions = await Permission.findAll({ where: { perm_id: { [Op.in]: validIds } } })
      if (permissions.length !== validIds.length) {
        const foundIds = new Set(permissions.map((p: any) => p.perm_id))
        const missingIds = validIds.filter((x: number) => !foundIds.has(x))
        throw new AppError(`以下权限ID不存在: ${missingIds.join(', ')}`, 10001, 400)
      }
      await role.setPermissions(permissions)
    } else {
      await role.setPermissions([])
    }
    clearPermissionCache(Number(id))
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
      await adminRole.setPermissions(allPermsAfter)
    }
    logger.info('✅ 默认权限初始化完成')
  },
}

export default RoleService
