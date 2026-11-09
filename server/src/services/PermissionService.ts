/**
 * 权限/菜单 Service（PermissionController 下沉）
 *
 * 核心业务：
 *   - 树形 list（递归 buildTree）
 *   - userMenu（超级角色直通 + role_permission JOIN + O(n) 建树 + 30s LRU 缓存）
 *   - 子节点保护（remove 前 count）、自身不可为父级、perm_code 唯一性
 */
import { Op } from 'sequelize'
import { Permission, Role, User, RolePermission } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { WILDCARD_PERM } from '../middleware/auth.js'

// ---------- 菜单 LRU 缓存（下沉到 Service，与 buildMenuTree 同文件） ----------
interface MenuCacheEntry { tree: any[]; expireAt: number }
const MENU_CACHE_TTL = 30 * 1000
const menuCache = new Map<string, MenuCacheEntry>()
export function clearMenuCache() { menuCache.clear() }

/** O(n) 建树（替代原递归 O(n²)） */
export function buildMenuTree(permList: any[]): any[] {
  const sorted = permList.slice().sort((a: any, b: any) => {
    const sa = Number(a.sort_order) || 0, sb = Number(b.sort_order) || 0
    if (sa !== sb) return sa - sb
    return Number(a.perm_id) - Number(b.perm_id)
  })
  const map = new Map<number, any>()
  for (const p of sorted) {
    const obj = typeof p.toJSON === 'function' ? p.toJSON() : { ...p }
    obj.children = []
    map.set(obj.perm_id, obj)
  }
  const roots: any[] = []
  for (const node of map.values()) {
    const pid = Number(node.parent_id) || 0
    if (pid === 0) roots.push(node)
    else {
      const parent = map.get(pid)
      if (parent) parent.children.push(node)
    }
  }
  const cleanEmpty = (arr: any[]) => {
    for (const n of arr) {
      if (n.children && n.children.length > 0) cleanEmpty(n.children)
      else delete n.children
    }
  }
  cleanEmpty(roots)
  return roots
}

