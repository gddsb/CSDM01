/**
 * 客户档案 Controller — CRUD 全部下沉 CustomerService
 */
import CustomerService from '../services/CustomerService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await CustomerService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerService.detail(Number(req.params.id))
  return success(res, customer, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerService.create(req.body, (req as any).user)
  return success(res, customer, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerService.update(Number(req.params.id), req.body)
  return success(res, customer, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await CustomerService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, detail, create, update, remove }
