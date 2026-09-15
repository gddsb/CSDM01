/**
 * 设备故障管理 Controller — 仅参数解析 + Service 调用
 */
import path from 'path'
import fs from 'fs'
import DeviceFaultService from '../services/DeviceFaultService.js'
import { DeviceFault, DeviceImage } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export default {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await DeviceFaultService.list(req.query)
    return success(res, rows, '查询成功', count)
  }),
  detail: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceFaultService.detail(Number(req.params.id))
    return success(res, record, '查询成功')
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceFaultService.create(req.body, (req as any).user)
    return success(res, record, '创建成功')
  }),
  assign: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceFaultService.assign(Number(req.params.id), req.body, (req as any).user)
    return success(res, record, '指派成功')
  }),
  submitRepair: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceFaultService.submitRepair(Number(req.params.id), req.body, (req as any).user)
    return success(res, record, '维修结果提交成功')
  }),
  approve: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceFaultService.approve(Number(req.params.id), req.body, (req as any).user)
    return success(res, record, '审批成功')
  }),
  close: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceFaultService.close(Number(req.params.id), req.body, (req as any).user)
    return success(res, record, '关闭成功')
  }),
  delete: asyncHandler(async (req: Request, res: Response) => {
    await DeviceFaultService.delete(Number(req.params.id))
    return success(res, null, '删除成功')
  }),
  getImages: asyncHandler(async (req: Request, res: Response) => {
    const images = await DeviceFaultService.getImages(Number(req.params.id))
    return success(res, images)
  }),
  // uploadImage 保留原实现（文件系统 IO）
  async uploadImage(req: any, res: any) {
    const t = await DeviceFault.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const record = await DeviceFault.findOne({ where: { fault_id: id }, transaction: t })
      if (!record) {
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length === 0) return fail(res, '请选择要上传的图片', ErrorCode.PARAM_INVALID)
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'fault')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
      const existingCount = await DeviceImage.count({ where: { doc_type: 'fault', doc_id: id }, transaction: t })
      const created: any[] = []
      const ts = Date.now()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const seqNum = existingCount + i + 1
        const ext = path.extname(file.originalname) || '.jpg'
        const newName = `fault_${id}_${seqNum}_${ts}${ext}`
        fs.renameSync(file.path, path.join(uploadsDir, newName))
        const rel = await DeviceImage.create({
          doc_type: 'fault', doc_id: Number(id),
          file_path: `/uploads/device/fault/${newName}`, file_name: file.originalname || newName,
          file_size: file.size || null, sort_order: seqNum,
          uploaded_by: userInfo.userId || null, uploaded_by_name: userInfo.username || '',
        }, { transaction: t })
        created.push(rel)
      }
      await t.commit()
      success(res, created, `成功上传${created.length}张图片`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceFault] uploadImage error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
