/**
 * 工序不良 Controller — 仅参数解析 + Service 调用
 */
import ProcessDefectService from '../services/ProcessDefectService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const items = await ProcessDefectService.list(req.query)
  return success(res, items, '查询成功')
})

export const scrapList = asyncHandler(async (req: Request, res: Response) => {
  const items = await ProcessDefectService.scrapList(Number((req.query as any).report_order_id))
  return success(res, items)
})

export const scrapCreate = asyncHandler(async (req: Request, res: Response) => {
  const result = await ProcessDefectService.batchSave(req.body)
  return success(res, result, '保存成功')
})

export const scrapUpdate = asyncHandler(async (req: Request, res: Response) => {
  const result = await ProcessDefectService.batchSave(req.body)
  return success(res, result, '更新成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const defect = await ProcessDefectService.create(req.body)
  return success(res, defect, '创建成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await ProcessDefectService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export const batchSave = asyncHandler(async (req: Request, res: Response) => {
  const result = await ProcessDefectService.batchSave(req.body)
  return success(res, result, '批量保存成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await ProcessDefectService.update(Number(req.params.id), req.body)
  return success(res, result, '更新成功')
})

export default { list, create, remove, update, batchSave, scrapList, scrapCreate, scrapUpdate }
