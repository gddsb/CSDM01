/**
 * 环境检验 Controller — 全部逻辑下沉 EnvInspectionService
 * 三层结构：inspection / area / template
 */
import EnvInspectionService from '../services/EnvInspectionService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export default {
  // ==== 环境检验 ====
  list: asyncHandler(async (req: Request, res: Response) => {
    const { count, rows } = await EnvInspectionService.inspection.list(req.query)
    return success(res, { list: rows, total: count, page: Number(req.query.page) || 1, page_size: Number(req.query.page_size) || 20 })
  }),

  detail: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.inspection.detail(Number(req.params.id)))
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.inspection.create(req.body), '创建成功')
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.inspection.update(Number(req.params.id), req.body), '更新成功')
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await EnvInspectionService.inspection.delete(Number(req.params.id))
    return success(res, null, '删除成功')
  }),

  // ==== 环境检验区域 ====
  listAreas: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.area.list(req.query))
  }),

  createArea: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.area.create(req.body), '创建成功')
  }),

  updateArea: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.area.update(Number(req.params.id), req.body), '更新成功')
  }),

  deleteArea: asyncHandler(async (req: Request, res: Response) => {
    await EnvInspectionService.area.remove(Number(req.params.id))
    return success(res, null, '删除成功')
  }),

  // ==== 环境检验模板 ====
  listTemplates: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.template.list(req.query))
  }),

  createTemplate: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.template.create(req.body), '创建成功')
  }),

  updateTemplate: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.template.update(Number(req.params.id), req.body), '更新成功')
  }),

  deleteTemplate: asyncHandler(async (req: Request, res: Response) => {
    await EnvInspectionService.template.remove(Number(req.params.id))
    return success(res, null, '删除成功')
  }),

  getTemplatesByArea: asyncHandler(async (req: Request, res: Response) => {
    return success(res, await EnvInspectionService.template.listByArea(Number(req.params.areaId)))
  }),
}
