/** 权限/菜单 Controller — CRUD 全部下沉 PermissionService */
import PermissionService from '../services/PermissionService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, total } = await PermissionService.list(req.query)
  return success(res, rows, '查询成功', total)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const p = await PermissionService.detail(Number(req.params.id))
  return success(res, p, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const p = await PermissionService.create(req.body)
  return success(res, p, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const p = await PermissionService.update(Number(req.params.id), req.body)
  return success(res, p, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await PermissionService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export const userMenu = asyncHandler(async (req: Request, res: Response) => {
  const tree = await PermissionService.userMenu((req as any).user)
  return success(res, tree, '查询成功')
})

export default { list, detail, create, update, remove, userMenu }
