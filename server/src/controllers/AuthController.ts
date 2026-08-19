import { User, Role } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { AuthService } from '../services/AuthService.js'
import { hashPassword } from '../utils/password.js'
import { AppError } from '../middleware/security.js'
import type { Request, Response } from 'express'

// 默认弱密码列表：命中时提醒用户修改（不阻断登录）
const WEAK_PASSWORDS = new Set(['123456', 'admin', 'password', '111111', '888888', '000000', 'admin123'])

// 统一异常处理：业务异常 AppError 按其自身 code/message/statusCode 透传，避免被吞成 500 服务器错误
function handleControllerError(res: Response, err: unknown, fallbackAction: string) {
  console.error(`${fallbackAction}:`, err)
  if (err instanceof AppError) {
    return fail(res, err.message, err.code, undefined, err.statusCode)
  }
  return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
}

// 登录
export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password } = req.body || {}
    const forwarded = req.headers['x-forwarded-for']
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      ''
    const result = await AuthService.login({ username, password, ip })
    return success(res, result, '登录成功')
  } catch (err) {
    return handleControllerError(res, err, '登录失败')
  }
}

// 获取当前登录用户信息
export const profile = async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const user = await User.findOne({
      where: { user_id: userId },
      include: [{ model: Role, as: 'role' }],
    })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    const userData = user.toJSON()
    delete userData.user_pwd
    return success(res, userData, '获取用户信息成功')
  } catch (err) {
    console.error('获取用户信息失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 登出（前端清除 token 即可）
export const logout = async (req, res) => {
  try {
    return success(res, null, '登出成功')
  } catch (err) {
    console.error('登出失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改自己的密码
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const { old_password, new_password } = req.body
    const user = await User.findOne({ where: { user_id: userId } })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    await AuthService.changePassword(userId, old_password, new_password)
    return success(res, null, '密码修改成功')
  } catch (err) {
    return handleControllerError(res, err, '修改密码失败')
  }
}

// 更新当前用户资料（昵称、邮箱、手机等）
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const { real_name, email, phone, avatar_url } = req.body
    const user = await User.findOne({ where: { user_id: userId } })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    await user.update({
      ...(real_name !== undefined && { real_name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(avatar_url !== undefined && { avatar_url }),
    })
    const userData = user.toJSON()
    delete userData.user_pwd
    return success(res, userData, '资料更新成功')
  } catch (err) {
    console.error('更新资料失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { login, profile, logout, changePassword, updateProfile }
