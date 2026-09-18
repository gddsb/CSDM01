/** 产线 Controller — CRUD 全部下沉 ProductionLineService */
import ProductionLineService from '../services/ProductionLineService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await ProductionLineService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const line = await ProductionLineService.detail(Number(req.params.id))
  return success(res, line, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const l = await ProductionLineService.create(req.body)
  return success(res, l, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const l = await ProductionLineService.update(Number(req.params.id), req.body)
  return success(res, l, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await ProductionLineService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, detail, create, update, remove }
