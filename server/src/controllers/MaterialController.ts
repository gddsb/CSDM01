/**
 * 料品 Controller — 全部逻辑下沉 MaterialService
 */
import MaterialService from '../services/MaterialService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await MaterialService.list(req.query)
  return success(res, rows, '查询成功', count)
})
export const detail = asyncHandler(async (req: Request, res: Response) => {
  const material = await MaterialService.detail(Number(req.params.id))
  return success(res, material, '查询成功')
})
export const create = async (req: Request, res: Response) => {
  try { const m = await MaterialService.create(req.body); return success(res, m, '创建成功') } catch (err: any) { return catchErr(res, err) }
}
export const update = async (req: Request, res: Response) => {
  try { const m = await MaterialService.update(Number(req.params.id), req.body); return success(res, m, '修改成功') } catch (err: any) { return catchErr(res, err) }
}
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await MaterialService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})
export default { list, detail, create, update, remove }
