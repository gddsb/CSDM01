/**
 * AuthController — 全部业务逻辑下沉 AuthService
 * 保留 5 个命名导出 + default 兼容 routes/auth.ts 和中间件依赖
 */
import { AuthService } from '../services/AuthService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../middleware/security.js'
import type { Request, Response } from 'express'

function handleErr(res: Response, err: unknown, fallbackAction: string) {
  console.error(`${fallbackAction}:`, err)
  if (err instanceof AppError) return fail(res, err.message, err.code, undefined, err.statusCode)
  return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
}

function userIdFrom(req: Request): number | undefined {
  const id = (req as any).user?.userId
  return id != null ? Number(id) : undefined
}

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {}
    const forwarded = req.headers['x-forwarded-for']
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || req.ip || req.socket?.remoteAddress || ''
    const result = await AuthService.login({ username, password, ip })
    return success(res, result, '登录成功')
  } catch (err) { return handleErr(res, err, '登录失败') }
}

export const profile = async (req: Request, res: Response) => {
  try {
    const userId = userIdFrom(req)
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    return success(res, await AuthService.getCurrentUser(userId), '获取用户信息成功')
  } catch (err) { return handleErr(res, err, '获取用户信息失败') }
}

export const logout = async (_req: Request, res: Response) => success(res, null, '登出成功')

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = userIdFrom(req)
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const { old_password, new_password } = req.body
    await AuthService.changePassword(userId, old_password, new_password)
    return success(res, null, '密码修改成功')
  } catch (err) { return handleErr(res, err, '修改密码失败') }
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = userIdFrom(req)
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const { real_name, email, phone, avatar_url } = req.body
    const result = await AuthService.updateProfile(userId, { real_name, email, phone, avatar_url })
    return success(res, result, '资料更新成功')
  } catch (err) { return handleErr(res, err, '更新资料失败') }
}

export default { login, profile, logout, changePassword, updateProfile }
