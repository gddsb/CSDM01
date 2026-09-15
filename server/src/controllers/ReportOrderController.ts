/**
 * 生产报工单 Controller
 *
 * 仅做：参数接收 → 调用 ReportOrderService → 统一响应
 * 业务逻辑 + 事务 + 超额报工校验 全部下沉到 ReportOrderService
 * 状态流转委托 ReportWorkflowService（通过 ReportOrderService 中转）
 */
import { ReportOrderService, type ReportOrderCreateInput, type ReportOrderUpdateInput } from '../services/ReportOrderService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await ReportOrderService.list(req.query)
  return success(res, result.rows, '查询成功', result.count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const reportOrder = await ReportOrderService.detail(Number(req.params.id))
  return success(res, reportOrder, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await ReportOrderService.create(
    req.body as ReportOrderCreateInput,
    (req as any).user
  )
  const msg = result.idempotent
    ? '当日同产线已存在报工单，返回已有记录'
    : '创建成功'
  return success(res, result.reportOrder, msg)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const reportOrder = await ReportOrderService.update(
    Number(req.params.id),
    req.body as ReportOrderUpdateInput
  )
  return success(res, reportOrder, '修改成功')
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await ReportOrderService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export const getProcesses = asyncHandler(async (req: Request, res: Response) => {
  const processes = await ReportOrderService.getProcesses(Number(req.params.id))
  return success(res, processes)
})

export const finish = asyncHandler(async (req: Request, res: Response) => {
  const result = await ReportOrderService.finish(Number(req.params.id), (req as any).user)
  return success(res, result, '报工单已完工')
})

export const close = asyncHandler(async (req: Request, res: Response) => {
  const result = await ReportOrderService.close(Number(req.params.id), (req as any).user)
  return success(res, result, '报工单已关闭')
})

/** 兼容导出：报工单与订单状态联动（历史内部调用入口） */
export async function syncOrderStatus(orderId: number, transaction?: any) {
  return ReportOrderService.syncOrderStatus(orderId, transaction)
}

export default { list, detail, create, update, remove, finish, close, getProcesses, syncOrderStatus }
