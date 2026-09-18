/**
 * 用户设置 Service（UserSettingController 下沉）
 *
 * 只处理 DB CRUD + value 序列化/反序列化；
 * 业务参数校验（setting_key 非空、userId 提取等）保留在 Controller。
 */
import { UserSetting } from '../models/index.js'
import { AppError } from '../utils/error.js'

/** 序列化 value 为 DB 可存的 string */
function serializeValue(value: any, type: string): string {
  if (type === 'json' || typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

/** 反序列化 DB 存储值 */
function deserializeValue(storedValue: any, type: string): any {
  if (type === 'json') {
    try { return JSON.parse(storedValue || '{}') } catch { return storedValue }
  }
  return storedValue
}

export const UserSettingService = {
  /** 查用户设置（返回 { setting_key: value } 扁平对象） */
  async getSettings(userId: string, group?: string) {
    const where: any = { user_id: String(userId) }
    if (group) where.setting_group = String(group)

    const rows = await UserSetting.findAll({ where })
    const result: Record<string, any> = {}
    for (const row of rows) {
      try {
        result[(row as any).setting_key] = deserializeValue(
          (row as any).setting_value,
          (row as any).setting_type,
        )
      } catch {
        result[(row as any).setting_key] = (row as any).setting_value
      }
    }
    return result
  },

  /** 单条保存（upsert 语义） */
  async saveSetting(userId: string, key: string, value: any, group: string = 'table', type: string = 'json') {
    if (!key) throw new AppError('setting_key 不能为空', 10001, 400)

    const serialized = serializeValue(value, type)
    const [record, created] = await UserSetting.findOrCreate({
      where: { user_id: String(userId), setting_key: String(key) },
      defaults: {
        setting_value: serialized,
        setting_group: group,
        setting_type: type,
      },
    })
    if (!created) {
      await record.update({
        setting_value: serialized,
        setting_group: group,
        setting_type: type,
      })
    }
    return record
  },

  /** 批量保存（循环调用 saveSetting） */
  async batchSaveSettings(userId: string, settings: Record<string, any>, group: string = 'table', type: string = 'json') {
    const entries = Object.entries(settings || {})
    for (const [key, value] of entries) {
      await this.saveSetting(userId, key, value, group, type)
    }
    return entries.length
  },
}

export default UserSettingService
