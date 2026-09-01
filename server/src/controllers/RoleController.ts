import { Op } from 'sequelize'
import { Role, User, Permission } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { clearPermissionCache } from '../middleware/auth.js'

// 角色列表
export const list = async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 50 } = req.query
    const where: any = {}
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

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改角色
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const role = await Role.findOne({ where: { role_id: id } })
    if (!role) return fail(res, '角色不存在', ErrorCode.RECORD_NOT_FOUND)
    if (role.role_code === 'SUPER_ADMIN' || role.is_system_default === 1) {
      return fail(res, '系统默认角色禁止编辑', ErrorCode.PERMISSION_DENIED)
    }
    const { role_name, role_code, type, scope, sort_order, status } = req.body
    if (role_code && role_code !== role.role_code) {
      const exists = await Role.findOne({ where: { role_code, role_id: { [Op.ne]: id } } })
      if (exists) return fail(res, '角色编码已存在')
    }
    await role.update({ role_name, role_code, type, scope, sort_order, status })
    return success(res, role, '修改成功')
  } catch (err) {
    console.error('修改角色失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除角色
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const role = await Role.findOne({ where: { role_id: id } })
    if (!role) return fail(res, '角色不存在', ErrorCode.RECORD_NOT_FOUND)
    if (role.role_code === 'SUPER_ADMIN' || role.is_system_default === 1) {
      return fail(res, '系统默认角色禁止删除', ErrorCode.PERMISSION_DENIED)
    }
    // 检查是否有用户使用该角色
    const userCount = await User.count({ where: { role_id: id } })
    if (userCount > 0) return fail(res, `该角色下存在 ${userCount} 个用户，无法删除`)
    await role.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除角色失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 初始化默认权限数据
const defaultPermissions = [
  // 系统管理
  { parent_id: 0, perm_name: '系统管理', perm_code: 'system', type: 'menu', icon: 'SettingOutlined', path: 'system', sort_order: 8 },
  { parent_id: 0, parent_code: 'system', perm_name: '用户管理', perm_code: 'system:user', type: 'menu', icon: 'TeamOutlined', path: '/system/users', sort_order: 1 },
  { parent_id: 0, parent_code: 'system', perm_name: '角色权限', perm_code: 'system:role', type: 'menu', icon: 'SafetyCertificateOutlined', path: '/system/roles', sort_order: 2 },
  { parent_id: 0, parent_code: 'system', perm_name: '菜单管理', perm_code: 'system:menu', type: 'menu', icon: 'MenuOutlined', path: '/system/menus', sort_order: 3 },
  { parent_id: 0, parent_code: 'system', perm_name: '数据字典', perm_code: 'system:dict', type: 'menu', icon: 'DatabaseOutlined', path: '/system/dictionary', sort_order: 4 },
  { parent_id: 0, parent_code: 'system', perm_name: '系统配置', perm_code: 'system:config', type: 'menu', icon: 'ControlOutlined', path: '/system/config', sort_order: 5 },
  { parent_id: 0, parent_code: 'system', perm_name: '操作日志', perm_code: 'system:log', type: 'menu', icon: 'FileTextOutlined', path: '/system/logs', sort_order: 6 },
  { parent_id: 0, parent_code: 'system', perm_name: '系统日志', perm_code: 'system:system-log', type: 'menu', icon: 'BugOutlined', path: '/system/system-logs', sort_order: 8 },
  // 基础数据
  { parent_id: 0, perm_name: '基础数据', perm_code: 'basic', type: 'menu', icon: 'ProfileOutlined', path: 'basic', sort_order: 4 },
  { parent_id: 0, parent_code: 'basic', perm_name: '料品档案', perm_code: 'basic:material', type: 'menu', icon: 'ProfileOutlined', path: '/basic/materials', sort_order: 1 },
  { parent_id: 0, parent_code: 'basic', perm_name: '客户档案', perm_code: 'basic:customer', type: 'menu', icon: 'TeamOutlined', path: '/basic/customers', sort_order: 2 },
  { parent_id: 0, parent_code: 'basic', perm_name: '供应商档案', perm_code: 'basic:supplier', type: 'menu', icon: 'ShopOutlined', path: '/basic/suppliers', sort_order: 3 },
  { parent_id: 0, parent_code: 'basic', perm_name: '产线档案', perm_code: 'basic:line', type: 'menu', icon: 'DeploymentUnitOutlined', path: '/basic/lines', sort_order: 4 },
  { parent_id: 0, parent_code: 'basic', perm_name: '工序档案', perm_code: 'basic:process', type: 'menu', icon: 'DeploymentUnitOutlined', path: '/basic/processes', sort_order: 5 },
  { parent_id: 0, parent_code: 'basic', perm_name: '不良分类', perm_code: 'basic:defect', type: 'menu', icon: 'AlertOutlined', path: '/basic/defects', sort_order: 6 },
  { parent_id: 0, parent_code: 'basic', perm_name: '编码管理', perm_code: 'basic:number-rule', type: 'menu', icon: 'KeyOutlined', path: '/basic/number-rules', sort_order: 7 },
  // 生产管理
  { parent_id: 0, perm_name: '生产管理', perm_code: 'production', type: 'menu', icon: 'ToolOutlined', path: 'production', sort_order: 1 },
  { parent_id: 0, parent_code: 'production', perm_name: '生产订单', perm_code: 'production:order', type: 'menu', icon: 'FileTextOutlined', path: '/production/orders', sort_order: 1 },
  { parent_id: 0, parent_code: 'production', perm_name: '生产报工', perm_code: 'production:reporting', type: 'menu', icon: 'ProfileOutlined', path: '/production/reporting', sort_order: 2 },
  // 质量管理
  { parent_id: 0, perm_name: '质量管理', perm_code: 'quality', type: 'menu', icon: 'ExperimentOutlined', path: 'quality', sort_order: 2 },
  { parent_id: 0, parent_code: 'quality', perm_name: '检验标准', perm_code: 'quality:standard', type: 'menu', icon: 'SafetyCertificateOutlined', path: '/quality/standards', sort_order: 8 },
  { parent_id: 0, parent_code: 'quality', perm_name: '来料检验', perm_code: 'quality:incoming', type: 'menu', icon: 'ExperimentOutlined', path: '/quality/incoming', sort_order: 1 },
  { parent_id: 0, parent_code: 'quality', perm_name: '产品检测', perm_code: 'quality:product', type: 'menu', icon: 'ExperimentOutlined', path: '/quality/product', sort_order: 2 },
  { parent_id: 0, parent_code: 'quality', perm_name: '微生物检验', perm_code: 'quality:microbe', type: 'menu', icon: 'ExperimentOutlined', path: '/quality/microbe', sort_order: 3 },
  { parent_id: 0, parent_code: 'quality', perm_name: '环境检验', perm_code: 'quality:environment', type: 'menu', icon: 'ExperimentOutlined', path: '/quality/environment', sort_order: 4 },
  { parent_id: 0, parent_code: 'quality', perm_name: '投诉管理', perm_code: 'quality:complaint', type: 'menu', icon: 'BellOutlined', path: '/quality/complaints', sort_order: 5 },
  { parent_id: 0, parent_code: 'quality:complaint', perm_name: '客诉管理', perm_code: 'quality:complaint:customer', type: 'menu', icon: 'BellOutlined', path: '/quality/complaints', sort_order: 1 },
  { parent_id: 0, parent_code: 'quality:complaint', perm_name: '供应商投诉', perm_code: 'quality:complaint:supplier', type: 'menu', icon: 'TeamOutlined', path: '/quality/supplier', sort_order: 2 },
  { parent_id: 0, parent_code: 'quality', perm_name: '检测仪器管理', perm_code: 'quality:instrument', type: 'menu', icon: 'ToolOutlined', path: '/quality/instruments', sort_order: 6 },
  // 设备管理
  { parent_id: 0, perm_name: '设备管理', perm_code: 'device', type: 'menu', icon: 'ToolOutlined', path: 'device', sort_order: 3 },
  { parent_id: 0, parent_code: 'device', perm_name: '设备档案', perm_code: 'device:list', type: 'menu', icon: 'ToolOutlined', path: '/device/list', sort_order: 1 },
  { parent_id: 0, parent_code: 'device', perm_name: '保养标准', perm_code: 'device:maintenance-standard', type: 'menu', icon: 'ProfileOutlined', path: '/device/maintenance-standard', sort_order: 2 },
  { parent_id: 0, parent_code: 'device', perm_name: '保养管理', perm_code: 'device:maintenance', type: 'menu', icon: 'ToolOutlined', path: '/device/maintenance', sort_order: 3 },
  { parent_id: 0, parent_code: 'device', perm_name: '保养矩阵', perm_code: 'device:maintenance-matrix', type: 'menu', icon: 'AppstoreOutlined', path: '/device/maintenance/matrix', sort_order: 4 },
  { parent_id: 0, parent_code: 'device', perm_name: '设备OEE', perm_code: 'device:oee', type: 'menu', icon: 'LineChartOutlined', path: '/device/oee', sort_order: 5 },
  { parent_id: 0, parent_code: 'device', perm_name: '设备看板', perm_code: 'device:dashboard', type: 'menu', icon: 'DashboardOutlined', path: '/device/dashboard', sort_order: 6 },
  { parent_id: 0, parent_code: 'device', perm_name: '故障管理', perm_code: 'device:fault', type: 'menu', icon: 'WarningOutlined', path: '/device/fault', sort_order: 7 },
  { parent_id: 0, parent_code: 'device', perm_name: '备件管理', perm_code: 'device:spare-part', type: 'menu', icon: 'InboxOutlined', path: '/device/spare-parts', sort_order: 8 },
  { parent_id: 0, parent_code: 'device', perm_name: '校准管理', perm_code: 'device:calibration', type: 'menu', icon: 'AimOutlined', path: '/device/calibration', sort_order: 9 },
  { parent_id: 0, parent_code: 'device', perm_name: '电子档案', perm_code: 'device:document', type: 'menu', icon: 'FolderOutlined', path: '/device/documents', sort_order: 10 },
  // 报表中心
  { parent_id: 0, perm_name: '报表中心', perm_code: 'report', type: 'menu', icon: 'PieChartOutlined', path: 'report', sort_order: 5 },
  { parent_id: 0, parent_code: 'report', perm_name: '生产日报', perm_code: 'report:daily', type: 'menu', icon: 'CalendarOutlined', path: '/report/daily', sort_order: 1 },
  { parent_id: 0, parent_code: 'report', perm_name: '质量月报', perm_code: 'report:monthly', type: 'menu', icon: 'FileTextOutlined', path: '/report/monthly', sort_order: 2 },
  { parent_id: 0, parent_code: 'report', perm_name: '效率分析', perm_code: 'report:efficiency', type: 'menu', icon: 'RiseOutlined', path: '/report/efficiency', sort_order: 3 },
  { parent_id: 0, parent_code: 'report', perm_name: '生产报表', perm_code: 'report:production', type: 'menu', icon: 'FileTextOutlined', path: '/report/production', sort_order: 4 },
  { parent_id: 0, parent_code: 'report', perm_name: '质量报表', perm_code: 'report:quality', type: 'menu', icon: 'ExperimentOutlined', path: '/report/quality', sort_order: 5 },
  { parent_id: 0, parent_code: 'report', perm_name: '异常分析', perm_code: 'report:exception', type: 'menu', icon: 'BellOutlined', path: '/report/exception', sort_order: 6 },
  // 自动任务
  { parent_id: 0, perm_name: '自动任务', perm_code: 'auto', type: 'menu', icon: 'ControlOutlined', path: 'auto', sort_order: 6 },
  { parent_id: 0, parent_code: 'auto', perm_name: '任务设置', perm_code: 'auto:task-setting', type: 'menu', icon: 'SettingOutlined', path: '/auto/task-settings', sort_order: 1 },
  { parent_id: 0, parent_code: 'auto', perm_name: '定时任务', perm_code: 'auto:scheduled-task', type: 'menu', icon: 'CalendarOutlined', path: '/auto/scheduled-tasks', sort_order: 2 },
  { parent_id: 0, parent_code: 'auto', perm_name: '任务日志', perm_code: 'auto:task-log', type: 'menu', icon: 'ClockCircleOutlined', path: '/auto/task-logs', sort_order: 3 },
  // 数据大屏
  { parent_id: 0, perm_name: '数据大屏', perm_code: 'bigscreen', type: 'menu', icon: 'DesktopOutlined', path: 'bigscreen', sort_order: 7 },
  { parent_id: 0, parent_code: 'bigscreen', perm_name: '生产实时看板', perm_code: 'bigscreen:production', type: 'menu', icon: 'BarChartOutlined', path: '/bigscreen/production', sort_order: 1 },
  { parent_id: 0, parent_code: 'bigscreen', perm_name: '质量分析看板', perm_code: 'bigscreen:quality', type: 'menu', icon: 'ExperimentOutlined', path: '/bigscreen/quality', sort_order: 2 },
  { parent_id: 0, parent_code: 'bigscreen', perm_name: '管理驾驶舱', perm_code: 'bigscreen:management', type: 'menu', icon: 'PieChartOutlined', path: '/bigscreen/management', sort_order: 3 },
  { parent_id: 0, parent_code: 'bigscreen', perm_name: '环境看板', perm_code: 'bigscreen:environment', type: 'menu', icon: 'EnvironmentOutlined', path: '/bigscreen/environment', sort_order: 4 },
  // 报表中心
  { parent_id: 0, perm_name: '报表中心', perm_code: 'report', type: 'menu', icon: 'PieChartOutlined', path: 'report', sort_order: 5 },
  { parent_id: 0, parent_code: 'report', perm_name: '生产日报', perm_code: 'report:daily', type: 'menu', icon: 'CalendarOutlined', path: '/report/daily', sort_order: 1 },
  { parent_id: 0, parent_code: 'report', perm_name: '质量月报', perm_code: 'report:monthly', type: 'menu', icon: 'FileTextOutlined', path: '/report/monthly', sort_order: 2 },
  { parent_id: 0, parent_code: 'report', perm_name: '效率分析', perm_code: 'report:efficiency', type: 'menu', icon: 'RiseOutlined', path: '/report/efficiency', sort_order: 3 },
  { parent_id: 0, parent_code: 'report', perm_name: '生产报表', perm_code: 'report:production', type: 'menu', icon: 'FileTextOutlined', path: '/report/production', sort_order: 4 },
  { parent_id: 0, parent_code: 'report', perm_name: '质量报表', perm_code: 'report:quality', type: 'menu', icon: 'ExperimentOutlined', path: '/report/quality', sort_order: 5 },
  { parent_id: 0, parent_code: 'report', perm_name: '异常分析', perm_code: 'report:exception', type: 'menu', icon: 'BellOutlined', path: '/report/exception', sort_order: 6 },
  // ===== 按钮级权限（type: button）=====
  // 系统管理 - 角色权限
  { parent_id: 0, parent_code: 'system:role', perm_name: '分配权限', perm_code: 'system:role:assign', type: 'button', sort_order: 1 },
  // 生产管理 - 生产订单
  { parent_id: 0, parent_code: 'production:order', perm_name: '订单下发', perm_code: 'production:order:release', type: 'button', sort_order: 1 },
  { parent_id: 0, parent_code: 'production:order', perm_name: '订单关闭', perm_code: 'production:order:close', type: 'button', sort_order: 2 },
  { parent_id: 0, parent_code: 'production:order', perm_name: '新增订单', perm_code: 'production:order:create', type: 'button', sort_order: 3 },
  { parent_id: 0, parent_code: 'production:order', perm_name: '编辑订单', perm_code: 'production:order:update', type: 'button', sort_order: 4 },
  { parent_id: 0, parent_code: 'production:order', perm_name: '删除订单', perm_code: 'production:order:delete', type: 'button', sort_order: 5 },
  // 生产管理 - 生产报工
  { parent_id: 0, parent_code: 'production:reporting', perm_name: '新增报工', perm_code: 'production:reporting:create', type: 'button', sort_order: 1 },
  { parent_id: 0, parent_code: 'production:reporting', perm_name: '报工完工', perm_code: 'production:reporting:finish', type: 'button', sort_order: 2 },
  { parent_id: 0, parent_code: 'production:reporting', perm_name: '报工关闭', perm_code: 'production:reporting:close', type: 'button', sort_order: 3 },
  { parent_id: 0, parent_code: 'production:reporting', perm_name: '编辑报工', perm_code: 'production:reporting:update', type: 'button', sort_order: 4 },
  { parent_id: 0, parent_code: 'production:reporting', perm_name: '删除报工', perm_code: 'production:reporting:delete', type: 'button', sort_order: 5 },
  // 基础数据 - 产线档案
  { parent_id: 0, parent_code: 'basic:line', perm_name: '新增产线', perm_code: 'basic:line:create', type: 'button', sort_order: 1 },
  { parent_id: 0, parent_code: 'basic:line', perm_name: '编辑产线', perm_code: 'basic:line:update', type: 'button', sort_order: 2 },
  { parent_id: 0, parent_code: 'basic:line', perm_name: '删除产线', perm_code: 'basic:line:delete', type: 'button', sort_order: 3 },
  // 基础数据 - 工序档案
  { parent_id: 0, parent_code: 'basic:process', perm_name: '新增工序', perm_code: 'basic:process:create', type: 'button', sort_order: 1 },
  { parent_id: 0, parent_code: 'basic:process', perm_name: '编辑工序', perm_code: 'basic:process:update', type: 'button', sort_order: 2 },
  { parent_id: 0, parent_code: 'basic:process', perm_name: '删除工序', perm_code: 'basic:process:delete', type: 'button', sort_order: 3 },
  // 基础数据 - 设备档案
  { parent_id: 0, parent_code: 'device:list', perm_name: '新增设备', perm_code: 'device:list:create', type: 'button', sort_order: 1 },
  { parent_id: 0, parent_code: 'device:list', perm_name: '编辑设备', perm_code: 'device:list:update', type: 'button', sort_order: 2 },
  { parent_id: 0, parent_code: 'device:list', perm_name: '删除设备', perm_code: 'device:list:delete', type: 'button', sort_order: 3 },
  // 质量管理 - 检验标准
  { parent_id: 0, parent_code: 'quality:standard', perm_name: '复制标准', perm_code: 'quality:standard:copy', type: 'button', icon: 'CopyOutlined', sort_order: 1 },
  { parent_id: 0, parent_code: 'quality:standard', perm_name: '改版标准', perm_code: 'quality:standard:revise', type: 'button', icon: 'BranchesOutlined', sort_order: 2 },
]

export const initDefaultPermissions = async () => {
  // 硬编码 parent_id → perm_code 映射（兼容旧配置，避免因数据库自增ID不一致导致菜单丢失）
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

  const defaultCodes = defaultPermissions.map(p => p.perm_code)
  // 先建立 perm_code -> perm_id 的映射
  const codeToId: Record<string, number> = {}
  // 先创建所有顶级菜单(parent_id=0)，确保有perm_id后再创建子菜单
  const topLevels = defaultPermissions.filter(p => p.parent_id === 0 && !(p as any).parent_code)
  const others = defaultPermissions.filter(p => p.parent_id !== 0 || (p as any).parent_code)
  for (const perm of topLevels) {
    const [record] = await Permission.findOrCreate({
      where: { perm_code: perm.perm_code },
      defaults: perm,
    })
    codeToId[perm.perm_code] = record.perm_id
  }
  // 预填充：所有菜单都先查一遍，建立完整的 code→id 映射（含子菜单，用于嵌套 parent_code 查找）
  for (const perm of defaultPermissions) {
    if (!codeToId[perm.perm_code]) {
      const rec = await Permission.findOne({ where: { perm_code: perm.perm_code } })
      if (rec) codeToId[perm.perm_code] = rec.perm_id
    }
  }
  for (const perm of defaultPermissions) {
    if (topLevels.includes(perm)) continue
    let finalPerm = { ...perm } as any
    // 如果指定了 parent_code，用它查找实际的 parent_id
    if (finalPerm.parent_code) {
      const parentId = codeToId[finalPerm.parent_code]
      if (parentId) {
        finalPerm.parent_id = parentId
      } else {
        // 如果映射里还没有，查一下数据库
        const parentRec = await Permission.findOne({ where: { perm_code: finalPerm.parent_code } })
        if (parentRec) {
          finalPerm.parent_id = parentRec.perm_id
          codeToId[finalPerm.parent_code] = parentRec.perm_id
        }
      }
    } else if (finalPerm.parent_id && LEGACY_PARENT_MAP[finalPerm.parent_id]) {
      // 兼容旧的硬编码 parent_id：通过映射表查找正确的 perm_code，再解析实际 parent_id
      const parentCode = LEGACY_PARENT_MAP[finalPerm.parent_id]
      const parentId = codeToId[parentCode]
        || (await Permission.findOne({ where: { perm_code: parentCode } }))?.perm_id
      if (parentId) {
        finalPerm.parent_id = parentId
        codeToId[parentCode] = parentId
      }
    }
    const [record, created] = await Permission.findOrCreate({
      where: { perm_code: perm.perm_code },
      defaults: finalPerm,
    })
    codeToId[perm.perm_code] = record.perm_id
    if (!created) {
      await record.update({
        perm_name: finalPerm.perm_name,
        parent_id: finalPerm.parent_id,
        icon: finalPerm.icon,
        path: finalPerm.path,
        sort_order: finalPerm.sort_order,
        type: finalPerm.type,
        visible: finalPerm.visible !== undefined ? finalPerm.visible : 1,
        status: finalPerm.status !== undefined ? finalPerm.status : 1,
        component: finalPerm.component || null,
      })
    }
  }
  // 清理数据库中存在但默认权限中没有的菜单项（防止删除的菜单残留）
  const allPerms = await Permission.findAll()
  const toRemove = allPerms.filter(p => !defaultCodes.includes(p.perm_code) && p.type === 'menu')
  if (toRemove.length > 0) {
    const removeIds = toRemove.map(p => p.perm_id)
    console.log(`🧹 清理废弃菜单项: ${toRemove.map(p => p.perm_name).join(', ')}`)
    await Permission.destroy({ where: { perm_id: { [Op.in]: removeIds } } })
  }
  const adminRole = await Role.findOne({ where: { role_code: 'SUPER_ADMIN' } })
  if (adminRole) {
    const allPermsAfter = await Permission.findAll()
    await adminRole.setPermissions(allPermsAfter)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
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
    if (!role) return fail(res, '角色不存在', ErrorCode.RECORD_NOT_FOUND)
    const permIds = role.permissions?.map(p => p.perm_id) || []
    return success(res, permIds, '查询成功')
  } catch (err) {
    console.error('获取角色权限失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 分配权限给角色
export const assignPermissions = async (req, res) => {
  try {
    const { id } = req.params
    const { perm_ids } = req.body
    const role = await Role.findOne({ where: { role_id: id } })
    if (!role) return fail(res, '角色不存在', ErrorCode.RECORD_NOT_FOUND)
    if (role.role_code === 'SUPER_ADMIN' || role.is_system_default === 1) {
      return fail(res, '系统默认角色禁止修改权限', ErrorCode.PERMISSION_DENIED)
    }

    const ids = perm_ids || []
    if (!Array.isArray(ids)) {
      return fail(res, 'perm_ids 必须是数组', ErrorCode.PARAM_INVALID)
    }

    if (ids.length > 0) {
      const validIds = ids.map(x => Number(x)).filter(x => !isNaN(x))
      const permissions = await Permission.findAll({
        where: { perm_id: { [Op.in]: validIds } },
      })
      if (permissions.length !== validIds.length) {
        const foundIds = new Set(permissions.map(p => p.perm_id))
        const missingIds = validIds.filter(x => !foundIds.has(x))
        return fail(res, `以下权限ID不存在: ${missingIds.join(', ')}`, ErrorCode.PARAM_INVALID)
      }
      await role.setPermissions(permissions)
    } else {
      await role.setPermissions([])
    }

    clearPermissionCache(Number(id))

    return success(res, null, '权限分配成功')
  } catch (err) {
    console.error('分配角色权限失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, create, update, remove, listPermissions, getRolePermissions, assignPermissions, initDefaultPermissions }
