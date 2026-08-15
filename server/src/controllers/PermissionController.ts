import { Op } from 'sequelize'
import { Permission, Role, User } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

/**
 * 菜单接口简单内存缓存（TTL 30秒）。
 * 菜单数据变更低频，短时间缓存可显著减少相同角色重复请求的 DB 压力。
 * key: roleId (number | string)
 */
interface MenuCacheEntry {
  tree: any[]
  expireAt: number
}
const MENU_CACHE_TTL = 30 * 1000 // 30 秒
const menuCache = new Map<string, MenuCacheEntry>()
export function clearMenuCache() { menuCache.clear() }

// 菜单/权限列表（树形结构）
export const list = async (req, res) => {
  try {
    const { keyword, status, type } = req.query
    const where: any = {}
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 权限详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const perm = await Permission.findOne({ where: { perm_id: id } })
    if (!perm) return fail(res, '菜单/权限不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, perm, '查询成功')
  } catch (err) {
    console.error('查询权限详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改菜单/权限
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const perm = await Permission.findOne({ where: { perm_id: id } })
    if (!perm) return fail(res, '菜单/权限不存在', ErrorCode.RECORD_NOT_FOUND)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除菜单/权限
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const perm = await Permission.findOne({ where: { perm_id: id } })
    if (!perm) return fail(res, '菜单/权限不存在', ErrorCode.RECORD_NOT_FOUND)
    // 检查是否有子节点
    const childCount = await Permission.count({ where: { parent_id: id } })
    if (childCount > 0) return fail(res, `存在 ${childCount} 个子菜单，无法删除`)
    await perm.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除权限失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

/** 超级角色角色编码集合 —— 这些角色直接返回全部启用菜单，跳过 role_permission JOIN 查询 */
const SUPER_ROLE_CODES = new Set(['SUPER_ADMIN', 'ADMIN'])

/** O(n) 构建菜单树（替代原递归 O(n²) 实现） */
function buildMenuTree(permList: any[]): any[] {
  // 先排序
  const sorted = permList.slice().sort((a: any, b: any) => {
    const sa = Number(a.sort_order) || 0
    const sb = Number(b.sort_order) || 0
    if (sa !== sb) return sa - sb
    return Number(a.perm_id) - Number(b.perm_id)
  })
  // 转为 JSON 对象 + 建索引
  const map = new Map<number, any>()
  for (const p of sorted) {
    const obj = typeof p.toJSON === 'function' ? p.toJSON() : { ...p }
    obj.children = []
    map.set(obj.perm_id, obj)
  }
  // 拼父子关系
  const roots: any[] = []
  for (const node of map.values()) {
    const pid = Number(node.parent_id) || 0
    if (pid === 0) {
      roots.push(node)
    } else {
      const parent = map.get(pid)
      if (parent) parent.children.push(node)
    }
  }
  // 清理空 children 字段
  const cleanEmpty = (arr: any[]) => {
    for (const n of arr) {
      if (n.children && n.children.length > 0) cleanEmpty(n.children)
      else delete n.children
    }
  }
  cleanEmpty(roots)
  return roots
}

/** 查询当前用户的菜单权限列表（DB 查询逻辑，不包含缓存/建树） */
async function fetchUserMenuPerms(user: any): Promise<{ perms: any[]; cacheKey: string }> {
  const roleId = user?.roleId ?? user?.role_id
  const userId = user?.userId ?? user?.user_id
  let role: any = null
  let roleCode: string | null = null
  let perms: any[] = []

  if (roleId) {
    // 先仅查 Role（避免带 include 的无效 JOIN，多数角色菜单权限为空）
    role = await Role.findOne({ where: { role_id: roleId }, attributes: ['role_id', 'role_code'] })
    roleCode = role?.role_code ?? null
  }
  if (!role && userId) {
    const u = await User.findOne({
      where: { user_id: userId },
      include: [{ model: Role, as: 'role', attributes: ['role_id', 'role_code'] }],
      attributes: ['user_id'],
    })
    role = (u as any)?.role ?? null
    roleCode = role?.role_code ?? null
  }

  const cacheKey = String(role?.role_id ?? 'guest')

  // 超级角色：直接返回所有启用菜单
  if (roleCode && SUPER_ROLE_CODES.has(String(roleCode).toUpperCase())) {
    perms = await Permission.findAll({
      where: { status: 1, type: 'menu' },
      attributes: { exclude: ['created_at', 'updated_at'] },
    })
    return { perms, cacheKey }
  }

  // 普通角色：通过 role_permission 关联查询菜单权限
  if (role) {
    const roleWithPerms = await Role.findOne({
      where: { role_id: role.role_id },
      attributes: [],
      include: [{
        model: Permission,
        as: 'permissions',
        where: { status: 1, type: 'menu' },
        required: false,
        attributes: { exclude: ['created_at', 'updated_at'] },
        through: { attributes: [] },
      }],
    })
    perms = (roleWithPerms as any)?.permissions ?? []
  }

  return { perms, cacheKey }
}

// 获取当前用户可见的菜单树（用于前端动态菜单渲染）
export const userMenu = async (req, res) => {
  try {
    const user = req.user

    // —— 命中缓存（仅当能确定角色时）——
    const tmpRoleId = user?.roleId ?? user?.role_id ?? 'guest'
    const cacheKey = String(tmpRoleId)
    const hit = menuCache.get(cacheKey)
    if (hit && hit.expireAt > Date.now()) {
      return success(res, hit.tree, '查询成功')
    }

    const { perms } = await fetchUserMenuPerms(user)
    const tree = buildMenuTree(perms)

    // —— 写入缓存（30秒 TTL）——
    menuCache.set(cacheKey, { tree, expireAt: Date.now() + MENU_CACHE_TTL })
    // 限制缓存上限，避免异常增长
    if (menuCache.size > 50) {
      const firstKey = menuCache.keys().next().value
      if (firstKey !== undefined) menuCache.delete(firstKey)
    }

    return success(res, tree, '查询成功')
  } catch (err) {
    console.error('查询用户菜单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove, userMenu }
