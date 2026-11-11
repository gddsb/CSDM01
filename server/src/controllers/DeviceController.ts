/**
 * 设备管理 Controller
 *
 * 仅做：参数接收 → 调用 DeviceService → 统一响应
 * 业务逻辑全部下沉到 DeviceService
 */
import { DeviceService, type DeviceListQuery, type DeviceCreateInput, type DeviceUpdateInput } from '../services/DeviceService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await DeviceService.list(req.query as DeviceListQuery)
  return success(res, result.rows, '查询成功', result.count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const device = await DeviceService.detail(Number(req.params.id))
  return success(res, device, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const device = await DeviceService.create(req.body as DeviceCreateInput)
  return success(res, device, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const device = await DeviceService.update(Number(req.params.id), req.body as DeviceUpdateInput)
  return success(res, device, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await DeviceService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, detail, create, update, remove }
