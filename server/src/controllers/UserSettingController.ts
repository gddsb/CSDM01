/**
 * 用户设置 Controller — DB 操作走 UserSettingService；
 * 业务参数校验（userId 提取、setting_key 非空）保留 Controller
 */
import UserSettingService from '../services/UserSettingService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

/** 从 req.user 提取唯一 userId（兼容 user_id / username） */
function resolveUserId(user: any): string | null {
  if (!user) return null
  return String(user.user_id ?? user.userId ?? user.username ?? '')
}

export const getUserSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = resolveUserId((req as any).user)
  if (!userId) return fail(res, '用户未登录', ErrorCode.UNAUTHORIZED)
  const { group } = req.query
  const settings = await UserSettingService.getSettings(userId, group ? String(group) : undefined)
  return success(res, settings, '获取成功')
})

export const saveUserSetting = asyncHandler(async (req: Request, res: Response) => {
  const userId = resolveUserId((req as any).user)
  if (!userId) return fail(res, '用户未登录', ErrorCode.UNAUTHORIZED)

  const { setting_key, setting_value, setting_group = 'table', setting_type = 'json' } = req.body || {}
  if (!setting_key) return fail(res, 'setting_key 不能为空', ErrorCode.PARAM_INVALID)

  await UserSettingService.saveSetting(userId, String(setting_key), setting_value, setting_group, setting_type)
  return success(res, null, '保存成功')
})

export const batchSaveUserSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = resolveUserId((req as any).user)
  if (!userId) return fail(res, '用户未登录', ErrorCode.UNAUTHORIZED)

  const { settings = {}, setting_group = 'table', setting_type = 'json' } = req.body || {}
  const count = await UserSettingService.batchSaveSettings(userId, settings, setting_group, setting_type)
  return success(res, null, `保存成功，共 ${count} 项`)
})

export default { getUserSettings, saveUserSetting, batchSaveUserSettings }
