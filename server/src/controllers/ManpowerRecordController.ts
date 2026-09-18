/**
 * 人员工时 Controller — CRUD 全部下沉 ManpowerRecordService
 */
import ManpowerRecordService from '../services/ManpowerRecordService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await ManpowerRecordService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const r = await ManpowerRecordService.detail(Number(req.params.id))
  return success(res, r)
})

export const create = asyncHandler(async (_req: Request, res: Response) => {
  await ManpowerRecordService.create()
  return success(res, null)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const r = await ManpowerRecordService.update(Number(req.params.id), req.body)
  return success(res, r, '修改成功')
})

export const remove = asyncHandler(async (_req: Request, res: Response) => {
  await ManpowerRecordService.remove()
  return success(res, null)
})

export const summaryByReportOrder = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await ManpowerRecordService.summaryByReportOrder(req.query)
  return success(res, rows, '查询成功', count)
})

export default { list, detail, create, update, remove, summaryByReportOrder }
