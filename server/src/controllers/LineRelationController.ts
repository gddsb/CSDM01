/**
 * 产线关联 Controller — 全部逻辑下沉 LineRelationService
 * 保留 8 个 named export + default 导出兼容 routes/basic.ts
 */
import LineRelationService from '../services/LineRelationService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

// ============================================================
// 产线 — 工序
// ============================================================

export const getLineProcesses = asyncHandler(async (req: Request, res: Response) => {
  const result = await LineRelationService.getLineProcesses(Number(req.params.id))
  return success(res, result, '查询成功')
})

export const addLineProcess = async (req: Request, res: Response) => {
  try {
    const lineProcess = await LineRelationService.addLineProcess(
      Number(req.params.id),
      Number(req.body.process_id),
      Number(req.body.sort_order) || 0,
    )
    return success(res, lineProcess, '关联成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const removeLineProcess = asyncHandler(async (req: Request, res: Response) => {
  await LineRelationService.removeLineProcess(Number(req.params.id), Number(req.params.processId))
  return success(res, null, '移除成功')
})

export const updateLineProcessSort = async (req: Request, res: Response) => {
  try {
    await LineRelationService.updateLineProcessSort(req.body.items)
    return success(res, null, '排序更新成功')
  } catch (err: any) { return catchErr(res, err) }
}

// ============================================================
// 产线 — 设备
// ============================================================

export const getLineDevices = asyncHandler(async (req: Request, res: Response) => {
  const result = await LineRelationService.getLineDevices(Number(req.params.id))
  return success(res, result, '查询成功')
})

export const addLineDevice = async (req: Request, res: Response) => {
  try {
    const lineDevice = await LineRelationService.addLineDevice(
      Number(req.params.id),
      Number(req.body.device_id),
      req.body.process_id ? Number(req.body.process_id) : null,
      Number(req.body.sort_order) || 0,
    )
    return success(res, lineDevice, '关联成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const removeLineDevice = asyncHandler(async (req: Request, res: Response) => {
  await LineRelationService.removeLineDevice(Number(req.params.id), Number(req.params.deviceId))
  return success(res, null, '移除成功')
})

export const updateLineDeviceSort = async (req: Request, res: Response) => {
  try {
    await LineRelationService.updateLineDeviceSort(req.body.items)
    return success(res, null, '排序更新成功')
  } catch (err: any) { return catchErr(res, err) }
}

export default {
  getLineProcesses,
  addLineProcess,
  removeLineProcess,
  updateLineProcessSort,
  getLineDevices,
  addLineDevice,
  removeLineDevice,
  updateLineDeviceSort,
}
