/**
 * 供应商档案 Controller — 全部业务逻辑下沉 SupplierService
 * 保留 fs 读 suppliers.json 在 seed 端点（外部数据文件属于 IO 边界）
 * routes/basic.ts 以 default import 使用 SupplierController.list/create/...
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import SupplierService from '../services/SupplierService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

export default {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await SupplierService.list(req.query)
    return success(res, rows, '查询成功', count)
  }),

  detail: asyncHandler(async (req: Request, res: Response) => {
    const supplier = await SupplierService.detail(Number(req.params.id))
    return success(res, supplier, '查询成功')
  }),

  create: async (req: Request, res: Response) => {
    try {
      const supplier = await SupplierService.create(req.body, (req as any).user)
      return success(res, supplier, '创建成功')
    } catch (err: any) { return catchErr(res, err) }
  },

  update: async (req: Request, res: Response) => {
    try {
      const supplier = await SupplierService.update(Number(req.params.id), req.body)
      return success(res, supplier, '修改成功')
    } catch (err: any) { return catchErr(res, err) }
  },

  remove: asyncHandler(async (req: Request, res: Response) => {
    await SupplierService.remove(Number(req.params.id))
    return success(res, null, '删除成功')
  }),

  /** 种子数据导入 —— fs 读文件保留在 Controller */
  seed: asyncHandler(async (req: Request, res: Response) => {
    const filePath = path.join(__dirname, '..', 'seeders', 'suppliers.json')
    if (!fs.existsSync(filePath)) {
      return fail(res, '种子数据文件不存在', ErrorCode.RECORD_NOT_FOUND)
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    const count = await SupplierService.seed(data)
    return success(res, { count }, `种子数据导入成功（${count}条）`)
  }),
}
