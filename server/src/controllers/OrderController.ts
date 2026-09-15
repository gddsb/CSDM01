/**
 * 生产工单 Controller
 *
 * 仅做：参数接收 → 调用 OrderService → 统一响应
 * 业务逻辑全部下沉到 OrderService；状态流转委托 OrderWorkflowService
 */
import { OrderService, type OrderCreateInput, type OrderUpdateInput } from '../services/OrderService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: any, res: Response) => {
  const result = await OrderService.list(req.query)
  return success(res, result.rows, '查询成功', result.count)
})

export const detail = asyncHandler(async (req: any, res: Response) => {
  const order = await OrderService.detail(Number(req.params.id))
  return success(res, order, '查询成功')
})

export const create = asyncHandler(async (req: any, res: Response) => {
  const order = await OrderService.create(
    req.body as OrderCreateInput,
    (req as any).user?.username
  )
  return success(res, order, '创建成功')
})

export const update = asyncHandler(async (req: any, res: Response) => {
  const order = await OrderService.update(Number(req.params.id), req.body as OrderUpdateInput)
  return success(res, order, '修改成功')
})

export const remove = asyncHandler(async (req: any, res: Response) => {
  await OrderService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export const release = asyncHandler(async (req: any, res: Response) => {
  const order = await OrderService.release(Number(req.params.id), (req as any).user)
  return success(res, order, '订单已下发')
})

export const close = asyncHandler(async (req: any, res: Response) => {
  const order = await OrderService.close(Number(req.params.id), (req as any).user)
  return success(res, order, '订单已关闭')
})

export const finish = asyncHandler(async (req: any, res: Response) => {
  const order = await OrderService.finish(Number(req.params.id), (req as any).user)
  return success(res, order, '订单已完工')
})

export default { list, detail, create, update, remove, release, close, finish }
