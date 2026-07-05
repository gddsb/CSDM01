import { Op } from 'sequelize'
import { Role, User, Permission } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 角色列表
export const list = async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 50 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { role_name: { [Op.like]: `%${keyword}%` } },
        { role_code: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap = { '启用': 1, '禁用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Role.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['role_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询角色列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建角色
export const create = async (req, res) => {
  try {
    const { role_name, role_code, type, scope, sort_order, status } = req.body
    if (!role_name || !role_code) {
      return fail(res, '角色名称和角色编码不能为空')
    }
    const exists = await Role.findOne({ where: { role_code } })
    if (exists) return fail(res, '角色编码已存在')
    const role = await Role.create({
      role_name,
      role_code,
      type,
      scope,
      sort_order: sort_order || 0,
      status: status !== undefined ? status : 1,
    })
    return success(res, role, '创建成功')
  } catch (err) {
    console.error('创建角色失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改角色
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const role = await Role.findOne({ where: { role_id: id } })
    if (!role) return fail(res, '角色不存在', 404)
    const { role_name, role_code, type, scope, sort_order, status } = req.body
    if (role_code && role_code !== role.role_code) {
      const exists = await Role.findOne({ where: { role_code, role_id: { [Op.ne]: id } } })
      if (exists) return fail(res, '角色编码已存在')
    }
    await role.update({ role_name, role_code, type, scope, sort_order, status })
    return success(res, role, '修改成功')
  } catch (err) {
    console.error('修改角色失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除角色
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const role = await Role.findOne({ where: { role_id: id } })
    if (!role) return fail(res, '角色不存在', 404)
    // 检查是否有用户使用该角色
    const userCount = await User.count({ where: { role_id: id } })
    if (userCount > 0) return fail(res, `该角色下存在 ${userCount} 个用户，无法删除`)
    await role.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除角色失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 初始化默认权限数据
const defaultPermissions = [
  // 系统管理
  { perm_id: 1, parent_id: 0, perm_name: '系统管理', perm_code: 'system', type: 'menu', icon: 'SettingOutlined', path: '/system', sort_order: 1 },
  { perm_id: 2, parent_id: 1, perm_name: '用户管理', perm_code: 'system:user', type: 'menu', icon: 'TeamOutlined', path: '/system/users', sort_order: 1 },
  { perm_id: 3, parent_id: 1, perm_name: '角色权限', perm_code: 'system:role', type: 'menu', icon: 'SafetyCertificateOutlined', path: '/system/roles', sort_order: 2 },
  { perm_id: 6, parent_id: 1, perm_name: '菜单管理', perm_code: 'system:menu', type: 'menu', icon: 'MenuOutlined', path: '/system/menus', sort_order: 3 },
  { perm_id: 4, parent_id: 1, perm_name: '系统配置', perm_code: 'system:config', type: 'menu', icon: 'ControlOutlined', path: '/system/config', sort_order: 4 },
  { perm_id: 5, parent_id: 1, perm_name: '操作日志', perm_code: 'system:log', type: 'menu', icon: 'FileTextOutlined', path: '/system/logs', sort_order: 5 },
  // 基础数据
  { perm_id: 10, parent_id: 0, perm_name: '基础数据', perm_code: 'basic', type: 'menu', icon: 'ProfileOutlined', path: '/basic', sort_order: 2 },
  { perm_id: 11, parent_id: 10, perm_name: '料品档案', perm_code: 'basic:material', type: 'menu', icon: 'ProfileOutlined', path: '/basic/materials', sort_order: 1 },
  { perm_id: 12, parent_id: 10, perm_name: '产线管理', perm_code: 'basic:line', type: 'menu', icon: 'DeploymentUnitOutlined', path: '/basic/lines', sort_order: 2 },
  { perm_id: 13, parent_id: 10, perm_name: '工序管理', perm_code: 'basic:process', type: 'menu', icon: 'DeploymentUnitOutlined', path: '/basic/processes', sort_order: 3 },
  { perm_id: 14, parent_id: 10, perm_name: '制程不良分类', perm_code: 'basic:defect', type: 'menu', icon: 'AlertOutlined', path: '/basic/defects', sort_order: 4 },
  { perm_id: 15, parent_id: 10, perm_name: '客户档案', perm_code: 'basic:customer', type: 'menu', icon: 'TeamOutlined', path: '/basic/customers', sort_order: 5 },
  // 生产管理
  { perm_id: 20, parent_id: 0, perm_name: '生产管理', perm_code: 'production', type: 'menu', icon: 'ToolOutlined', path: '/production', sort_order: 3 },
  { perm_id: 21, parent_id: 20, perm_name: '生产订单', perm_code: 'production:order', type: 'menu', icon: 'FileTextOutlined', path: '/production/orders', sort_order: 1 },
  { perm_id: 22, parent_id: 20, perm_name: '工单列表', perm_code: 'production:workorder', type: 'menu', icon: 'ToolOutlined', path: '/production/workorders', sort_order: 2 },
  { perm_id: 23, parent_id: 20, perm_name: '生产报工', perm_code: 'production:reporting', type: 'menu', icon: 'ProfileOutlined', path: '/production/reporting', sort_order: 3 },
  { perm_id: 24, parent_id: 20, perm_name: '人员记录', perm_code: 'production:manpower', type: 'menu', icon: 'TeamOutlined', path: '/production/manpower', sort_order: 4 },
  { perm_id: 25, parent_id: 20, perm_name: '异常记录', perm_code: 'production:exception', type: 'menu', icon: 'BellOutlined', path: '/production/exceptions', sort_order: 5 },
  // 质量管理
  { perm_id: 30, parent_id: 0, perm_name: '质量管理', perm_code: 'quality', type: 'menu', icon: 'ExperimentOutlined', path: '/quality', sort_order: 4 },
  { perm_id: 31, parent_id: 30, perm_name: '检验标准管理', perm_code: 'quality:standard', type: 'menu', icon: 'SafetyCertificateOutlined', path: '/quality/standards', sort_order: 1 },
  { perm_id: 32, parent_id: 30, perm_name: '来料检验', perm_code: 'quality:incoming', type: 'menu', icon: 'ExperimentOutlined', path: '/quality/incoming', sort_order: 2 },
  { perm_id: 33, parent_id: 30, perm_name: '过程检验', perm_code: 'quality:process', type: 'menu', icon: 'ExperimentOutlined', path: '/quality/process', sort_order: 3 },
  { perm_id: 34, parent_id: 30, perm_name: '成品检验', perm_code: 'quality:finished', type: 'menu', icon: 'ExperimentOutlined', path: '/quality/finished', sort_order: 4 },
  // 设备管理
  { perm_id: 40, parent_id: 0, perm_name: '设备管理', perm_code: 'device', type: 'menu', icon: 'ToolOutlined', path: '/device', sort_order: 5 },
  { perm_id: 41, parent_id: 40, perm_name: '设备档案', perm_code: 'device:list', type: 'menu', icon: 'ToolOutlined', path: '/device/list', sort_order: 1 },
  { perm_id: 42, parent_id: 40, perm_name: '点检记录', perm_code: 'device:check', type: 'menu', icon: 'FileSearchOutlined', path: '/device/check-records', sort_order: 2 },
  { perm_id: 43, parent_id: 40, perm_name: '维修保养', perm_code: 'device:maintenance', type: 'menu', icon: 'ToolOutlined', path: '/device/maintenance', sort_order: 3 },
  { perm_id: 44, parent_id: 40, perm_name: '设备OEE', perm_code: 'device:oee', type: 'menu', icon: 'LineChartOutlined', path: '/device/oee', sort_order: 4 },
  // 数据大屏
  { perm_id: 50, parent_id: 0, perm_name: '数据大屏', perm_code: 'bigscreen', type: 'menu', icon: 'DesktopOutlined', path: '/bigscreen', sort_order: 6 },
  { perm_id: 51, parent_id: 50, perm_name: '生产实时看板', perm_code: 'bigscreen:production', type: 'menu', icon: 'BarChartOutlined', path: '/bigscreen/production', sort_order: 1 },
  { perm_id: 52, parent_id: 50, perm_name: '质量分析看板', perm_code: 'bigscreen:quality', type: 'menu', icon: 'ExperimentOutlined', path: '/bigscreen/quality', sort_order: 2 },
  { perm_id: 53, parent_id: 50, perm_name: '管理驾驶舱', perm_code: 'bigscreen:management', type: 'menu', icon: 'PieChartOutlined', path: '/bigscreen/management', sort_order: 3 },
  // 报表中心
  { perm_id: 60, parent_id: 0, perm_name: '报表中心', perm_code: 'report', type: 'menu', icon: 'PieChartOutlined', path: '/report', sort_order: 7 },
  { perm_id: 61, parent_id: 60, perm_name: '生产日报', perm_code: 'report:daily', type: 'menu', icon: 'CalendarOutlined', path: '/report/daily', sort_order: 1 },
  { perm_id: 62, parent_id: 60, perm_name: '质量月报', perm_code: 'report:monthly', type: 'menu', icon: 'FileTextOutlined', path: '/report/monthly', sort_order: 2 },
  { perm_id: 63, parent_id: 60, perm_name: '效率分析', perm_code: 'report:efficiency', type: 'menu', icon: 'RiseOutlined', path: '/report/efficiency', sort_order: 3 },
]

export const initDefaultPermissions = async () => {
  for (const perm of defaultPermissions) {
    await Permission.findOrCreate({
      where: { perm_code: perm.perm_code },
      defaults: perm,
    })
  }
  // 给超级管理员角色分配所有权限
  const adminRole = await Role.findOne({ where: { role_code: 'SUPER_ADMIN' } })
  if (adminRole) {
    const allPerms = await Permission.findAll()
    await adminRole.setPermissions(allPerms)
  }
  console.log('✅ 默认权限初始化完成')
}

// 获取所有权限列表（树形结构）
export const listPermissions = async (req, res) => {
  try {
    const permissions = await Permission.findAll({
      order: [['sort_order', 'ASC'], ['perm_id', 'ASC']],
    })
    return success(res, permissions, '查询成功')
  } catch (err) {
    console.error('查询权限列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 获取角色的权限ID列表
export const getRolePermissions = async (req, res) => {
  try {
    const { id } = req.params
    const role = await Role.findOne({
      where: { role_id: id },
      include: [{ model: Permission, as: 'permissions' }],
    })
    if (!role) return fail(res, '角色不存在', 404)
    const permIds = role.permissions?.map(p => p.perm_id) || []
    return success(res, permIds, '查询成功')
  } catch (err) {
    console.error('获取角色权限失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 分配权限给角色
export const assignPermissions = async (req, res) => {
  try {
    const { id } = req.params
    const { perm_ids } = req.body
    const role = await Role.findOne({ where: { role_id: id } })
    if (!role) return fail(res, '角色不存在', 404)
    
    if (perm_ids && Array.isArray(perm_ids)) {
      const permissions = await Permission.findAll({
        where: { perm_id: { [Op.in]: perm_ids } },
      })
      await role.setPermissions(permissions)
    } else {
      await role.setPermissions([])
    }
    
    return success(res, null, '权限分配成功')
  } catch (err) {
    console.error('分配角色权限失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create, update, remove, listPermissions, getRolePermissions, assignPermissions, initDefaultPermissions }
