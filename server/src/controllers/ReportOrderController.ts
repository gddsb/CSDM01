/**
 * 生产报工单 Controller
 *
 * 仅做：参数接收 → 调用 ReportOrderService → 统一响应
 * 业务逻辑 + 事务 + 超额报工校验 全部下沉到 ReportOrderService
 * 状态流转委托 ReportWorkflowService（通过 ReportOrderService 中转）
 */
import { ReportOrderService, type ReportOrderCreateInput, type ReportOrderUpdateInput } from '../services/ReportOrderService.js'
import { ProcessDefectService } from '../services/ProcessDefectService.js'
import { ProcessExceptionService } from '../services/ProcessExceptionService.js'
import { ManpowerRecordService } from '../services/ManpowerRecordService.js'
import ProcessMaterialService from '../services/ProcessMaterialService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import { logger } from '../utils/logger.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const scopeWhere = (req as any).permV2?.scopeWhere
  const result = await ReportOrderService.list(req.query, scopeWhere)
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

/** 完工前预检 —— 返回结构化 check items 给前端弹窗展示 */
export const preCheck = asyncHandler(async (req: Request, res: Response) => {
  const result = await ReportOrderService.preCheck(Number(req.params.id))
  return success(res, result)
})

/**
 * 移动端详情页聚合接口 —— 5 表并发查询一次返回，省 4 次 HTTP RTT + 4 次权限校验
 * 替代移动端 ReportOrderDetail 里 5 个独立 Promise.all 并发请求
 */
export const aggregate = asyncHandler(async (req: Request, res: Response) => {
  const reportOrderId = Number(req.params.id)
  if (!reportOrderId) return success(res, null, '参数错误')

  // dataScope middleware 已在路由层挂好，Sequelize query hook 自动注入 scopeWhere
  const queries: any[] = [
    ProcessDefectService.list({ report_order_id: reportOrderId, pageSize: 1000 }),
    ProcessDefectService.scrapList(reportOrderId),
    ProcessExceptionService.list({ report_order_id: reportOrderId, pageSize: 1000 }),
    ManpowerRecordService.list({ report_order_id: reportOrderId, pageSize: 1000 }),
    ProcessMaterialService.list({ report_order_id: reportOrderId, pageSize: 1000 }),
  ]

  const [defectRes, scrapRes, exceptionRes, manpowerRes, materialRes] = await Promise.all(
    queries.map(q => q.then(r => r ?? []).catch(err => {
      logger.warn('[ReportOrder.aggregate] sub-query failed:', err?.message)
      return []
    }))
  )

  // 统一 list 输出（Service.list 可能返回 rows 对象也可能直接数组，兼容两种）
  const toList = (r: any) => Array.isArray(r) ? r : (r?.rows ?? r?.list ?? [])

  return success(res, {
    defects: toList(defectRes),
    scraps: toList(scrapRes),
    exceptions: toList(exceptionRes),
    manpower: toList(manpowerRes),
    materials: toList(materialRes),
  })
})

/** 兼容导出：报工单与订单状态联动（历史内部调用入口） */
export async function syncOrderStatus(orderId: number, transaction?: any) {
  return ReportOrderService.syncOrderStatus(orderId, transaction)
}

export default { list, detail, create, update, remove, finish, close, preCheck, getProcesses, syncOrderStatus }
