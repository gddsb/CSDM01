/** 微生物检验 Controller — 业务逻辑下沉 MicrobeInspectionService */
import MicrobeInspectionService from '../services/MicrobeInspectionService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  logger.error('[MicrobeInspection] controller error:', err)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

export default {
  async list(req: any, res: any) {
    try {
      const data = await MicrobeInspectionService.list(req.query)
      success(res, { list: data.list, total: data.total, page: data.page, page_size: data.page_size, stats: data.stats })
    } catch (err: any) { return catchErr(res, err) }
  },
  async detail(req: any, res: any) {
    try {
      const record = await MicrobeInspectionService.detail(Number(req.params.id))
      success(res, record)
    } catch (err: any) { return catchErr(res, err) }
  },
  async create(req: any, res: any) {
    try { const d = await MicrobeInspectionService.create(req.body); success(res, d, '创建成功') } catch (err: any) { return catchErr(res, err) }
  },
  async update(req: any, res: any) {
    try { const d = await MicrobeInspectionService.update(Number(req.params.id), req.body); success(res, d, '更新成功') } catch (err: any) { return catchErr(res, err) }
  },
  async delete(req: any, res: any) {
    try { await MicrobeInspectionService.delete(Number(req.params.id)); success(res, { message: '删除成功' }, '删除成功') } catch (err: any) { return catchErr(res, err) }
  },
}
