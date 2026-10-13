/**
 * 报工图片 Controller — DB 逻辑下沉 ReportImageService
 * 保留 fs + crypto（MD5 去重、rename、unlink）在 Controller 边界
 * 同时提供 named + default 导出兼容 routes/production.ts + default import
 */
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import ReportImageService from '../services/ReportImageService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const UPLOAD_DIR = 'uploads/reports'
const ensureDir = () => {
  const dir = path.resolve(process.cwd(), UPLOAD_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}
const getFileMd5 = (filePath: string) => {
  const fileBuffer = fs.readFileSync(filePath)
  const hashSum = crypto.createHash('md5')
  hashSum.update(fileBuffer)
  return hashSum.digest('hex')
}

/** 上传报工图片 —— fs 逻辑保留 */
export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const stageStart = Date.now()
  const { report_no, category } = req.params as any
  const files = (req as any).files || []

  logger.info('[ReportImage] UPLOAD.ENTRY', { report_no, category, fileCount: files.length,
    fileInfo: files.map((f: any) => ({ name: f.originalname, size: f.size, mimetype: f.mimetype })) })

  if (files.length === 0) {
    logger.warn('[ReportImage] UPLOAD.REJECT — 无文件')
    return fail(res, '请选择要上传的图片')
  }
  if (!report_no) {
    logger.warn('[ReportImage] UPLOAD.REJECT — report_no 为空')
    return fail(res, '报工单号不能为空')
  }
  if (!category) {
    logger.warn('[ReportImage] UPLOAD.REJECT — category 为空')
    return fail(res, '图片分类不能为空')
  }

  const reportOrder = await ReportImageService.ensureReportOrder(report_no)
  logger.info('[ReportImage] UPLOAD.ORDER_FOUND', { reportOrderId: (reportOrder as any)?.report_order_id })

  const dir = ensureDir()
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = report_no + '-' + dateStr + '-'

  const dbRecords = await ReportImageService.listByReportOrder(Number((reportOrder as any).report_order_id))

  const existingMap = new Map<string, string>()
  let maxSeq = 0
  dbRecords.forEach((r: any) => {
    if (r.file_hash) existingMap.set(r.file_hash, path.basename(r.image_url || ''))
    const fname = path.basename(r.image_url || '', path.extname(r.image_url || ''))
    if (fname.startsWith(prefix)) {
      const seqNum = parseInt(fname.slice(prefix.length), 10)
      if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum
    }
  })

  const uploaded: string[] = []
  const skipped: string[] = []
  const newRecords: any[] = []
  let currentSeq = maxSeq

  for (const file of files) {
    try {
      const fileMd5 = getFileMd5(file.path)
      if (existingMap.has(fileMd5)) {
        const existName = existingMap.get(fileMd5)!
        skipped.push(existName)
        uploaded.push(`/${UPLOAD_DIR}/${existName}`)
        fs.unlinkSync(file.path)
        logger.info('[ReportImage] UPLOAD.SKIP_DUP', { md5: fileMd5, reuse: existName })
        continue
      }
      currentSeq += 1
      const newName = `${prefix}${String(currentSeq).padStart(3, '0')}${path.extname(file.originalname) || '.jpg'}`
      const destPath = path.join(dir, newName)
      fs.renameSync(file.path, destPath)
      const newUrl = `/${UPLOAD_DIR}/${newName}`
      uploaded.push(newUrl)
      existingMap.set(fileMd5, newName)
      newRecords.push({
        report_order_id: Number((reportOrder as any).report_order_id),
        category,
        image_url: newUrl,
        file_hash: fileMd5,
      })
      logger.info('[ReportImage] UPLOAD.FILE_OK', { name: newName, url: newUrl, size: file.size, md5: fileMd5 })
    } catch (err: any) {
      logger.error('[ReportImage] UPLOAD.FILE_FAIL', { name: file.originalname, err: err?.message, stack: err?.stack?.slice(0, 300) })
      throw err
    }
  }

  await ReportImageService.bulkCreateRecords(newRecords)
  const ms = Date.now() - stageStart
  const newCount = uploaded.length - skipped.length
  const msg = skipped.length > 0
    ? `成功上传${newCount}张图片，跳过${skipped.length}张重复图片`
    : `成功上传${uploaded.length}张图片`
  logger.info('[ReportImage] UPLOAD.DONE', { report_no, category, total: uploaded.length,
    newCount, skipped: skipped.length, urls: uploaded, costMs: ms })
  return success(res, uploaded, msg)
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const rows = await ReportImageService.list(req.query)
  return success(res, rows, '查询成功')
})

/** 删除图片记录 —— DB 删除交给 Service，fs 清理由 Controller 完成 */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const url = await ReportImageService.remove(Number(req.params.id))
  try {
    const filePath = path.resolve(process.cwd(), String(url).replace(/^\//, ''))
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (err: any) {
    logger.warn('[ReportImage] 物理文件删除失败不影响记录删除:', err?.message)
  }
  return success(res, null, '删除成功')
})

/** 按 url 删除 —— 前端只知道相对路径（如 '/uploads/reports/WOxxx.jpg'），
 *  查不到 image_id 时用这个端点。后端自己找记录 + DB + fs 双删。 */
export const removeByUrl = asyncHandler(async (req: Request, res: Response) => {
  const { url } = req.query as { url?: string }
  if (!url) return fail(res, '缺少 url 参数')

  // 直接 findOne 绕过 Service.list（Service.list 只支持 report_order_id/category 过滤）
  const model = await import('../models/ReportImage.js').then(m => m.default)
  const target: any = await model.findOne({ where: { image_url: url }, raw: true })
  if (!target) return fail(res, '图片记录不存在', undefined, 404)

  // DB destroy + fs 物理删除
  await ReportImageService.remove(Number(target.image_id))
  try {
    const filePath = path.resolve(process.cwd(), String(url).replace(/^\//, ''))
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (err: any) {
    logger.warn('[ReportImage.byUrl] 物理文件删除失败:', err?.message)
  }
  return success(res, null, '删除成功')
})

export default { uploadImages, list, remove, removeByUrl }
