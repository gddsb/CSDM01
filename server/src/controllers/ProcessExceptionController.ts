/**
 * 工序异常工时 Controller — 仅参数解析 + Service 调用
 */
import ProcessExceptionService from '../services/ProcessExceptionService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await ProcessExceptionService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await ProcessExceptionService.create(req.body, (req as any).user)
  return success(res, record, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const record = await ProcessExceptionService.update(Number(req.params.id), req.body, (req as any).user)
  return success(res, record, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await ProcessExceptionService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, create, update, remove }
