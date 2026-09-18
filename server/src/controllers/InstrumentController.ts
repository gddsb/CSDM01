/**
 * 检测仪器 Controller — CRUD 全部下沉 InstrumentService
 */
import InstrumentService from '../services/InstrumentService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await InstrumentService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const record = await InstrumentService.detail(String(req.params.id))
  return success(res, record, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await InstrumentService.create(req.body)
  return success(res, record, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const record = await InstrumentService.update(String(req.params.id), req.body)
  return success(res, record, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await InstrumentService.remove(String(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, detail, create, update, remove }
