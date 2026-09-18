/**
 * 制程物料 Controller — CRUD 全部下沉 ProcessMaterialService
 */
import ProcessMaterialService from '../services/ProcessMaterialService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await ProcessMaterialService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await ProcessMaterialService.create(req.body)
  return success(res, record, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const record = await ProcessMaterialService.update(String(req.params.id), req.body)
  return success(res, record, '更新成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await ProcessMaterialService.remove(String(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, create, update, remove }
