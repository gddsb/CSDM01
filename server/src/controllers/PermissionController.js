import { Op } from 'sequelize'
import { Permission, Role, User } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 菜单/权限列表（树形结构）
export const list = async (req, res) => {
  try {
    const { keyword, status, type } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { perm_name: { [Op.like]: `%${keyword}%` } },
        { perm_code: { [Op.like]: `%${keyword}%` } },
        { path: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      where.status = Number(status)
    }
    if (type) where.type = type

    const rows = await Permission.findAll({
      where,
      order: [['sort_order', 'ASC'], ['perm_id', 'ASC']],
    })
    // 构建树形结构
    const buildTree = (list, parentId = 0) => {
      return list
        .filter(item => Number(item.parent_id) === Number(parentId))
        .map(item => {
          const children = buildTree(list, item.perm_id)
          return children.length > 0 ? { ...item.toJSON(), children } : item.toJSON()
        })
    }
    const tree = buildTree(rows)
    return success(res, tree, '查询成功', rows.length)
  } catch (err) {
    console.error('查询权限列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 权限详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const perm = await Permission.findOne({ where: { perm_id: id } })
    if (!perm) return fail(res, '菜单/权限不存在', 404)
    return success(res, perm, '查询成功')
  } catch (err) {
    console.error('查询权限详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建菜单/权限
export const create = async (req, res) => {
  try {
    const { perm_name, perm_code, type } = req.body
    if (!perm_name || !perm_code) {
      return fail(res, '菜单名称和权限编码不能为空')
    }
    const exists = await Permission.findOne({ where: { perm_code } })
    if (exists) return fail(res, '权限编码已存在')
    const payload = {
      ...req.body,
      type: type || 'menu',
      status: req.body.status !== undefined ? Number(req.body.status) : 1,
      sort_order: req.body.sort_order || 0,
      parent_id: req.body.parent_id || 0,
    }
    const perm = await Permission.create(payload)
    return success(res, perm, '创建成功')
  } catch (err) {
    console.error('创建权限失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改菜单/权限
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const perm = await Permission.findOne({ where: { perm_id: id } })
    if (!perm) return fail(res, '菜单/权限不存在', 404)
    if (req.body.perm_code && req.body.perm_code !== perm.perm_code) {
      const exists = await Permission.findOne({
        where: { perm_code: req.body.perm_code, perm_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '权限编码已存在')
    }
    // 防止将自身设为父级
    if (req.body.parent_id && Number(req.body.parent_id) === Number(id)) {
      return fail(res, '不能将自身设为父级菜单')
    }
    const payload = { ...req.body }
    if (payload.status !== undefined) payload.status = Number(payload.status)
    if (payload.parent_id !== undefined) payload.parent_id = Number(payload.parent_id) || 0
    await perm.update(payload)
    return success(res, perm, '修改成功')
  } catch (err) {
    console.error('修改权限失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除菜单/权限
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const perm = await Permission.findOne({ where: { perm_id: id } })
    if (!perm) return fail(res, '菜单/权限不存在', 404)
    // 检查是否有子节点
    const childCount = await Permission.count({ where: { parent_id: id } })
    if (childCount > 0) return fail(res, `存在 ${childCount} 个子菜单，无法删除`)
    await perm.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除权限失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 获取当前用户可见的菜单树（用于前端动态菜单渲染）
export const userMenu = async (req, res) => {
  try {
    const user = req.user
    // req.user 来自 JWT 解码，字段为 userId / roleId / username
    const roleId = user.roleId || user.role_id
    const userId = user.userId || user.user_id
    let role = null
    if (roleId) {
      role = await Role.findOne({
        where: { role_id: roleId },
        include: [{
          model: Permission,
          as: 'permissions',
          where: { status: 1, type: 'menu' },
          required: false,
        }],
      })
    }
    if (!role && userId) {
      // 退化路径：通过 userId 重新查关联角色
      const u = await User.findOne({
        where: { user_id: userId },
        include: [{
          model: Role,
          as: 'role',
          include: [{
            model: Permission,
            as: 'permissions',
            where: { status: 1, type: 'menu' },
            required: false,
          }],
        }],
      })
      role = u?.role || null
    }
    let perms = []
    let roleCode = null
    if (role) {
      roleCode = role.role_code
      if (role.permissions) {
        perms = role.permissions
      }
    }
    // 超级管理员或角色无权限配置时，返回所有启用菜单（兜底）
    if (perms.length === 0) {
      if (roleCode === 'SUPER_ADMIN') {
        perms = await Permission.findAll({
          where: { status: 1, type: 'menu' },
          order: [['sort_order', 'ASC'], ['perm_id', 'ASC']],
        })
      }
    }
    // 统一按 sort_order 排序（include 关联查询不会保留排序）
    perms = perms.slice().sort((a, b) => {
      const sa = Number(a.sort_order) || 0
      const sb = Number(b.sort_order) || 0
      if (sa !== sb) return sa - sb
      return Number(a.perm_id) - Number(b.perm_id)
    })
    // 构建树形结构
    const buildTree = (list, parentId = 0) => {
      return list
        .filter(item => Number(item.parent_id) === Number(parentId))
        .map(item => {
          const children = buildTree(list, item.perm_id)
          return children.length > 0 ? { ...item.toJSON(), children } : item.toJSON()
        })
    }
    const tree = buildTree(perms)
    return success(res, tree, '查询成功')
  } catch (err) {
    console.error('查询用户菜单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove, userMenu }
