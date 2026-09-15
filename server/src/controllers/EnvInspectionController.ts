/**
 * 环境检验 Controller — 业务逻辑下沉 EnvInspectionService
 * 保留 default export 供 routes/basic.ts 使用（13 个方法）
 */
import EnvInspectionService from '../services/EnvInspectionService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import type { Request, Response } from 'express'

const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  logger.error('[EnvInspection] controller error:', err)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

export default {
  async list(req: any, res: any) {
    try { const { count, rows } = await EnvInspectionService.inspection.list(req.query); success(res, { list: rows, total: count, page: Number(req.query.page) || 1, page_size: Number(req.query.page_size) || 20 }) } catch (err: any) { return catchErr(res, err) }
  },
  async detail(req: any, res: any) {
    try { success(res, await EnvInspectionService.inspection.detail(Number(req.params.id))) } catch (err: any) { return catchErr(res, err) }
  },
  async create(req: any, res: any) {
    try { success(res, await EnvInspectionService.inspection.create(req.body), '创建成功') } catch (err: any) { return catchErr(res, err) }
  },
  async update(req: any, res: any) {
    try { success(res, await EnvInspectionService.inspection.update(Number(req.params.id), req.body), '更新成功') } catch (err: any) { return catchErr(res, err) }
  },
  async delete(req: any, res: any) {
    try { await EnvInspectionService.inspection.delete(Number(req.params.id)); success(res, { message: '删除成功' }, '删除成功') } catch (err: any) { return catchErr(res, err) }
  },
  // areas
  async listAreas(req: any, res: any) {
    try { success(res, await EnvInspectionService.area.list(req.query)) } catch (err: any) { return catchErr(res, err) }
  },
  async createArea(req: any, res: any) {
    try { success(res, await EnvInspectionService.area.create(req.body), '创建成功') } catch (err: any) { return catchErr(res, err) }
  },
  async updateArea(req: any, res: any) {
    try { success(res, await EnvInspectionService.area.update(Number(req.params.id), req.body), '更新成功') } catch (err: any) { return catchErr(res, err) }
  },
  async deleteArea(req: any, res: any) {
    try { await EnvInspectionService.area.remove(Number(req.params.id)); success(res, { message: '删除成功' }, '删除成功') } catch (err: any) { return catchErr(res, err) }
  },
  // templates
  async listTemplates(req: any, res: any) {
    try { success(res, await EnvInspectionService.template.list(req.query)) } catch (err: any) { return catchErr(res, err) }
  },
  async createTemplate(req: any, res: any) {
    try { success(res, await EnvInspectionService.template.create(req.body), '创建成功') } catch (err: any) { return catchErr(res, err) }
  },
  async updateTemplate(req: any, res: any) {
    try { success(res, await EnvInspectionService.template.update(Number(req.params.id), req.body), '更新成功') } catch (err: any) { return catchErr(res, err) }
  },
  async deleteTemplate(req: any, res: any) {
    try { await EnvInspectionService.template.remove(Number(req.params.id)); success(res, { message: '删除成功' }, '删除成功') } catch (err: any) { return catchErr(res, err) }
  },
  async getTemplatesByArea(req: any, res: any) {
    try { success(res, await EnvInspectionService.template.listByArea(Number(req.params.areaId))) } catch (err: any) { return catchErr(res, err) }
  },
}
