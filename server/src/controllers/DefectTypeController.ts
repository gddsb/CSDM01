/**
 * 不良分类 Controller — CRUD + nextCode 下沉 DefectTypeService
 * 保留 fs 级联删除（物理图片清理）在 Controller.remove
 */
import path from 'path'
import fs from 'fs'
import DefectTypeService from '../services/DefectTypeService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await DefectTypeService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const defect = await DefectTypeService.detail(Number(req.params.id))
  return success(res, defect, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const defect = await DefectTypeService.create(req.body)
  return success(res, defect, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const defect = await DefectTypeService.update(Number(req.params.id), req.body)
  return success(res, defect, '修改成功')
})

/** 删除不良分类 —— 先清理物理图片，再 Service 级联 DB 删除 */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const imagePaths = await DefectTypeService.remove(Number(req.params.id))
  // fs 清理（物理删除关联图片）
  for (const url of imagePaths) {
    try {
      const filePath = path.resolve(process.cwd(), url.replace(/^\//, ''))
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (err) {
      logger.warn('[DefectType] remove image failed:', url, err)
    }
  }
  return success(res, null, '删除成功')
})

export const nextCode = asyncHandler(async (req: Request, res: Response) => {
  const { defect_type, category_name } = req.query as any
  const data = await DefectTypeService.nextCode(defect_type, category_name)
  return success(res, data, '查询成功')
})

export default { list, detail, create, update, remove, nextCode }
