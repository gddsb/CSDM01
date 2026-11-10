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
  // terminal: 1=PC端, 2=移动端APP。PC 端 MainLayout 传 ?terminal=1，APP 端传 ?terminal=2
  const terminal = Number((req.query as any)?.terminal) || 1
  const tree = await PermissionService.userMenu((req as any).user, terminal)
  return success(res, tree, '查询成功')
})

/** 移动端专用菜单 — 先 userMenu(terminal=2) 再按 mobile_tab_group 组装 TabBar + ActionSheet */
export const userMobileMenu = asyncHandler(async (req: Request, res: Response) => {
  const menu = await PermissionService.userMobileMenu((req as any).user)
  return success(res, menu, '查询成功')
})

export default { list, detail, create, update, remove, userMenu }
