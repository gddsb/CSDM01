/**
 * 来料检验 Controller — 仅参数解析 + Service 调用 + 响应
 * 业务逻辑全部下沉到 IncomingInspectionService + InspectionWorkflowService
 */
import IncomingInspectionService from '../services/IncomingInspectionService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export default {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await IncomingInspectionService.list(req.query)
    return success(res, result)
  }),

  detail: asyncHandler(async (req: Request, res: Response) => {
    const record = await IncomingInspectionService.detail(Number(req.params.id))
    return success(res, record)
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const record = await IncomingInspectionService.create(req.body)
    return success(res, record, '创建成功')
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const record = await IncomingInspectionService.update(Number(req.params.id), req.body)
    return success(res, record, '更新成功')
  }),

  start: asyncHandler(async (req: Request, res: Response) => {
    const record = await IncomingInspectionService.start(Number(req.params.id), (req as any).user)
    return success(res, record, '开检成功')
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
    await IncomingInspectionService.submit(Number(req.params.id))
    return success(res, { message: '报审成功' }, '报审成功')
  }),

  review: asyncHandler(async (req: Request, res: Response) => {
    const record = await IncomingInspectionService.review(
      Number(req.params.id),
      req.body.result,
      req.body.remarks,
      (req as any).user
    )
    return success(res, record, '审核成功')
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await IncomingInspectionService.delete(Number(req.params.id))
    return success(res, { message: '删除成功' }, '删除成功')
  }),

  syncFromPurchaseReceipts: asyncHandler(async (_req: Request, res: Response) => {
    const result = await IncomingInspectionService.syncFromPurchaseReceipts()
    return success(res, result, `采购入库同步完成：共 ${result.totalReceipts} 条收货记录，新建 ${result.created} 条，更新 ${result.updated} 条`)
  }),
}
