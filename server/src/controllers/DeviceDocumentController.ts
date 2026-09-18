/**
 * 设备文档 Controller — DB CRUD 全部走 Service；fs 边界（upload/delete/download）保留 Controller
 */
import path from 'path'
import fs from 'fs'
import sequelize from '../config/database.js'
import DeviceDocumentService, { ALLOWED_DOC_TYPES } from '../services/DeviceDocumentService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

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

  // ---- fs 边界：upload 保留文件操作，DB 事务委托 Service ----

  async upload(req: any, res: any) {
    const t = await sequelize.transaction()
    try {
      const files: any[] = req.files || (req.file ? [req.file] : [])
      if (files.length === 0) { cleanupFiles(files); return fail(res, '请选择文件', ErrorCode.PARAM_INVALID) }

      const body = req.body || {}
      const deviceId = Number(body.device_id || body.asset_id)
      if (!deviceId) { cleanupFiles(files); return fail(res, '请选择关联设备', ErrorCode.PARAM_INVALID) }
      const docType = body.doc_type || 'factory'
      if (!ALLOWED_DOC_TYPES.has(docType)) { cleanupFiles(files); return fail(res, '文档类型不合法', ErrorCode.PARAM_INVALID) }

      const subDir = DOC_TYPE_DIR_MAP[docType] || 'other'
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device-documents', subDir)
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      // DB 前置校验 + 查询
      const { device, existingCount } = await DeviceDocumentService.prepareUploadContext(deviceId, docType, t)

      // 构建 DB 记录（先拼好，fs rename 成功后批量写入）
      const docsData: any[] = []
      const actor = req.user || {}
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.size > MAX_FILE_SIZE) { cleanupFiles([file]); await t.rollback(); return fail(res, `文件 ${file.originalname} 超过 50MB`, ErrorCode.PARAM_INVALID) }
        const ext = path.extname(file.originalname).toLowerCase()
        if (ext && !ALLOWED_EXTS.has(ext)) { cleanupFiles([file]); await t.rollback(); return fail(res, `文件格式不支持: ${ext}`, ErrorCode.PARAM_INVALID) }

        const seqNum = existingCount + i + 1
        const baseName = (body.doc_name?.trim()?.replace(/[\\/:*?"<>|]/g, '_')) || 'doc'
        const safeName = baseName.length > 30 ? baseName.slice(0, 30) : baseName
        const newName = `${deviceId}_${docType}_${Date.now()}_${safeName}_${seqNum}${ext || ''}`

        fs.renameSync(file.path, path.join(uploadsDir, newName))

        docsData.push({
          device_id: deviceId,
          device_code: (device as any).device_code || '',
          device_name: (device as any).device_name || '',
          doc_type: docType,
          doc_name: body.doc_name || file.originalname,
          file_name: file.originalname,
          file_path: `/uploads/device-documents/${subDir}/${newName}`,
          file_size: file.size || null,
          file_format: ext.replace(/^\./, ''),
          description: body.description || '',
          uploaded_by: actor.userId || null,
          uploaded_by_name: actor.username || '',
        })
      }

      const created = await DeviceDocumentService.bulkCreate(docsData, t)
      await t.commit()
      return success(res, created, `成功上传 ${created.length} 个文档`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      cleanupFiles(req.files || [req.file])
      logger.error('[DeviceDocument] upload error:', err)
      return fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ---- fs 边界：delete 先删 DB 再删文件 ----

  async delete(req: any, res: any) {
    const t = await sequelize.transaction()
    try {
      const id = Number(req.params.id)
      const doc = await DeviceDocumentService.findForDelete(id, t)
      const relPath = (doc as any).file_path
      await DeviceDocumentService.destroy(doc, t)
      await t.commit()

      // 删物理文件（在事务 commit 后执行，避免 DB 回滚了但文件没恢复）
      if (relPath) {
        try {
          const absPath = path.resolve(process.cwd(), relPath.replace(/^\//, ''))
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath)
        } catch { /* ignore */ }
      }
      return success(res, null, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceDocument] delete error:', err)
      return fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ---- fs 边界：download 查 DB + stream 文件 ----

  async download(req: any, res: any) {
    try {
      const id = Number(req.params.id)
      const doc = await DeviceDocumentService.findForDownload(id)
      const relPath = (doc as any).file_path
      if (!relPath) return fail(res, '文件路径无效', ErrorCode.RECORD_NOT_FOUND)

      const filePath = path.resolve(process.cwd(), relPath.replace(/^\//, ''))
      if (!fs.existsSync(filePath)) return fail(res, '文件不存在或已丢失', ErrorCode.RECORD_NOT_FOUND)

      const downloadName = (doc as any).file_name || `doc_${id}`
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
