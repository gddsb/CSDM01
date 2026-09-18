/**
 * 用户 Controller — CRUD 下沉 UserService；fs 边界（头像上传）保留 Controller
 */
import path from 'path'
import fs from 'fs'
import UserService from '../services/UserService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await UserService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await UserService.detail(Number(req.params.id)))
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserService.create(req.body)
  return success(res, user, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserService.update(Number(req.params.id), req.body)
  return success(res, user, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await UserService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export const toggle = asyncHandler(async (req: Request, res: Response) => {
  const r = await UserService.toggle(Number(req.params.id))
  return success(res, r, r.status === '启用' ? '已启用' : '已禁用')
})

/** 上传当前用户自定义头像 —— fs 边界保留 Controller */
export const uploadMyAvatar = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.userId
  if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
  const file = req.file
  if (!file) return fail(res, '请选择要上传的头像图片')
  if (file.size > 2 * 1024 * 1024) { try { fs.unlinkSync(file.path) } catch {}; return fail(res, '头像图片不能超过 2MB') }
  if (!file.mimetype || !file.mimetype.startsWith('image/')) { try { fs.unlinkSync(file.path) } catch {}; return fail(res, '请上传图片格式的文件') }

  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'avatars')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  const filename = `avatar_${userId}_${Date.now()}${path.extname(file.originalname || '.png').toLowerCase() || '.png'}`
  fs.renameSync(file.path, path.join(uploadsDir, filename))
  const avatarUrl = `/uploads/avatars/${filename}`

  const { user, prevUrl } = await UserService.updateAvatarUrl(userId, avatarUrl)
  // 清理旧自定义头像文件（跳过预设 /assets/avatars/）
  if (prevUrl && prevUrl.startsWith('/uploads/avatars/')) {
    try {
      const oldPath = path.resolve(process.cwd(), prevUrl.replace(/^\//, ''))
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    } catch (err: any) { logger.warn('[User] 旧头像清理:', err?.message) }
  }
  return success(res, { avatar_url: avatarUrl, user }, '头像上传成功')
})

/** 设置当前用户头像（从预设/已上传列表中选择） —— fs 边界保留 Controller */
export const setMyAvatar = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.userId
  if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
  const { avatar_url } = req.body
  if (!avatar_url || typeof avatar_url !== 'string') return fail(res, '头像地址不能为空')
  if (!avatar_url.startsWith('/assets/avatars/') && !avatar_url.startsWith('/uploads/avatars/')) {
    return fail(res, '头像地址不合法')
  }
  const { user, prevUrl } = await UserService.updateAvatarUrl(userId, avatar_url)
  if (prevUrl && prevUrl.startsWith('/uploads/avatars/') && prevUrl !== avatar_url) {
    try {
      const oldPath = path.resolve(process.cwd(), prevUrl.replace(/^\//, ''))
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    } catch (err: any) { logger.warn('[User] 旧头像清理:', err?.message) }
  }
  return success(res, { avatar_url, user }, '头像设置成功')
})

export const updateMyProfile = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.userId
  if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
  return success(res, await UserService.updateMyProfile(userId, req.body), '个人信息已更新')
})

export default { list, detail, create, update, remove, toggle, uploadMyAvatar, setMyAvatar, updateMyProfile }
