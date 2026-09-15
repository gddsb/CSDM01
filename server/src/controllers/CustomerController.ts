/**
 * 客户档案 Controller — 全部逻辑下沉 CustomerService
 * 保留 5 个 named export + default 导出兼容 routes/basic.ts
 */
import CustomerService from '../services/CustomerService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await CustomerService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerService.detail(Number(req.params.id))
  return success(res, customer, '查询成功')
})

export const create = async (req: Request, res: Response) => {
  try {
    const customer = await CustomerService.create(req.body, (req as any).user)
    return success(res, customer, '创建成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const update = async (req: Request, res: Response) => {
  try {
    const customer = await CustomerService.update(Number(req.params.id), req.body)
    return success(res, customer, '修改成功')
  } catch (err: any) { return catchErr(res, err) }
}

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await CustomerService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export default { list, detail, create, update, remove }