export const PermissionService = {
  async list(query: any) {
    const { keyword, status, type } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { perm_name: { [Op.like]: `%${keyword}%` } },
        { perm_code: { [Op.like]: `%${keyword}%` } },
        { path: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') where.status = Number(status)
    if (type) where.type = type

    const rows = await Permission.findAll({ where, order: [['sort_order', 'ASC'], ['perm_id', 'ASC']] })

    // 保留原递归 buildTree（只在 list 管理页用，量可控）
    const buildTree = (list: any[], parentId = 0): any[] => list
      .filter(item => Number((item as any).parent_id) === Number(parentId))
      .map(item => {
        const children = buildTree(list, (item as any).perm_id)
        return children.length > 0 ? { ...(item as any).toJSON(), children } : (item as any).toJSON()
      })
    const tree = buildTree(rows as any)
    return { rows: tree, total: rows.length }
  },

  async detail(id: number | string) {
    const perm = await Permission.findOne({ where: { perm_id: Number(id) } })
    if (!perm) throw new AppError('菜单/权限不存在', 10002, 404)
    return perm
  },

  async create(body: any) {
    const { perm_name, perm_code, type } = body
    if (!perm_name || !perm_code) throw new AppError('菜单名称和权限编码不能为空', 10001, 400)
    const exists = await Permission.findOne({ where: { perm_code } })
    if (exists) throw new AppError('权限编码已存在', 20001, 409)

    return await Permission.create({
      ...body,
      type: type || 'menu',
      status: body.status !== undefined ? Number(body.status) : 1,
      sort_order: body.sort_order || 0,
      parent_id: body.parent_id || 0,
    } as any)
  },

  async update(id: number | string, body: any) {
    const perm = await Permission.findOne({ where: { perm_id: Number(id) } })
    if (!perm) throw new AppError('菜单/权限不存在', 10002, 404)
    if (body.perm_code && body.perm_code !== (perm as any).perm_code) {
      const exists = await Permission.findOne({ where: { perm_code: body.perm_code, perm_id: { [Op.ne]: Number(id) } } })
      if (exists) throw new AppError('权限编码已存在', 20001, 409)
    }
    if (body.parent_id && Number(body.parent_id) === Number(id)) {
      throw new AppError('不能将自身设为父级菜单', 10001, 400)
    }
    const payload: any = { ...body }
    if (payload.status !== undefined) payload.status = Number(payload.status)
    if (payload.parent_id !== undefined) payload.parent_id = Number(payload.parent_id) || 0
    await perm.update(payload)
    clearMenuCache()
    return perm
  },

  async remove(id: number | string) {
    const perm = await Permission.findOne({ where: { perm_id: Number(id) } })
    if (!perm) throw new AppError('菜单/权限不存在', 10002, 404)
    const childCount = await Permission.count({ where: { parent_id: Number(id) } })
    if (childCount > 0) throw new AppError(`存在 ${childCount} 个子菜单，无法删除`, 20001, 409)
    await perm.destroy()
    clearMenuCache()
    return true
  },

  /**
   * 查询用户菜单（含 LRU 缓存 + terminal 终端维度过滤）
   *
   * Migration 035 改造：加 terminal 参数（1=PC, 2=APP）
   *   JOIN role_permission 时加 terminal 过滤
   *   超级管理员直通全部菜单（不受 terminal 限制）
   *   cacheKey 加 terminal 前缀避免跨终端污染
   */
  async userMenu(user: any, terminal: number = 1) {
    const tmpRoleId = user?.roleId ?? user?.role_id ?? 'guest'
    const cacheKey = `${terminal}:${String(tmpRoleId)}`
    const hit = menuCache.get(cacheKey)
    if (hit && hit.expireAt > Date.now()) return hit.tree

    const roleId = user?.roleId ?? user?.role_id
    const userId = user?.userId ?? user?.user_id
    let role: any = null

    if (roleId) {
      role = await Role.findOne({ where: { role_id: roleId }, attributes: ['role_id', 'role_code'] })
    }
    if (!role && userId) {
      const u = await User.findOne({
        where: { user_id: userId },
        include: [{ model: Role, as: 'role', attributes: ['role_id', 'role_code'] }],
        attributes: ['user_id'],
      })
      role = (u as any)?.role ?? null
    }

    let perms: any[] = []
    const isSuperRole = role
      ? await RolePermission.findOne({
          where: { role_id: role.role_id },
          include: [{ model: Permission, as: 'permission', attributes: ['perm_code'] }],
        }).then((rp: any) => rp?.permission?.perm_code === WILDCARD_PERM).catch(() => false)
      : false

    if (isSuperRole) {
      // SA 直通全量 type=menu（不受 terminal 限制）
      perms = await Permission.findAll({
        where: { status: 1, type: 'menu', visible: 1 },
        attributes: { exclude: ['created_at', 'updated_at'] },
      })
    } else if (role) {
      // 普通角色：按 terminal 过滤 role_permission
      const roleWithPerms = await Role.findOne({
        where: { role_id: role.role_id },
        attributes: [],
        include: [{
          model: Permission, as: 'permissions',
          where: { status: 1, type: 'menu', visible: 1 },
          required: false,
          attributes: { exclude: ['created_at', 'updated_at'] },
          through: { where: { terminal }, attributes: [] },
        }],
      })
      perms = (roleWithPerms as any)?.permissions ?? []
    }

    const tree = buildMenuTree(perms)
    menuCache.set(cacheKey, { tree, expireAt: Date.now() + MENU_CACHE_TTL })
    if (menuCache.size > 50) {
      const firstKey = menuCache.keys().next().value
      if (firstKey !== undefined) menuCache.delete(firstKey)
    }
    return tree
  },

  /**
   * 查询用户的移动端菜单
   * Migration 035 新增：先调 userMenu(terminal=2) 再按 mobile_tab_group 分组
   *   组装 TabBar + ActionSheet 结构返回前端
   */
  async userMobileMenu(user: any) {
    const pcTree = await this.userMenu(user, 2)
    return buildMobileMenuTree(pcTree)
  },
}

/**
 * 从 userMenu 返回的 PC 侧菜单树 → 组装移动端 TabBar + ActionSheet 结构
 *
 * 分组规则：按 mobile_tab_group 字段值分组
 * 同一分组内按 mobile_sort_order 排序
 * mobile_route_path 为空则 fallback 到 route_path（加 /m 前缀）
 *
 * 输入：userMenu 返回的菜单树（任何层级）
 * 输出：{
 *   tabs: [
 *     { key: '__production__', title: '生产', tabGroup: 'production', items: [...] },
 *     ...
 *   ]
 * }
 */
export function buildMobileMenuTree(permList: any[]): { tabs: any[] } {
  // 扁平化（无论输入是树还是扁平）
  const flat: any[] = []
  const flatten = (arr: any[]) => {
    for (const item of arr) {
      flat.push(item)
      if (item.children && item.children.length > 0) flatten(item.children)
    }
  }
  flatten(permList)

  const TAB_GROUPS = ['production', 'inspection', 'device']
  const TAB_META: Record<string, { key: string; title: string }> = {
    production: { key: '__production__', title: '生产' },
    inspection: { key: '__inspection__', title: '检验' },
    device:     { key: '__device__', title: '设备' },
  }

  const groupMap = new Map<string, any[]>()
  for (const perm of flat) {
    const g = perm.mobile_tab_group
    if (!g || !TAB_GROUPS.includes(g)) continue
    const list = groupMap.get(g) || []
    list.push(perm)
    groupMap.set(g, list)
  }

  const tabs: any[] = TAB_GROUPS
    .filter(g => groupMap.has(g))
    .map(g => {
      const items = groupMap.get(g)!
        .filter((p: any) => (p.mobile_visible ?? p.visible) === 1)
        .sort((a: any, b: any) => {
          const sa = Number(a.mobile_sort_order ?? a.sort_order) || 0
          const sb = Number(b.mobile_sort_order ?? b.sort_order) || 0
          if (sa !== sb) return sa - sb
          return Number(a.perm_id) - Number(b.perm_id)
        })
        .map((p: any) => ({
          text: p.perm_name,
          route: p.mobile_route_path || (p.route_path ? `/m${p.route_path}` : ''),
          permCode: p.perm_code,
          icon: p.mobile_icon || p.icon,
          sortOrder: p.mobile_sort_order ?? p.sort_order,
        }))
      const meta = TAB_META[g]
      return { key: meta.key, title: meta.title, tabGroup: g, items }
    })

  return { tabs }
}

export default PermissionService
