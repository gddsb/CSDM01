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

  /** 查询用户菜单（含 LRU 缓存） */
  async userMenu(user: any) {
    const tmpRoleId = user?.roleId ?? user?.role_id ?? 'guest'
    const cacheKey = String(tmpRoleId)
    const hit = menuCache.get(cacheKey)
    if (hit && hit.expireAt > Date.now()) return hit.tree

    const roleId = user?.roleId ?? user?.role_id
    const userId = user?.userId ?? user?.user_id
    let role: any = null
    let roleCode: string | null = null

    if (roleId) {
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

    let perms: any[] = []
    // 超级管理员判定：角色在 role_permission 里配了 '*' 通配 → 直通全部菜单（不再靠 role_code 硬编码）
    const isSuperRole = role
      ? await RolePermission.findOne({
          where: { role_id: role.role_id },
          include: [{ model: Permission, as: 'permission', attributes: ['perm_code'] }],
        }).then((rp: any) => rp?.permission?.perm_code === WILDCARD_PERM).catch(() => false)
      : false

    if (isSuperRole) {
      perms = await Permission.findAll({
        where: { status: 1, type: 'menu', visible: 1 },
        attributes: { exclude: ['created_at', 'updated_at'] },
      })
    } else if (role) {
      const roleWithPerms = await Role.findOne({
        where: { role_id: role.role_id },
        attributes: [],
        include: [{
          model: Permission, as: 'permissions',
          where: { status: 1, type: 'menu', visible: 1 },
          required: false,
          attributes: { exclude: ['created_at', 'updated_at'] },
          through: { attributes: [] },
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

  /** 移动端菜单：从 PC 端菜单树按 mobile_tab_group 组装 TabBar + ActionSheet */
  async userMobileMenu(user: any) {
    const pcTree = await this.userMenu(user)
    const { tabs } = buildMobileMenuTree(pcTree)

    const stripLeadingM = (s: string | null | undefined): string =>
      s && s.charAt(0) === 'M' ? s.slice(1) : (s ?? '')

    // home（APP 框架入口，所有角色必见，直接查 DB 绕过权限过滤）
    const homePerm = await Permission.findOne({ where: { perm_code: 'home' } })
    const home = homePerm
      ? {
          key: homePerm.mobile_route_path || homePerm.path || '/m/dashboard',
          title: stripLeadingM(homePerm.mobile_perm_name || homePerm.perm_name) || '首页',
          route: homePerm.mobile_route_path || '/m/dashboard',
          icon: homePerm.mobile_icon || homePerm.icon || 'AppOutline',
        }
      : { key: '/m/dashboard', title: '首页', route: '/m/dashboard', icon: 'AppOutline' }

    // profile
    const profilePerm = await Permission.findOne({ where: { perm_code: 'profile' } })
    const profile = profilePerm
      ? {
          key: profilePerm.mobile_route_path || profilePerm.path || '/m/profile',
          title: stripLeadingM(profilePerm.mobile_perm_name || profilePerm.perm_name) || '我的',
          route: profilePerm.mobile_route_path || '/m/profile',
          icon: profilePerm.mobile_icon || profilePerm.icon || 'UserOutline',
        }
      : { key: '/m/profile', title: '我的', route: '/m/profile', icon: 'UserOutline' }

    return { home, tabs, profile }
  },
}

/**
 * 从 PC 端菜单树 → 移动端 TabBar + ActionSheet 结构
 * - TAB_GROUPS = PC 一级菜单 perm_code（production/quality/device）
 * - TabBar title = PC 一级菜单 perm_name
 * - text 优先取 mobile_perm_name，空值 fallback perm_name；首字符 M 自动剥离
 */
export function buildMobileMenuTree(permList: any[]): { tabs: any[] } {
  const flat: any[] = []
  const flatten = (arr: any[]) => {
    for (const item of arr) {
      flat.push(item)
      if (item.children && item.children.length > 0) flatten(item.children)
    }
  }
  flatten(permList)

  const TAB_GROUPS = ['production', 'quality', 'device']
  const TAB_KEY: Record<string, string> = {
    production: '__production__',
    quality: '__inspection__',
    device: '__device__',
  }

  // TabBar title 从 PC 一级菜单 perm_name 反查
  const pcTopNames: Record<string, string> = {}
  for (const p of flat) {
    if (Number(p.parent_id) === 0 && p.type === 'menu' && p.visible === 1) {
      if (TAB_GROUPS.includes(p.perm_code)) pcTopNames[p.perm_code] = p.perm_name
    }
  }

  const stripLeadingM = (s: string | null | undefined): string =>
    !s ? '' : s.charAt(0) === 'M' ? s.slice(1) : s

  const groupMap = new Map<string, any[]>()
  for (const perm of flat) {
    const g = perm.mobile_tab_group
    if (!g || !TAB_GROUPS.includes(g)) continue
    const list = groupMap.get(g) || []
    list.push(perm)
    groupMap.set(g, list)
  }

  const tabs = TAB_GROUPS
    .filter(g => groupMap.has(g))
    .map(g => {
      const items = (groupMap.get(g) || [])
        .filter((p: any) => (p.mobile_visible ?? p.visible) === 1)
        .sort((a: any, b: any) => {
          const sa = Number(a.mobile_sort_order ?? a.sort_order) || 0
          const sb = Number(b.mobile_sort_order ?? b.sort_order) || 0
          if (sa !== sb) return sa - sb
          return Number(a.perm_id) - Number(b.perm_id)
        })
        .map((p: any) => ({
          text: stripLeadingM(p.mobile_perm_name || p.perm_name),
          route: p.mobile_route_path || (p.route_path ? `/m${p.route_path}` : ''),
          permCode: p.perm_code,
          icon: p.mobile_icon || p.icon,
          sortOrder: p.mobile_sort_order ?? p.sort_order,
        }))
      return { key: TAB_KEY[g], title: pcTopNames[g] || g, tabGroup: g, items }
    })

  return { tabs }
}

export default PermissionService
