/**
 * 字典管理 Controller — 全部逻辑下沉 DictService
 */
import DictService from '../services/DictService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

// ============================================================
// 字典类型
// ============================================================

export const listType = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await DictService.listType(req.query)
  return success(res, rows, '查询成功', count)
})

export const getType = asyncHandler(async (req: Request, res: Response) => {
  const dict = await DictService.getType(Number(req.params.id))
  return success(res, dict, '查询成功')
})

export const createType = asyncHandler(async (req: Request, res: Response) => {
  const dict = await DictService.createType(req.body, (req as any).user)
  return success(res, dict, '创建成功')
})

export const updateType = asyncHandler(async (req: Request, res: Response) => {
  const dict = await DictService.updateType(Number(req.params.id), req.body)
  return success(res, dict, '更新成功')
})

export const removeType = asyncHandler(async (req: Request, res: Response) => {
  await DictService.removeType(Number(req.params.id))
  return success(res, null, '删除成功')
})

// ============================================================
// 字典数据
// ============================================================

export const listData = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await DictService.listData(req.query)
  return success(res, rows, '查询成功', count)
})

export const listDataByType = asyncHandler(async (req: Request, res: Response) => {
  const data = await DictService.listDataByType(String(req.params.type))
  return success(res, data, '查询成功')
})

export const getData = asyncHandler(async (req: Request, res: Response) => {
  const data = await DictService.getData(String(req.params.code))
  return success(res, data, '查询成功')
})

export const createData = asyncHandler(async (req: Request, res: Response) => {
  const data = await DictService.createData(req.body)
  return success(res, data, '创建成功')
})

export const updateData = asyncHandler(async (req: Request, res: Response) => {
  const data = await DictService.updateData(String(req.params.code), req.body)
  return success(res, data, '更新成功')
})

export const removeData = asyncHandler(async (req: Request, res: Response) => {
  await DictService.removeData(String(req.params.code))
  return success(res, null, '删除成功')
})
