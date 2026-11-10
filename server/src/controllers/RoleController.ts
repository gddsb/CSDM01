/**
 * 角色 Controller — CRUD 全部下沉 RoleService
 * initDefaultPermissions 被 app.ts / init-db.ts 直接调用，保留独立导出
 */
import RoleService from '../services/RoleService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await RoleService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await RoleService.create(req.body)
  return success(res, record, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const record = await RoleService.update(Number(req.params.id), req.body)
  return success(res, record, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await RoleService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const record = await RoleService.detail(Number(req.params.id))
  return success(res, record, '查询成功')
})

export const listPermissions = asyncHandler(async (_req: Request, res: Response) => {
  const perms = await RoleService.listPermissions()
  return success(res, perms, '查询成功')
})

export const getRolePermissions = asyncHandler(async (req: Request, res: Response) => {
  const terminal = Number((req.query as any)?.terminal) || 1
  const ids = await RoleService.getRolePermissions(Number(req.params.id), terminal)
  return success(res, ids, '查询成功')
})

export const assignPermissions = asyncHandler(async (req: Request, res: Response) => {
  // terminal: 'pc'/'allp' → 1, 'mobile' → 2, 'all' → 1 (UI 并集视图保存默认给 PC 端，Service 内部 expandTerminal 自动同步另一端)
  const terminal = Number((req.body as any)?.terminal) || 1
  await RoleService.assignPermissions(Number(req.params.id), req.body.perm_ids, terminal)
  return success(res, null, '权限分配成功')
})

/** 启动时初始化默认权限菜单 —— 保留 named export 兼容 app.ts / init-db.ts */
export async function initDefaultPermissions() {
  await RoleService.initDefaultPermissions()
}

export default { list, create, update, remove, detail, listPermissions, getRolePermissions, assignPermissions, initDefaultPermissions }
