/**
 * 检验标准 Controller — 仅参数解析 + Service 调用 + 响应
 * 业务逻辑（编号生成、同标准号生效自动失效其他版本、改版/复制）全部下沉
 */
import InspectionStandardService from '../services/InspectionStandardService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const generateNo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.query.standard_type) return success(res, { standard_no: '' }, '')
  const result = await InspectionStandardService.generateNo(req.query.standard_type as string)
  return success(res, result)
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { count, rows } = await InspectionStandardService.list(req.query)
  return success(res, { list: rows, total: count, page: parseInt(req.query.page as string, 10) || 1, page_size: parseInt(req.query.page_size as string, 10) || 20 })
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const record = await InspectionStandardService.detail(Number(req.params.id))
  return success(res, record)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await InspectionStandardService.create(req.body, (req as any).user?.userId)
  return success(res, record, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const record = await InspectionStandardService.update(Number(req.params.id), req.body)
  return success(res, record, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await InspectionStandardService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export const copy = asyncHandler(async (req: Request, res: Response) => {
  const record = await InspectionStandardService.copy(Number(req.params.id), (req as any).user?.userId)
  return success(res, record, '复制成功')
})

export const revise = asyncHandler(async (req: Request, res: Response) => {
  const record = await InspectionStandardService.revise(Number(req.params.id), (req as any).user?.userId)
  return success(res, record, '改版成功')
})

export const listItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await InspectionStandardService.listItems(Number((req.params as any).standardId))
  return success(res, items)
})

export default { list, detail, create, update, remove, listItems, generateNo, copy, revise }
