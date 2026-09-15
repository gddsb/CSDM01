/** 权限/菜单 Controller — 业务逻辑下沉 PermissionService */
import PermissionService from '../services/PermissionService.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, total } = await PermissionService.list(req.query)
  return success(res, rows, '查询成功', total)
})
export const detail = asyncHandler(async (req: Request, res: Response) => {
  const p = await PermissionService.detail(Number(req.params.id))
  return success(res, p, '查询成功')
})
export const create = async (req: Request, res: Response) => {
  try { const p = await PermissionService.create(req.body); return success(res, p, '创建成功') } catch (err: any) { return catchErr(res, err) }
}
export const update = async (req: Request, res: Response) => {
  try { const p = await PermissionService.update(Number(req.params.id), req.body); return success(res, p, '修改成功') } catch (err: any) { return catchErr(res, err) }
}
export const remove = async (req: Request, res: Response) => {
  try { await PermissionService.remove(Number(req.params.id)); return success(res, null, '删除成功') } catch (err: any) { return catchErr(res, err) }
}
export const userMenu = asyncHandler(async (req: Request, res: Response) => {
  const tree = await PermissionService.userMenu((req as any).user)
  return success(res, tree, '查询成功')
})
export default { list, detail, create, update, remove, userMenu }
