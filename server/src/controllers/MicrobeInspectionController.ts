/** 微生物检验 Controller — 全部逻辑下沉 MicrobeInspectionService */
import MicrobeInspectionService from '../services/MicrobeInspectionService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export default {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await MicrobeInspectionService.list(req.query)
    return success(res, { list: data.list, total: data.total, page: data.page, page_size: data.page_size, stats: data.stats })
  }),

  detail: asyncHandler(async (req: Request, res: Response) => {
    const record = await MicrobeInspectionService.detail(Number(req.params.id))
    return success(res, record)
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const d = await MicrobeInspectionService.create(req.body)
    return success(res, d, '创建成功')
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const d = await MicrobeInspectionService.update(Number(req.params.id), req.body)
    return success(res, d, '更新成功')
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await MicrobeInspectionService.delete(Number(req.params.id))
    return success(res, null, '删除成功')
  }),
}
