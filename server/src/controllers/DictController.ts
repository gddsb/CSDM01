/**
 * 字典管理 Controller — 全部逻辑下沉 DictService
 * 保留 11 个 named export 兼容 routes/system.ts 的导入方式
 */
import DictService from '../services/DictService.js'
import { success, fail } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', 500)
}
const paramStr = (v: any): string => (Array.isArray(v) ? v[0] : v) || ''

// ============================================================
// 字典类型
// ============================================================

export const listType = async (req: Request, res: Response) => {
  try {
    const { rows, count } = await DictService.listType(req.query)
    return success(res, rows, '查询成功', count)
  } catch (err: any) { return catchErr(res, err) }
}

export const getType = async (req: Request, res: Response) => {
  try {
    const dict = await DictService.getType(Number(req.params.id))
    return success(res, dict, '查询成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const createType = async (req: Request, res: Response) => {
  try {
    const dict = await DictService.createType(req.body, (req as any).user)
    return success(res, dict, '创建成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const updateType = async (req: Request, res: Response) => {
  try {
    const dict = await DictService.updateType(Number(req.params.id), req.body)
    return success(res, dict, '更新成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const removeType = async (req: Request, res: Response) => {
  try {
    await DictService.removeType(Number(req.params.id))
    return success(res, null, '删除成功')
  } catch (err: any) { return catchErr(res, err) }
}

// ============================================================
// 字典数据
// ============================================================

export const listData = async (req: Request, res: Response) => {
  try {
    const { rows, count } = await DictService.listData(req.query)
    return success(res, rows, '查询成功', count)
  } catch (err: any) { return catchErr(res, err) }
}

export const listDataByType = async (req: Request, res: Response) => {
  try {
    const data = await DictService.listDataByType(paramStr(req.params.type))
    return success(res, data, '查询成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const getData = async (req: Request, res: Response) => {
  try {
    const data = await DictService.getData(paramStr(req.params.code))
    return success(res, data, '查询成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const createData = async (req: Request, res: Response) => {
  try {
    const data = await DictService.createData(req.body)
    return success(res, data, '创建成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const updateData = async (req: Request, res: Response) => {
  try {
    const data = await DictService.updateData(paramStr(req.params.code), req.body)
    return success(res, data, '更新成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const removeData = async (req: Request, res: Response) => {
  try {
    await DictService.removeData(paramStr(req.params.code))
    return success(res, null, '删除成功')
  } catch (err: any) { return catchErr(res, err) }
}
