/**
 * 设备备件库存 Controller — 仅参数解析 + Service 调用
 * 业务逻辑（出入库事务、库存不足校验、日志写入）全部下沉
 */
import DeviceSparePartService from '../services/DeviceSparePartService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export default {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await DeviceSparePartService.list(req.query)
    return success(res, rows, '查询成功', count)
  }),
  detail: asyncHandler(async (req: Request, res: Response) => {
    const part = await DeviceSparePartService.detail(Number(req.params.id))
    return success(res, part, '查询成功')
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const part = await DeviceSparePartService.create(req.body)
    return success(res, part, '创建成功')
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const part = await DeviceSparePartService.update(Number(req.params.id), req.body)
    return success(res, part, '修改成功')
  }),
  delete: asyncHandler(async (req: Request, res: Response) => {
    await DeviceSparePartService.delete(Number(req.params.id))
    return success(res, null, '删除成功')
  }),
  stockIn: asyncHandler(async (req: Request, res: Response) => {
    const part = await DeviceSparePartService.stockIn(Number(req.params.id), req.body, (req as any).user)
    return success(res, part, '入库成功')
  }),
  stockOut: asyncHandler(async (req: Request, res: Response) => {
    const part = await DeviceSparePartService.stockOut(Number(req.params.id), req.body, (req as any).user)
    return success(res, part, '出库成功')
  }),
  stockAdjust: asyncHandler(async (req: Request, res: Response) => {
    const part = await DeviceSparePartService.stockAdjust(Number(req.params.id), req.body, (req as any).user)
    return success(res, part, '调整成功')
  }),
  listLogs: asyncHandler(async (req: Request, res: Response) => {
    const logs = await DeviceSparePartService.listLogs(Number(req.params.id))
    return success(res, logs)
  }),
  getLowStock: asyncHandler(async (_req: Request, res: Response) => {
    const parts = await DeviceSparePartService.getLowStock()
    return success(res, parts)
  }),
}
