/**
 * 工序 Controller — CRUD 全部下沉 ProcessService
 */
import ProcessService from '../services/ProcessService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await ProcessService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const process = await ProcessService.detail(Number(req.params.id))
  return success(res, process, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const process = await ProcessService.create(req.body)
  return success(res, process, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const process = await ProcessService.update(Number(req.params.id), req.body)
  return success(res, process, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await ProcessService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, detail, create, update, remove }
