/**
 * InstrumentController — Sequelize CRUD 下沉 InstrumentService
 * 底层走 Device model（entity_type='仪器'）
 */
import InstrumentService from '../services/InstrumentService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const paramStr = (v: any): string => (Array.isArray(v) ? v[0] : v) || ''
const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await InstrumentService.list(req.query)
  return success(res, rows, '查询成功', count)
})
export const detail = async (req: Request, res: Response) => {
  try { return success(res, await InstrumentService.detail(paramStr(req.params.id)), '查询成功') } catch (err: any) { return catchErr(res, err) }
}
export const create = async (req: Request, res: Response) => {
  try { return success(res, await InstrumentService.create(req.body), '创建成功') } catch (err: any) { return catchErr(res, err) }
}
export const update = async (req: Request, res: Response) => {
  try { return success(res, await InstrumentService.update(paramStr(req.params.id), req.body), '修改成功') } catch (err: any) { return catchErr(res, err) }
}
export const remove = async (req: Request, res: Response) => {
  try { await InstrumentService.remove(paramStr(req.params.id)); return success(res, null, '删除成功') } catch (err: any) { return catchErr(res, err) }
}

export default { list, detail, create, update, remove }
