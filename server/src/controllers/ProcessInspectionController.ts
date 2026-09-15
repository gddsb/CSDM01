/**
 * 过程检验 Controller — 仅参数解析 + Service 调用 + 响应
 */
import ProcessInspectionService from '../services/ProcessInspectionService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export default {
  listWip: asyncHandler(async (req: Request, res: Response) => {
    const result = await ProcessInspectionService.listWip(req.query)
    return success(res, result, '查询成功')
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await ProcessInspectionService.list(req.query)
    return success(res, result, '查询成功')
  }),

  detail: asyncHandler(async (req: Request, res: Response) => {
    const record = await ProcessInspectionService.detail(Number(req.params.id))
    return success(res, record)
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const record = await ProcessInspectionService.create(req.body)
    return success(res, record, '创建成功')
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
    const record = await ProcessInspectionService.submit(req.body, (req as any).user)
    return success(res, record, '提交成功')
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const record = await ProcessInspectionService.update(Number(req.params.id), req.body)
    return success(res, record, '更新成功')
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await ProcessInspectionService.remove(Number(req.params.id))
    return success(res, null, '删除成功')
  }),
}
