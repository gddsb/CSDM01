/**
 * 角色 Controller — 业务逻辑下沉 RoleService
 * 保留 named exports + initDefaultPermissions（被 app.ts / init-db.ts 直接调用）
 */
import RoleService from '../services/RoleService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await RoleService.list(req.query)
  return success(res, rows, '查询成功', count)
})
export const create = async (req: Request, res: Response) => {
  try { return success(res, await RoleService.create(req.body), '创建成功') } catch (err: any) { return catchErr(res, err) }
}
export const update = async (req: Request, res: Response) => {
  try { return success(res, await RoleService.update(Number(req.params.id), req.body), '修改成功') } catch (err: any) { return catchErr(res, err) }
}
export const remove = async (req: Request, res: Response) => {
  try { await RoleService.remove(Number(req.params.id)); return success(res, null, '删除成功') } catch (err: any) { return catchErr(res, err) }
}
export const listPermissions = asyncHandler(async (_req: Request, res: Response) => {
  const perms = await RoleService.listPermissions()
  return success(res, perms, '查询成功')
})
export const getRolePermissions = asyncHandler(async (req: Request, res: Response) => {
  const ids = await RoleService.getRolePermissions(Number(req.params.id))
  return success(res, ids, '查询成功')
})
export const assignPermissions = async (req: Request, res: Response) => {
  try { await RoleService.assignPermissions(Number(req.params.id), req.body.perm_ids); return success(res, null, '权限分配成功') } catch (err: any) { return catchErr(res, err) }
}
/** 启动时初始化默认权限菜单 —— 保留 named export 兼容 app.ts / init-db.ts */
export async function initDefaultPermissions() {
  await RoleService.initDefaultPermissions()
}
export default { list, create, update, remove, listPermissions, getRolePermissions, assignPermissions, initDefaultPermissions }
