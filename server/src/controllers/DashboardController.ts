import { Op } from 'sequelize'
import crypto from 'crypto'
import { DashboardConfig, DashboardShare, User, Role } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

// 可用的看板列表（与前端路由对应）
const AVAILABLE_DASHBOARDS = [
  { path: '/bigscreen/production', name: '生产实时看板', icon: 'BarChartOutlined' },
  { path: '/bigscreen/quality', name: '质量分析看板', icon: 'ExperimentOutlined' },
  { path: '/bigscreen/management', name: '管理驾驶舱', icon: 'PieChartOutlined' },
  { path: '/bigscreen/environment', name: '环境看板', icon: 'EnvironmentOutlined' },
]

// 获取可用看板列表
export const listAvailableDashboards = async (req, res) => {
  try {
    return success(res, AVAILABLE_DASHBOARDS, '查询成功')
  } catch (err) {
    console.error('获取可用看板列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 看板配置列表
export const listConfigs = async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 50 } = req.query
    const where = {}
    if (keyword) {
      where.config_name = { [Op.like]: `%${keyword}%` }
    }
    if (status !== undefined && status !== '') {
      where.status = Number(status)
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await DashboardConfig.findAndCountAll({
      where,
      limit,
      offset,
      order: [['is_default', 'DESC'], ['config_id', 'DESC']],
    })
    const data = rows.map(r => {
      const obj = r.toJSON()
      try {
        obj.dashboards = JSON.parse(obj.dashboards || '[]')
      } catch { obj.dashboards = [] }
      return obj
    })
    return success(res, data, '查询成功', count)
  } catch (err) {
    console.error('查询看板配置列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 看板配置详情
export const getConfig = async (req, res) => {
  try {
    const { id } = req.params
    const config = await DashboardConfig.findOne({ where: { config_id: id } })
    if (!config) return fail(res, '看板配置不存在', ErrorCode.RECORD_NOT_FOUND)
    const obj = config.toJSON()
    try {
      obj.dashboards = JSON.parse(obj.dashboards || '[]')
    } catch { obj.dashboards = [] }
    return success(res, obj, '查询成功')
  } catch (err) {
    console.error('查询看板配置详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 创建看板配置
export const createConfig = async (req, res) => {
  try {
    const { config_name, dashboards, default_duration, is_default, remarks } = req.body
    if (!config_name) return fail(res, '配置名称不能为空')
    if (!Array.isArray(dashboards) || dashboards.length === 0) {
      return fail(res, '请至少选择一个看板')
    }
    if (is_default === 1) {
      await DashboardConfig.update({ is_default: 0 }, { where: { is_default: 1 } })
    }
    const config = await DashboardConfig.create({
      config_name,
      dashboards: JSON.stringify(dashboards),
      default_duration: default_duration || 10,
      is_default: is_default || 0,
      status: 1,
      created_by: req.user?.userId,
      remarks,
    })
    return success(res, config, '创建成功')
  } catch (err) {
    console.error('创建看板配置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 更新看板配置
export const updateConfig = async (req, res) => {
  try {
    const { id } = req.params
    const config = await DashboardConfig.findOne({ where: { config_id: id } })
    if (!config) return fail(res, '看板配置不存在', ErrorCode.RECORD_NOT_FOUND)
    const { config_name, dashboards, default_duration, is_default, status, remarks } = req.body
    if (is_default === 1 && config.is_default !== 1) {
      await DashboardConfig.update({ is_default: 0 }, { where: { is_default: 1 } })
    }
    const updateData: any = {}
    if (config_name !== undefined) updateData.config_name = config_name
    if (dashboards !== undefined) updateData.dashboards = JSON.stringify(dashboards)
    if (default_duration !== undefined) updateData.default_duration = default_duration
    if (is_default !== undefined) updateData.is_default = is_default
    if (status !== undefined) updateData.status = status
    if (remarks !== undefined) updateData.remarks = remarks
    await config.update(updateData)
    return success(res, config, '更新成功')
  } catch (err) {
    console.error('更新看板配置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除看板配置
export const deleteConfig = async (req, res) => {
  try {
    const { id } = req.params
    const config = await DashboardConfig.findOne({ where: { config_id: id } })
    if (!config) return fail(res, '看板配置不存在', ErrorCode.RECORD_NOT_FOUND)
    if (config.is_default === 1) {
      return fail(res, '默认配置不能删除')
    }
    await config.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除看板配置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 获取角色为"看板查看者"的用户列表
export const listDashboardUsers = async (req, res) => {
  try {
    const role = await Role.findOne({ where: { role_code: 'DASHBOARD_VIEWER' } })
    if (!role) return success(res, [], '查询成功')
    const users = await User.findAll({
      where: { role_id: role.role_id, status: 1 },
      attributes: ['user_id', 'username', 'real_name', 'avatar_url'],
      order: [['user_id', 'ASC']],
    })
    return success(res, users, '查询成功')
  } catch (err) {
    console.error('获取看板用户列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 生成访问链接
export const createShare = async (req, res) => {
  try {
    const { config_id, user_ids, expires_days } = req.body
    if (!config_id) return fail(res, '请选择看板配置')
    const config = await DashboardConfig.findOne({ where: { config_id } })
    if (!config) return fail(res, '看板配置不存在', ErrorCode.RECORD_NOT_FOUND)
    const shareToken = crypto.randomBytes(24).toString('hex')
    let expires_at = null
    if (expires_days && expires_days > 0) {
      expires_at = new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000)
    }
    const share = await DashboardShare.create({
      share_token: shareToken,
      config_id,
      user_ids: Array.isArray(user_ids) ? JSON.stringify(user_ids) : (user_ids ? JSON.stringify([user_ids]) : null),
      expires_at,
      created_by: req.user?.userId,
      status: 1,
    })
    // 生成完整链接
    const protocol = req.protocol
    const host = req.get('host')
    const shareUrl = `${protocol}://${host}/bigscreen/rotate?token=${shareToken}`
    return success(res, { share, share_url: shareUrl }, '创建成功')
  } catch (err) {
    console.error('生成分享链接失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 分享链接列表
export const listShares = async (req, res) => {
  try {
    const { config_id, status, page = 1, pageSize = 50 } = req.query
    const where: any = {}
    if (config_id) where.config_id = config_id
    if (status !== undefined && status !== '') where.status = Number(status)
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await DashboardShare.findAndCountAll({
      where,
      limit,
      offset,
      order: [['share_id', 'DESC']],
    })
    const data = rows.map(r => {
      const obj = r.toJSON()
      try {
        obj.user_ids = JSON.parse(obj.user_ids || '[]')
      } catch { obj.user_ids = [] }
      const protocol = req.protocol
      const host = req.get('host')
      obj.share_url = `${protocol}://${host}/bigscreen/rotate?token=${obj.share_token}`
      return obj
    })
    return success(res, data, '查询成功', count)
  } catch (err) {
    console.error('查询分享链接列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除/禁用分享链接
export const deleteShare = async (req, res) => {
  try {
    const { id } = req.params
    const share = await DashboardShare.findOne({ where: { share_id: id } })
    if (!share) return fail(res, '分享链接不存在', ErrorCode.RECORD_NOT_FOUND)
    await share.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除分享链接失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 通过token获取看板配置（用于滚动看板页面公开访问）
export const getShareByToken = async (req, res) => {
  try {
    const { token } = req.params
    const share = await DashboardShare.findOne({ where: { share_token: token, status: 1 } })
    if (!share) return fail(res, '链接无效或已禁用', ErrorCode.RECORD_NOT_FOUND)
    // 检查是否过期
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return fail(res, '链接已过期', ErrorCode.PERMISSION_DENIED)
    }
    // 更新访问统计
    await share.update({
      access_count: (share.access_count || 0) + 1,
      last_access_at: new Date(),
    })
    // 获取看板配置
    const config = await DashboardConfig.findOne({ where: { config_id: share.config_id, status: 1 } })
    if (!config) return fail(res, '看板配置不存在或已禁用', ErrorCode.RECORD_NOT_FOUND)
    const configObj = config.toJSON()
    try {
      configObj.dashboards = JSON.parse(configObj.dashboards || '[]')
    } catch { configObj.dashboards = [] }
    let allowedUserIds: number[] = []
    try {
      allowedUserIds = JSON.parse(share.user_ids || '[]')
    } catch { allowedUserIds = [] }
    return success(res, {
      config: configObj,
      allowed_user_ids: allowedUserIds,
      expires_at: share.expires_at,
    }, '查询成功')
  } catch (err) {
    console.error('通过token获取看板配置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default {
  listAvailableDashboards,
  listConfigs,
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  listDashboardUsers,
  createShare,
  listShares,
  deleteShare,
  getShareByToken,
}
