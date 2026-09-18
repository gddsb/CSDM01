/**
 * 料品 Controller — CRUD 全部下沉 MaterialService
 */
import MaterialService from '../services/MaterialService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await MaterialService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const material = await MaterialService.detail(Number(req.params.id))
  return success(res, material, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const m = await MaterialService.create(req.body)
  return success(res, m, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const m = await MaterialService.update(Number(req.params.id), req.body)
  return success(res, m, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await MaterialService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, detail, create, update, remove }
