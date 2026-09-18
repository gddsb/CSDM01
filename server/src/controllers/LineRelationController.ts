/**
 * 产线关联 Controller — 全部逻辑下沉 LineRelationService
 */
import LineRelationService from '../services/LineRelationService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

// ============================================================
// 产线 — 工序
// ============================================================

export const getLineProcesses = asyncHandler(async (req: Request, res: Response) => {
  const result = await LineRelationService.getLineProcesses(Number(req.params.id))
  return success(res, result, '查询成功')
})

export const addLineProcess = asyncHandler(async (req: Request, res: Response) => {
  const lineProcess = await LineRelationService.addLineProcess(
    Number(req.params.id),
    Number(req.body.process_id),
    Number(req.body.sort_order) || 0,
  )
  return success(res, lineProcess, '关联成功')
})

export const removeLineProcess = asyncHandler(async (req: Request, res: Response) => {
  await LineRelationService.removeLineProcess(Number(req.params.id), Number(req.params.processId))
  return success(res, null, '移除成功')
})

export const updateLineProcessSort = asyncHandler(async (req: Request, res: Response) => {
  await LineRelationService.updateLineProcessSort(req.body.items)
  return success(res, null, '排序更新成功')
})

// ============================================================
// 产线 — 设备
// ============================================================

export const getLineDevices = asyncHandler(async (req: Request, res: Response) => {
  const result = await LineRelationService.getLineDevices(Number(req.params.id))
  return success(res, result, '查询成功')
})

export const addLineDevice = asyncHandler(async (req: Request, res: Response) => {
  const lineDevice = await LineRelationService.addLineDevice(
    Number(req.params.id),
    Number(req.body.device_id),
    req.body.process_id ? Number(req.body.process_id) : null,
    Number(req.body.sort_order) || 0,
  )
  return success(res, lineDevice, '关联成功')
})

export const removeLineDevice = asyncHandler(async (req: Request, res: Response) => {
  await LineRelationService.removeLineDevice(Number(req.params.id), Number(req.params.deviceId))
  return success(res, null, '移除成功')
})

export const updateLineDeviceSort = asyncHandler(async (req: Request, res: Response) => {
  await LineRelationService.updateLineDeviceSort(req.body.items)
  return success(res, null, '排序更新成功')
})

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
