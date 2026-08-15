import { UserSetting } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'

export const getUserSettings = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.username
    if (!userId) return fail(res, '用户未登录', ErrorCode.AUTH_REQUIRED)
    const { group } = req.query
    const where = { user_id: String(userId) }
    if (group) where.setting_group = String(group)
    const rows = await UserSetting.findAll({ where })
    const result = {}
    rows.forEach(r => {
      try {
        result[r.setting_key] = r.setting_type === 'json' ? JSON.parse(r.setting_value || '{}') : r.setting_value
      } catch {
        result[r.setting_key] = r.setting_value
      }
    })
    return success(res, result, '获取成功')
  } catch (err) {
    console.error('获取用户设置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const saveUserSetting = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.username
    if (!userId) return fail(res, '用户未登录', ErrorCode.AUTH_REQUIRED)
    const { setting_key, setting_value, setting_group = 'table', setting_type = 'json' } = req.body
    if (!setting_key) return fail(res, 'setting_key 不能为空', ErrorCode.PARAM_INVALID)
    const val = typeof setting_value === 'object' ? JSON.stringify(setting_value) : String(setting_value)
    const [record, created] = await UserSetting.findOrCreate({
      where: { user_id: String(userId), setting_key: String(setting_key) },
      defaults: { setting_value: val, setting_group, setting_type },
    })
    if (!created) {
      await record.update({ setting_value: val, setting_group, setting_type })
    }
    return success(res, null, '保存成功')
  } catch (err) {
    console.error('保存用户设置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const batchSaveUserSettings = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.username
    if (!userId) return fail(res, '用户未登录', ErrorCode.AUTH_REQUIRED)
    const { settings = {}, setting_group = 'table', setting_type = 'json' } = req.body
    const uid = String(userId)
    for (const [key, value] of Object.entries(settings)) {
      const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
      const [record, created] = await UserSetting.findOrCreate({
        where: { user_id: uid, setting_key: key },
        defaults: { setting_value: val, setting_group, setting_type },
      })
      if (!created) {
        await record.update({ setting_value: val, setting_group, setting_type })
      }
    }
    return success(res, null, `保存成功，共 ${Object.keys(settings).length} 项`)
  } catch (err) {
    console.error('批量保存用户设置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}
