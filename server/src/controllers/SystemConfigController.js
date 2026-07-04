import { SystemConfig } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const defaultConfigs = [
  { config_key: 'system_name', config_value: '奶粉罐MES', config_desc: '系统名称' },
  { config_key: 'system_version', config_value: 'v1.0.0', config_desc: '系统版本' },
  { config_key: 'company_name', config_value: '恒丰包装科技有限公司', config_desc: '公司名称' },
  { config_key: 'contact_phone', config_value: '0571-88888888', config_desc: '联系电话' },
  { config_key: 'default_line', config_value: '', config_desc: '默认产线' },
  { config_key: 'standard_hours', config_value: '8', config_desc: '标准工时' },
  { config_key: 'shift_setting', config_value: '白班,夜班', config_desc: '班次设置' },
  { config_key: 'default_standard', config_value: '', config_desc: '默认检验标准' },
  { config_key: 'defect_warning_threshold', config_value: '3', config_desc: '不良率预警阈值(%)' },
  { config_key: 'microbe_cycle', config_value: '7', config_desc: '微生物检测周期(天)' },
  { config_key: 'device_alarm', config_value: 'true', config_desc: '设备故障报警' },
  { config_key: 'quality_alarm', config_value: 'true', config_desc: '质量异常报警' },
  { config_key: 'stock_warning', config_value: 'true', config_desc: '库存预警' },
]

export const getConfig = async (req, res) => {
  try {
    const configs = await SystemConfig.findAll()
    const result = {}
    configs.forEach(c => {
      result[c.config_key] = c.config_value
    })
    for (const def of defaultConfigs) {
      if (result[def.config_key] === undefined) {
        result[def.config_key] = def.config_value
      }
    }
    return success(res, result, '获取成功')
  } catch (err) {
    console.error('获取系统配置失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const saveConfig = async (req, res) => {
  try {
    const configs = req.body
    const username = req.user?.username || 'system'
    for (const [key, value] of Object.entries(configs)) {
      const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
      const [config, created] = await SystemConfig.findOrCreate({
        where: { config_key: key },
        defaults: { config_value: val, config_desc: key, updated_by: username },
      })
      if (!created) {
        await config.update({ config_value: val, updated_by: username })
      }
    }
    return success(res, null, '保存成功')
  } catch (err) {
    console.error('保存系统配置失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const initDefaultConfigs = async () => {
  for (const def of defaultConfigs) {
    await SystemConfig.findOrCreate({
      where: { config_key: def.config_key },
      defaults: def,
    })
  }
}

export default { getConfig, saveConfig, initDefaultConfigs }
