/**
 * 人员工时 Controller — 业务逻辑下沉 ManpowerRecordService
 */
import ManpowerRecordService from '../services/ManpowerRecordService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

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
export const update = async (req: Request, res: Response) => {
  try { const r = await ManpowerRecordService.update(Number(req.params.id), req.body); return success(res, r, '修改成功') } catch (err: any) { return catchErr(res, err) }
}
export const remove = asyncHandler(async (_req: Request, res: Response) => {
  await ManpowerRecordService.remove()
  return success(res, null)
})
export const summaryByReportOrder = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await ManpowerRecordService.summaryByReportOrder(req.query)
  return success(res, rows, '查询成功', count)
})
export default { list, detail, create, update, remove, summaryByReportOrder }
