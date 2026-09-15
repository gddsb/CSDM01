/**
 * 设备保养 Controller
 * 业务逻辑（Sequelize CRUD）已下沉 DeviceMaintenanceStandardService / DeviceMaintenanceProfileService
 * 以下 sharp/fs 边界函数保留在 Controller：
 *   - sha256File / buildWatermarkSvg / processImage / buildImageName
 *   - uploadImage（multer 文件 → sharp 压缩+水印 → fs 落盘 → DB 持久化）
 */
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import sharp from 'sharp'
import DeviceMaintenanceStandardService from '../services/DeviceMaintenanceStandardService.js'
import DeviceMaintenanceProfileService from '../services/DeviceMaintenanceProfileService.js'
import { DeviceImage, DeviceMaintenanceRecord } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

// ============ sharp/fs 边界 ============

function sha256File(p: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(p))
  return hash.digest('hex')
}

function buildWatermarkSvg(text: string, width: number, height: number, density: number): string {
  const fontSize = Math.max(14, Math.round(width * 0.018))
  const padding = Math.round(width * 0.025)
  const svgW = width
  const svgH = height
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
      <text x="${svgW - padding}" y="${svgH - padding}" font-family="sans-serif"
        font-size="${fontSize}" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.55)"
        stroke-width="2" text-anchor="end" font-weight="500">${escape(text)}</text>
    </svg>`.trim()
}

async function processImage(srcPath: string, watermarkText: string): Promise<{
  buffer: Buffer; hash: string; width: number; height: number; size: number;
}> {
  const meta = await sharp(srcPath).metadata()
  let w = meta.width || 0
  let h = meta.height || 0
  const orient = meta.orientation || 1
  if (orient >= 5 && orient <= 8) {
    const tmp = w; w = h; h = tmp
  }
  let rw = w, rh = h
  if (Math.max(w, h) > 2400) {
    const scale = 2400 / Math.max(w, h)
    rw = Math.round(w * scale)
    rh = Math.round(h * scale)
  }
  let out = sharp(srcPath).rotate()
  if (Math.max(w, h) > 2400) {
    out = out.resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
  }
  const density = 2
  const svg = buildWatermarkSvg(watermarkText, rw, rh, density)
  const buffer = await out
    .composite([{ input: Buffer.from(svg), gravity: 'southeast' }])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()
  const MAX_BYTES = 2 * 1024 * 1024
  const finalBuffer = buffer.length > MAX_BYTES
    ? await out.clone().composite([{ input: Buffer.from(svg), gravity: 'southeast' }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    : buffer
  const finalMeta = await sharp(finalBuffer).metadata()
  const hash = crypto.createHash('sha256').update(finalBuffer).digest('hex')
  return { buffer: finalBuffer, hash, width: finalMeta.width || rw, height: finalMeta.height || rh, size: finalBuffer.length }
}

function buildImageName(recordId: number, seq: number, hash: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `BMIMG_${y}${m}${day}_${recordId}_${String(seq).padStart(2, '0')}_${hash.slice(0, 8)}.jpg`
}

// ============ 保养标准 CRUD ============

export const listStandards = asyncHandler(async (req: Request, res: Response) => {
  const result = await DeviceMaintenanceStandardService.listStandards(req.query)
  return success(res, result, '查询成功')
})

export const createStandard = asyncHandler(async (req: Request, res: Response) => {
  const record = await DeviceMaintenanceStandardService.createStandard(req.body, (req as any).user)
  return success(res, record, '创建成功')
})

export const updateStandard = asyncHandler(async (req: Request, res: Response) => {
  const record = await DeviceMaintenanceStandardService.updateStandard(Number(req.params.id), req.body)
  return success(res, record, '修改成功')
})

export const deleteStandard = asyncHandler(async (req: Request, res: Response) => {
  await DeviceMaintenanceStandardService.deleteStandard(Number(req.params.id))
  return success(res, null, '删除成功')
})

// ============ 保养档案 ============

export const listProfiles = asyncHandler(async (req: Request, res: Response) => {
  const result = await DeviceMaintenanceProfileService.listProfiles(req.query)
  return success(res, result, '查询成功', result.total)
})

export const listAvailableDevices = asyncHandler(async (req: Request, res: Response) => {
  const list = await DeviceMaintenanceProfileService.listAvailableDevices(req.query)
  return success(res, list)
})

export const createProfile = asyncHandler(async (req: Request, res: Response) => {
  const p = await DeviceMaintenanceProfileService.createProfile(req.body, (req as any).user)
  return success(res, p, '创建成功')
})

export const detailProfile = asyncHandler(async (req: Request, res: Response) => {
  const p = await DeviceMaintenanceProfileService.detailProfile(Number(req.params.deviceId))
  return success(res, p, '查询成功')
})

export const updateProfileStatus = asyncHandler(async (req: Request, res: Response) => {
  const p = await DeviceMaintenanceProfileService.updateProfileStatus(Number(req.params.deviceId), req.body)
  return success(res, p, '状态更新成功')
})

export const deleteProfile = asyncHandler(async (req: Request, res: Response) => {
  await DeviceMaintenanceProfileService.deleteProfile(Number(req.params.deviceId))
  return success(res, null, '删除成功')
})

// ============ 生成执行工单 + 保养矩阵 ============

export const generateRecords = asyncHandler(async (req: Request, res: Response) => {
  const result = await DeviceMaintenanceProfileService.generateRecords(req.body)
  return success(res, result, `生成 ${result.created} 条执行记录`)
})

export const getMatrix = asyncHandler(async (req: Request, res: Response) => {
  const matrix = await DeviceMaintenanceProfileService.getMatrix(req.query)
  return success(res, matrix)
})

// ============ 保养执行记录 CRUD ============

export const listRecords = asyncHandler(async (req: Request, res: Response) => {
  const result = await DeviceMaintenanceProfileService.listRecords(req.query)
  return success(res, result.list, '查询成功', result.total)
})

export const detailRecord = asyncHandler(async (req: Request, res: Response) => {
  const r = await DeviceMaintenanceProfileService.detailRecord(Number(req.params.id))
  return success(res, r, '查询成功')
})

export const startRecord = asyncHandler(async (req: Request, res: Response) => {
  const r = await DeviceMaintenanceProfileService.startRecord(Number(req.params.id), req.body, (req as any).user)
  return success(res, r, '开始执行')
})

export const submitRecord = asyncHandler(async (req: Request, res: Response) => {
  const r = await DeviceMaintenanceProfileService.submitRecord(Number(req.params.id), req.body, (req as any).user)
  return success(res, r, '提交成功')
})

export const batchSubmit = asyncHandler(async (req: Request, res: Response) => {
  const r = await DeviceMaintenanceProfileService.batchSubmit(req.body, (req as any).user)
  return success(res, r, '批量提交成功')
})

export const skipRecord = asyncHandler(async (req: Request, res: Response) => {
  const r = await DeviceMaintenanceProfileService.skipRecord(Number(req.params.id), req.body, (req as any).user)
  return success(res, r, '已跳过')
})

export const deleteRecord = asyncHandler(async (req: Request, res: Response) => {
  await DeviceMaintenanceProfileService.deleteRecord(Number(req.params.id))
  return success(res, null, '删除成功')
})

// ============ 图片上传（sharp/fs 边界） ============

export const getImages = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const exists = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, attributes: ['record_id'] })
  if (!exists) return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
  const images = await DeviceImage.findAll({
    where: { doc_type: 'maintenance', doc_id: id },
    order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
  })
  return success(res, images, '查询成功')
})

export const uploadImage = async (req: Request, res: Response) => {
  const t = await DeviceImage.sequelize.transaction()
  try {
    const { id } = req.params
    const userInfo: any = (req as any).user || {}
    const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
    if (!record) {
      const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
      return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
    }

    const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
    if (files.length === 0) return fail(res, '请选择要上传的图片', ErrorCode.PARAM_INVALID)

    const d = new Date()
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'maintenance', ym)
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const recordId = Number(id)
    const existingCount = await DeviceImage.count({
      where: { doc_type: 'maintenance', doc_id: recordId }, transaction: t,
    })

    const existingHashSet = new Set<string>()
    const existedImages = await DeviceImage.findAll({
      where: { doc_type: 'maintenance', doc_id: recordId }, attributes: ['file_path'], transaction: t,
    })
    for (const img of existedImages) {
      const p = path.resolve(process.cwd(), img.getDataValue('file_path').replace(/^\//, ''))
      if (fs.existsSync(p)) {
        try { existingHashSet.add(sha256File(p)) } catch { /* ignore */ }
      }
    }

    const nowStr = d.toLocaleString('zh-CN', { hour12: false })
    let seqNum = existingCount
    const saved: any[] = []
    const skipped: string[] = []

    for (const file of files) {
      try {
        const watermarkText = `${nowStr}  ${record.device_code || ''}  ${record.getDataValue('trigger_mode') || ''}`.trim()
        const processed = await processImage(file.path, watermarkText)

        if (existingHashSet.has(processed.hash)) {
          skipped.push(file.originalname || file.filename || '(未命名)')
          continue
        }
        existingHashSet.add(processed.hash)

        seqNum += 1
        const newName = buildImageName(recordId, seqNum, processed.hash)
        const destPath = path.join(uploadsDir, newName)
        fs.writeFileSync(destPath, processed.buffer)

        const img = await DeviceImage.create({
          doc_type: 'maintenance', doc_id: recordId,
          file_path: `/uploads/device/maintenance/${ym}/${newName}`,
          file_name: file.originalname || newName,
          file_size: processed.size, sort_order: seqNum,
          uploaded_by: userInfo.userId || null,
          uploaded_by_name: userInfo.username || '',
        }, { transaction: t })
        saved.push(img)
      } catch (procErr: any) {
        logger.warn('[DeviceMaintenance] uploadImage skip one:', procErr?.message || procErr)
      } finally {
        try { fs.unlinkSync(file.path) } catch { /* ignore */ }
      }
    }

    await t.commit()
    const msgParts = [`成功上传 ${saved.length} 张`]
    if (skipped.length > 0) msgParts.push(`${skipped.length} 张重复图片已跳过`)
    return success(res, saved, msgParts.join('，'))
  } catch (err: any) {
    if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
    logger.error('[DeviceMaintenance] uploadImage error:', err)
    return fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 运行时长 ============

export const logRuntime = asyncHandler(async (req: Request, res: Response) => {
  const r = await DeviceMaintenanceProfileService.logRuntime(req.body, (req as any).user)
  return success(res, r, '记录成功')
})

export const getRuntimeLog = asyncHandler(async (req: Request, res: Response) => {
  const list = await DeviceMaintenanceProfileService.getRuntimeLog(Number((req.query as any).device_id))
  return success(res, list)
})

// ============ initProfiles re-export ============

export const initProfiles = async () => {
  return DeviceMaintenanceProfileService.initProfiles()
}

export default {
  listStandards, createStandard, updateStandard, deleteStandard,
  listProfiles, listAvailableDevices, createProfile, detailProfile, updateProfileStatus, deleteProfile,
  generateRecords, getMatrix,
  listRecords, detailRecord, startRecord, submitRecord, batchSubmit, skipRecord, deleteRecord,
  getImages, uploadImage,
  logRuntime, getRuntimeLog,
  initProfiles,
}
