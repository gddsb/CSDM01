/**
 * 权限/菜单 Service（PermissionController 下沉）
 *
 * 核心业务：
 *   - 树形 list（递归 buildTree）
 *   - userMenu（超级角色直通 + role_permission JOIN + O(n) 建树 + 30s LRU 缓存）
 *   - 子节点保护（remove 前 count）、自身不可为父级、perm_code 唯一性
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
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
    // Phase 2 修复：不用 RolePermission→Permission include（没定义这个关联），
    // 直接用 raw query 查 role_permission JOIN sys_permission WHERE perm_code='*'
    let isSuperRole = false
    if (role) {
      try {
        const [rows]: any[] = await sequelize.query(
          `SELECT 1 FROM sys_role_permission rp
           JOIN sys_permission p ON rp.perm_id = p.perm_id
           WHERE rp.role_id = :roleId AND p.perm_code = :wc LIMIT 1`,
          { replacements: { roleId: role.role_id, wc: WILDCARD_PERM }, type: 'SELECT' as const },
        )
        isSuperRole = Array.isArray(rows) && rows.length > 0
      } catch {
        isSuperRole = false
      }
    }

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
      const rawPerms: any[] = (roleWithPerms as any)?.permissions ?? []

      // Phase 2 修复：expandAncestors — 递归补 parent_id 祖先链
      // role_permission 里的 menu 可能缺父级节点（SA seed 数据、或历史手动配置），
      // buildMenuTree 会把父级不存在的叶子节点丢掉 → terminal=2 返回 0 菜单
      const existingIds = new Set<number>(rawPerms.map((p: any) => Number(p.perm_id)))
      let expandBatch = rawPerms.map((p: any) => Number(p.parent_id) || 0).filter((pid: number) => pid > 0 && !existingIds.has(pid))
      let safety = 0
      while (expandBatch.length > 0 && safety < 20) {
        safety++
        const parents: any[] = await Permission.findAll({
          where: { perm_id: { [Op.in]: expandBatch }, status: 1, type: 'menu', visible: 1 },
        })
        const nextBatch: number[] = []
        for (const p of parents) {
          const pid = Number(p.perm_id)
          if (!existingIds.has(pid)) {
            existingIds.add(pid)
            const po = typeof p.toJSON === 'function' ? p.toJSON() : p
            rawPerms.push(po)
            const gp = Number(p.parent_id) || 0
            if (gp > 0 && !existingIds.has(gp)) nextBatch.push(gp)
          }
        }
        expandBatch = nextBatch
      }
      perms = rawPerms
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
   * 查询用户的移动端菜单（完整返回结构）
   *
   * 返回：{ home, tabs, profile }
   *   home    — 固定首页 Tab（sys_permission perm_code='home'）
   *   tabs    — 动态业务 Tab 组（production/quality/device + 子项）
   *   profile — 固定"我的" Tab（sys_permission perm_code='profile'，不存在则兜底）
   *
   * home/profile 直接查 Permission.findOne，绕过 terminal 过滤
   * — 它们是 APP 框架层入口，所有角色必见
   */
  async userMobileMenu(user: any) {
    const pcTree = await this.userMenu(user, 2)
    const tabsOnly = buildMobileMenuTree(pcTree)

    // —— 查 home 记录（perm_code='home'，Migration 039 新增）——
    const stripLeadingM = (s: string | null | undefined): string =>
      s && s.charAt(0) === 'M' ? s.slice(1) : (s ?? '')

    const homePerm = await Permission.findOne({ where: { perm_code: 'home' } })
    const home = homePerm
      ? {
          key: homePerm.mobile_route_path || homePerm.path || '/m/dashboard',
          title: stripLeadingM(homePerm.mobile_perm_name || homePerm.perm_name) || '首页',
          route: homePerm.mobile_route_path || '/m/dashboard',
          icon: homePerm.mobile_icon || homePerm.icon || 'AppOutline',
        }
      : { key: '/m/dashboard', title: '首页', route: '/m/dashboard', icon: 'AppOutline' }

    // —— profile 记录（prod DB 可能还没有，兜底硬编码）——
    const profilePerm = await Permission.findOne({ where: { perm_code: 'profile' } })
    const profile = profilePerm
      ? {
          key: profilePerm.mobile_route_path || profilePerm.path || '/m/profile',
          title: stripLeadingM(profilePerm.mobile_perm_name || profilePerm.perm_name) || '我的',
          route: profilePerm.mobile_route_path || '/m/profile',
          icon: profilePerm.mobile_icon || profilePerm.icon || 'UserOutline',
        }
      : { key: '/m/profile', title: '我的', route: '/m/profile', icon: 'UserOutline' }

    return { home, ...tabsOnly, profile }
  },
}

