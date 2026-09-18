/**
 * 设备校准 Controller — DB CRUD 全走 Service；fs 边界（uploadCertificate）保留 Controller
 */
import path from 'path'
import fs from 'fs'
import sequelize from '../config/database.js'
import DeviceCalibrationService from '../services/DeviceCalibrationService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

function cleanupFiles(files: any[]) {
  if (!files || files.length === 0) return
  for (const f of files) { try { fs.unlinkSync(f.path) } catch { /* ignore */ } }
}

export default {
  listPlans: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await DeviceCalibrationService.listPlans(req.query)
    return success(res, rows, '查询成功', count)
  }),
  detailPlan: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceCalibrationService.detailPlan(Number(req.params.id))
    return success(res, record, '查询成功')
  }),
  createPlan: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceCalibrationService.createPlan(req.body)
    return success(res, record, '创建成功')
  }),
  updatePlan: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceCalibrationService.updatePlan(Number(req.params.id), req.body)
    return success(res, record, '修改成功')
  }),
  deletePlan: asyncHandler(async (req: Request, res: Response) => {
    await DeviceCalibrationService.deletePlan(Number(req.params.id))
    return success(res, null, '删除成功')
  }),
  submitCalibration: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceCalibrationService.submitCalibration(Number(req.params.id), req.body, (req as any).user)
    return success(res, record, '校准结果提交成功')
  }),
  listRecords: asyncHandler(async (req: Request, res: Response) => {
    const records = await DeviceCalibrationService.listRecords(Number(req.params.id))
    return success(res, records)
  }),
  getExpiringSoon: asyncHandler(async (req: Request, res: Response) => {
    const days = Number(req.query.days) || 30
    const plans = await DeviceCalibrationService.getExpiringSoon(days)
    return success(res, plans)
  }),
  getOverdue: asyncHandler(async (_req: Request, res: Response) => {
    const plans = await DeviceCalibrationService.getOverdue()
    return success(res, plans)
  }),

  // ---- fs 边界：uploadCertificate 保留文件操作；DB 全部走 Service ----

  async uploadCertificate(req: any, res: any) {
    const t = await sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}

      // DB 前置校验（事务内）
      await DeviceCalibrationService.assertPlanExists(Number(id), t)

      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length === 0) { await t.rollback(); return fail(res, '请选择要上传的证书文件', ErrorCode.PARAM_INVALID) }

      const record = await DeviceCalibrationService.findLatestRecordByPlan(Number(id), t)
      if (!record) {
        cleanupFiles(files)
        await t.rollback()
        return fail(res, '请先提交校准结果后再上传证书', ErrorCode.BUSINESS_ERROR)
      }

      const recordId = (record as any).getDataValue('record_id')
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'calibration')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const existingCount = await DeviceCalibrationService.countCertImages(recordId, t)
      const created: any[] = []
      const ts = Date.now()
      let primaryPath: string | null = null

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const seqNum = existingCount + i + 1
        const ext = path.extname(file.originalname) || '.jpg'
        const newName = `calibration_${recordId}_${seqNum}_${ts}${ext}`
        fs.renameSync(file.path, path.join(uploadsDir, newName))
        const relPath = `/uploads/device/calibration/${newName}`

        const rel = await DeviceCalibrationService.createCertImage({
          doc_type: 'calibration', doc_id: recordId,
          file_path: relPath, file_name: file.originalname || newName,
          file_size: file.size || null, sort_order: seqNum,
          uploaded_by: userInfo.userId || null, uploaded_by_name: userInfo.username || '',
        }, t)
        created.push(rel)
        if (i === 0) primaryPath = relPath
      }

      // 首张证书路径回填（仅当 record.certificate_path 空时）
      const currentPath = (record as any).getDataValue('certificate_path')
      if (primaryPath && !currentPath) {
        await DeviceCalibrationService.updateCertificatePath(record, primaryPath, t)
      }
      await t.commit()
      return success(res, created, `成功上传${created.length}个证书`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch { /* ignore */ } }
      logger.error('[DeviceCalibration] uploadCertificate error:', err)
      return fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
