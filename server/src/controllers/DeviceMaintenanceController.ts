/**
 * 设备保养 Controller — 业务逻辑下沉两个 Service；fs + sharp 图片水印保留
 */
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import sharp from 'sharp'
import DeviceMaintenanceStandardService from '../services/DeviceMaintenanceStandardService.js'
import DeviceMaintenanceProfileService from '../services/DeviceMaintenanceProfileService.js'
import { DeviceMaintenanceRecord, DeviceImage } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

function sha256File(p: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(p))
  return hash.digest('hex')
}

/** 渲染时间水印 SVG（白色半透明描边黑色，底部右对齐） */
function buildWatermarkSvg(text: string, width: number, height: number, density: number): string {
  // SVG 是矢量格式，宽高直接用底图像素尺寸，不需要 density 放大
  // density 参数保留（调用处不破坏），但 SVG 尺寸固定为底图尺寸
  const fontSize = Math.max(14, Math.round(width * 0.018))
  const padding = Math.round(width * 0.025)
  const svgW = width
  const svgH = height
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
      <text x="${svgW - padding}" y="${svgH - padding}" font-family="sans-serif"
        font-size="${fontSize}" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.55)"
        stroke-width="2" text-anchor="end" font-weight="500">${escape(text)}</text>
    </svg>`.trim()
}

/** 处理单张图片：压缩 + 水印 + 返回 { buffer, hash, width, height, size } */
async function processImage(srcPath: string, watermarkText: string): Promise<{
  buffer: Buffer; hash: string; width: number; height: number; size: number;
}> {
  const meta = await sharp(srcPath).metadata()
  let w = meta.width || 0
  let h = meta.height || 0
  const orient = meta.orientation || 1

  // EXIF orientation >= 5 时，rotate() 会交换宽高（landscape <-> portrait）
  if (orient >= 5 && orient <= 8) {
    const tmp = w; w = h; h = tmp
  }

  // 手动计算 resize 后的实际尺寸（sharp.pipeline.metadata() 返回原始尺寸，不可靠）
  let rw = w, rh = h
  if (Math.max(w, h) > 2400) {
    const scale = 2400 / Math.max(w, h)
    rw = Math.round(w * scale)
    rh = Math.round(h * scale)
  }

  // 压缩：长边 <= 2400，JPEG 质量优先 85，> 2MB 自动降级到 82
  let out = sharp(srcPath).rotate() // 纠正 EXIF 方向
  if (Math.max(w, h) > 2400) {
    out = out.resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
  }

  const density = 2 // SVG 渲染密度
  const svg = buildWatermarkSvg(watermarkText, rw, rh, density)

  // 先以 quality 85 编码，若 > 2MB 自动降级到 82
  const buffer = await out
    .composite([{ input: Buffer.from(svg), gravity: 'southeast' }])
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()
  const MAX_BYTES = 2 * 1024 * 1024
  const finalBuffer = buffer.length > MAX_BYTES
    ? await out.clone().composite([{ input: Buffer.from(svg), gravity: 'southeast' }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    : buffer

  // 返回处理后元数据
  const finalMeta = await sharp(finalBuffer).metadata()
  const hash = crypto.createHash('sha256').update(finalBuffer).digest('hex')
  return { buffer: finalBuffer, hash, width: finalMeta.width || rw, height: finalMeta.height || rh, size: finalBuffer.length }
}

/** 生成统一文件名：BMIMG_{yyyymmdd}_{recordId}_{seq}_{shortHash}.jpg */
function buildImageName(recordId: number, seq: number, hash: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `BMIMG_${y}${m}${day}_${recordId}_${String(seq).padStart(2, '0')}_${hash.slice(0, 8)}.jpg`
}


export default {
  // ========== 保养标准 CRUD ==========
  listStandards: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await DeviceMaintenanceStandardService.listStandards(req.query)
    return success(res, rows, '查询成功', count)
  }),
  createStandard: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceMaintenanceStandardService.createStandard(req.body, (req as any).user)
    return success(res, record, '创建成功')
  }),
  updateStandard: asyncHandler(async (req: Request, res: Response) => {
    const record = await DeviceMaintenanceStandardService.updateStandard(Number(req.params.id), req.body)
    return success(res, record, '修改成功')
  }),
  deleteStandard: asyncHandler(async (req: Request, res: Response) => {
    await DeviceMaintenanceStandardService.deleteStandard(Number(req.params.id))
    return success(res, null, '删除成功')
  }),

  // ========== 保养档案 ==========
  listProfiles: asyncHandler(async (req: Request, res: Response) => {
    const result = await DeviceMaintenanceProfileService.listProfiles(req.query)
    return success(res, result, '查询成功', result.total)
  }),
  listAvailableDevices: asyncHandler(async (req: Request, res: Response) => {
    const list = await DeviceMaintenanceProfileService.listAvailableDevices(req.query)
    return success(res, list)
  }),
  createProfile: asyncHandler(async (req: Request, res: Response) => {
    const p = await DeviceMaintenanceProfileService.createProfile(req.body, (req as any).user)
    return success(res, p, '创建成功')
  }),
  detailProfile: asyncHandler(async (req: Request, res: Response) => {
    const p = await DeviceMaintenanceProfileService.detailProfile(Number(req.params.deviceId))
    return success(res, p, '查询成功')
  }),
  updateProfileStatus: asyncHandler(async (req: Request, res: Response) => {
    const p = await DeviceMaintenanceProfileService.updateProfileStatus(Number(req.params.deviceId), req.body)
    return success(res, p, '状态更新成功')
  }),
  deleteProfile: asyncHandler(async (req: Request, res: Response) => {
    await DeviceMaintenanceProfileService.deleteProfile(Number(req.params.deviceId))
    return success(res, null, '删除成功')
  }),

  // ========== 生成执行工单 + 保养矩阵 ==========
  generateRecords: asyncHandler(async (req: Request, res: Response) => {
    const result = await DeviceMaintenanceProfileService.generateRecords(req.body)
    return success(res, result, `生成 ${result.created} 条执行工单`)
  }),
  getMatrix: asyncHandler(async (req: Request, res: Response) => {
    const matrix = await DeviceMaintenanceProfileService.getMatrix(req.query)
    return success(res, matrix)
  }),

  // ========== 保养执行记录 CRUD ==========
  listRecords: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await DeviceMaintenanceProfileService.listRecords(req.query)
    return success(res, rows, '查询成功', count)
  }),
  detailRecord: asyncHandler(async (req: Request, res: Response) => {
    const r = await DeviceMaintenanceProfileService.detailRecord(Number(req.params.id))
    return success(res, r, '查询成功')
  }),
  startRecord: asyncHandler(async (req: Request, res: Response) => {
    const r = await DeviceMaintenanceProfileService.startRecord(Number(req.params.id), (req as any).user)
    return success(res, r, '开始执行')
  }),
  submitRecord: asyncHandler(async (req: Request, res: Response) => {
    const r = await DeviceMaintenanceProfileService.submitRecord(Number(req.params.id), req.body, (req as any).user)
    return success(res, r, '提交成功')
  }),
  batchSubmit: asyncHandler(async (req: Request, res: Response) => {
    const r = await DeviceMaintenanceProfileService.batchSubmit(req.body, (req as any).user)
    return success(res, r, '批量提交成功')
  }),
  skipRecord: asyncHandler(async (req: Request, res: Response) => {
    const r = await DeviceMaintenanceProfileService.skipRecord(Number(req.params.id), req.body, (req as any).user)
    return success(res, r, '已跳过')
  }),
  deleteRecord: asyncHandler(async (req: Request, res: Response) => {
    await DeviceMaintenanceProfileService.deleteRecord(Number(req.params.id))
    return success(res, null, '删除成功')
  }),
  async getImages(req: any, res: any) {
    try {
      const { id } = req.params
      const exists = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, attributes: ['record_id'] })
      if (!exists) return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      const images = await DeviceImage.findAll({
        where: { doc_type: 'maintenance', doc_id: id },
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      })
      success(res, images, '查询成功')
    } catch (err: any) {
      logger.error('[DeviceMaintenance] getImages error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async uploadImage(req: any, res: any) {
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
      logger.info('[DeviceMaintenance] uploadImage debug', {
        ct: req.headers['content-type'],
        cl: req.headers['content-length'],
        files_len: files.length,
        multer_req_files_keys: (req as any).files ? Object.keys((req as any).files).slice(0, 3) : null,
        multer_file: !!(req as any).file,
      })
      if (files.length === 0) return fail(res, '请选择要上传的图片', ErrorCode.PARAM_INVALID)

      // 专用目录：uploads/device/maintenance/YYYY-MM/
      const d = new Date()
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'maintenance', ym)
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const recordId = Number(id)
      const existingCount = await DeviceImage.count({
        where: { doc_type: 'maintenance', doc_id: recordId },
        transaction: t,
      })

      // 收集本次待处理图片的已存在 hash（用于跨本次上传去重）
      const existingHashSet = new Set<string>()
      const existedImages = await DeviceImage.findAll({
        where: { doc_type: 'maintenance', doc_id: recordId },
        attributes: ['file_path'],
        transaction: t,
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
      const skipped: string[] = [] // 被去重跳过的文件名

      for (const file of files) {
        try {
          // 处理：压缩 + 水印（水印包含当前时间、设备编号，便于追溯）
          const watermarkText = `${nowStr}  ${record.device_code || ''}  ${record.getDataValue('trigger_mode') || ''}`.trim()
          const processed = await processImage(file.path, watermarkText)

          // 同记录内去重（与已存在图片比对）
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
            doc_type: 'maintenance',
            doc_id: recordId,
            file_path: `/uploads/device/maintenance/${ym}/${newName}`,
            file_name: file.originalname || newName,
            file_size: processed.size,
            sort_order: seqNum,
            uploaded_by: userInfo.userId || null,
            uploaded_by_name: userInfo.username || '',
          }, { transaction: t })
          saved.push(img)
        } catch (procErr: any) {
          logger.warn('[DeviceMaintenance] uploadImage skip one:', procErr?.message || procErr)
        } finally {
          // 删除 multer 临时文件
          try { fs.unlinkSync(file.path) } catch { /* ignore */ }
        }
      }

      await t.commit()
      const msgParts = [`成功上传 ${saved.length} 张`]
      if (skipped.length > 0) msgParts.push(`${skipped.length} 张重复图片已跳过`)
      success(res, saved, msgParts.join('，'))
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] uploadImage error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /** 录入设备运行时长（runtime 触发）—— passthrough 到 ProfileService */
  logRuntime: asyncHandler(async (req: Request, res: Response) => {
    const r = await DeviceMaintenanceProfileService.logRuntime(req.body, (req as any).user)
    return success(res, r, '录入成功')
  }),

  /** 查询设备运行时长日志 —— passthrough 到 ProfileService */
  getRuntimeLog: asyncHandler(async (req: Request, res: Response) => {
    const list = await DeviceMaintenanceProfileService.getRuntimeLog(Number((req.query as any).device_id))
    return success(res, list, '查询成功')
  }),

  // ============================================================
}

// ============ 命名导出（app.ts / maintenanceMatrix.ts 用） ============

/** 定时任务：从保养标准 backfill 保养档案（app.ts 定时调用） */
export async function initProfiles() {
  await DeviceMaintenanceProfileService.initProfiles()
}

/** period_key 生成（maintenanceMatrix.ts re-export） */
export { buildPeriodKey } from '../utils/maintenanceMatrix.js'
