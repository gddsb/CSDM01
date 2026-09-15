/**
 * 设备文档 Controller — CRUD 走 Service，fs 操作保留原始实现
 */
import path from 'path'
import fs from 'fs'
import DeviceDocumentService from '../services/DeviceDocumentService.js'
import { DeviceDocument } from '../models/index.js'
import { DOC_TYPE_MAP } from '../models/DeviceDocument.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const ALLOWED_DOC_TYPES = new Set(Object.keys(DOC_TYPE_MAP))
const DOC_TYPE_DIR_MAP: Record<string, string> = {
  factory: 'factory', acceptance: 'acceptance',
  external_repair: 'external_repair', internal_repair: 'internal_repair', modification: 'modification',
}
const ALLOWED_EXTS = new Set(['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.gif','.bmp','.txt','.zip','.rar'])
const MAX_FILE_SIZE = 50 * 1024 * 1024

function cleanupFiles(files: any[]) {
  if (!files || files.length === 0) return
  for (const f of files) {
    try { if (f && f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path) } catch { /* ignore */ }
  }
}

export default {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await DeviceDocumentService.list(req.query)
    return success(res, rows, '查询成功', count)
  }),
  detail: asyncHandler(async (req: Request, res: Response) => {
    const doc = await DeviceDocumentService.detail(Number(req.params.id))
    return success(res, doc, '查询成功')
  }),
  listByDevice: asyncHandler(async (req: Request, res: Response) => {
    const docs = await DeviceDocumentService.listByDevice(Number((req.params as any).deviceId))
    return success(res, docs)
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const doc = await DeviceDocumentService.updateMeta(Number(req.params.id), req.body)
    return success(res, doc, '修改成功')
  }),

  // ---- fs 操作保留原始实现 ----

  async upload(req: any, res: any) {
    const t = await DeviceDocument.sequelize.transaction()
    try {
      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length === 0) { cleanupFiles(files); return fail(res, '请选择文件', ErrorCode.PARAM_INVALID) }
      const deviceId = Number((req as any).body?.device_id || (req as any).body?.asset_id)
      if (!deviceId) { cleanupFiles(files); return fail(res, '请选择关联设备', ErrorCode.PARAM_INVALID) }
      const docType = (req as any).body?.doc_type || 'factory'
      if (!ALLOWED_DOC_TYPES.has(docType)) { cleanupFiles(files); return fail(res, '文档类型不合法', ErrorCode.PARAM_INVALID) }
      const subDir = DOC_TYPE_DIR_MAP[docType] || 'other'
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device-documents', subDir)
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
      const existingCount = await DeviceDocument.count({ where: { device_id: deviceId, doc_type: docType }, transaction: t })
      const created: any[] = []
      const device = await DeviceDocument.sequelize.model('Device').findOne({ where: { device_id: deviceId }, transaction: t })
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.size > MAX_FILE_SIZE) { cleanupFiles([file]); await t.rollback(); return fail(res, `文件 ${file.originalname} 超过 50MB`, ErrorCode.PARAM_INVALID) }
        const ext = path.extname(file.originalname).toLowerCase()
        if (ext && !ALLOWED_EXTS.has(ext)) { cleanupFiles([file]); await t.rollback(); return fail(res, `文件格式不支持: ${ext}`, ErrorCode.PARAM_INVALID) }
        const seqNum = existingCount + i + 1
        const timestamp = Date.now()
        const baseName = (req as any).body?.doc_name?.trim()?.replace(/[\\/:*?"<>|]/g, '_') || 'doc'
        const safeName = baseName.length > 30 ? baseName.slice(0, 30) : baseName
        const newName = `${deviceId}_${docType}_${timestamp}_${safeName}_${seqNum}${ext || ''}`
        fs.renameSync(file.path, path.join(uploadsDir, newName))
        const doc = await DeviceDocument.create({
          device_id: deviceId,
          device_code: device?.getDataValue('device_code') || '',
          device_name: device?.getDataValue('device_name') || '',
          doc_type: docType, doc_name: (req as any).body?.doc_name || file.originalname,
          file_name: file.originalname, file_path: `/uploads/device-documents/${subDir}/${newName}`,
          file_size: file.size || null, file_format: ext.replace(/^\./, ''),
          description: (req as any).body?.description || '',
          uploaded_by: (req as any).user?.userId || null, uploaded_by_name: (req as any).user?.username || '',
        }, { transaction: t })
        created.push(doc)
      }
      await t.commit()
      success(res, created, `成功上传 ${created.length} 个文档`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      cleanupFiles((req as any).files || [(req as any).file])
      logger.error('[DeviceDocument] upload error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async delete(req: any, res: any) {
    const t = await DeviceDocument.sequelize.transaction()
    try {
      const id = Number(req.params.id)
      const record = await DeviceDocument.findOne({ where: { doc_id: id }, transaction: t })
      if (!record) {
        await t.rollback()
        return fail(res, '文档不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const relPath = record.getDataValue('file_path')
      await record.destroy({ transaction: t })
      await t.commit()
      if (relPath) {
        try {
          const absPath = path.resolve(process.cwd(), relPath.replace(/^\//, ''))
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath)
        } catch { /* ignore */ }
      }
      success(res, null, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceDocument] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async download(req: any, res: any) {
    try {
      const id = Number(req.params.id)
      const record = await DeviceDocument.findOne({ where: { doc_id: id } })
      if (!record) return fail(res, '文档不存在', ErrorCode.RECORD_NOT_FOUND)
      const filePath = path.resolve(process.cwd(), (record as any).file_path.replace(/^\//, ''))
      if (!fs.existsSync(filePath)) return fail(res, '文件不存在或已丢失', ErrorCode.RECORD_NOT_FOUND)
      const downloadName = (record as any).file_name || `doc_${id}`
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`)
      res.setHeader('Content-Type', 'application/octet-stream')
      const stream = fs.createReadStream(filePath)
      stream.on('error', (err) => {
        logger.error('[DeviceDocument] download stream error:', err)
        if (!res.headersSent) return fail(res, '文件读取失败', ErrorCode.SYSTEM_ERROR)
        res.end()
      })
      stream.pipe(res)
    } catch (err: any) {
      logger.error('[DeviceDocument] download error:', err)
      if (!res.headersSent) fail(res, err.message || '下载失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