/**
 * 从 userMenu 返回的 PC 侧菜单树 → 组装移动端 TabBar + ActionSheet 结构
 *
 * 三个需求的落地：
 *   需求 1（TabBar title 对齐 PC 一级菜单）：
 *     TAB_GROUPS 值等于 PC 一级菜单的 perm_code，title 从 PC 一级菜单的 perm_name 反查
 *     之前是 production/inspection/device，037 migration 把 inspection→quality
 *   需求 2（移动端独立名称）：
 *     text 优先取 mobile_perm_name，空值 fallback perm_name
 *   需求 3（M 前缀剥离）：
 *     mobile_perm_name 存储层以 M 开头（如 "M生产管理"），渲染层自动 strip 第一个 M
 *     stripLeadingM 只剥离首字符 M（严格按规格：一个字），不影响正常开头的 "M" 文本
 *
 * 输入：userMenu 返回的菜单树（任何层级，expandAncestors 已保证父级节点在 flat 里）
 * 输出：{
 *   tabs: [
 *     { key: '__production__', title: '生产管理', tabGroup: 'production', items: [...] },
 *     { key: '__inspection__',  title: '质量管理', tabGroup: 'quality',    items: [...] },
 *     { key: '__device__',      title: '设备管理', tabGroup: 'device',      items: [...] },
 *   ]
 * }
 */
export function buildMobileMenuTree(permList: any[]): { tabs: any[] } {
  // 扁平化（无论输入是树还是扁平；expandAncestors 已把父级节点加入）
  const flat: any[] = []
  const flatten = (arr: any[]) => {
    for (const item of arr) {
      flat.push(item)
      if (item.children && item.children.length > 0) flatten(item.children)
    }
  }
  flatten(permList)

  // —— 需求 1: TAB_GROUPS = PC 一级菜单 perm_code（M037 把 inspection→quality） ——
  const TAB_GROUPS = ['production', 'quality', 'device']
  // 前端内部 Tab key 保持旧命名不变（MobileLayout GROUP_ICON_MAP 后续同步改）
  const TAB_KEY: Record<string, string> = {
    production: '__production__',
    quality:    '__inspection__',
    device:     '__device__',
  }

  // —— 需求 1: TabBar title 从 PC 一级菜单 perm_name 反查 ——
  // userMenu 已 expandAncestors，PC 一级菜单（parent_id=0）必然在 flat 里
  const pcTopNames: Record<string, string> = {}
  for (const p of flat) {
    if (Number(p.parent_id) === 0 && p.type === 'menu' && p.visible === 1) {
      if (TAB_GROUPS.includes(p.perm_code)) {
        pcTopNames[p.perm_code] = p.perm_name
      }
    }
  }

  // —— 需求 3: M 前缀剥离工具 ——
  // 只剥离第一个字符恰好为 M（大写）的情况，避免误伤 "M品牌" 等正常 M 开头的文本
  const stripLeadingM = (s: string | null | undefined): string => {
    if (!s) return ''
    return s.charAt(0) === 'M' ? s.slice(1) : s
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
          // 需求 2+3: mobile_perm_name 优先 + strip M；空值 fallback perm_name（也 strip M 以防万一）
          text: stripLeadingM(p.mobile_perm_name || p.perm_name),
          route: p.mobile_route_path || (p.route_path ? `/m${p.route_path}` : ''),
          permCode: p.perm_code,
          icon: p.mobile_icon || p.icon,
          sortOrder: p.mobile_sort_order ?? p.sort_order,
        }))
      // 需求 1: title = PC 一级菜单 perm_name；极端兜底 fallback 到 group key
      const title = pcTopNames[g] || g
      return { key: TAB_KEY[g], title, tabGroup: g, items }
    })

  return { tabs }
}

export default PermissionService
