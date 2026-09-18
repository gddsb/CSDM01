/**
 * 客诉管理 Controller — CRUD + addRecord + close 走 Service；uploadAttachment 保留 fs
 */
import path from 'path'
import fs from 'fs'
import ComplaintService from '../services/ComplaintService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

function cleanupFiles(files: any[]) {
  if (!files || files.length === 0) return
  for (const f of files) { try { if (f?.path && fs.existsSync(f.path)) fs.unlinkSync(f.path) } catch { /* ignore */ } }
}
function ensureDir(dir: string) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }
function dateStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export default {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await ComplaintService.list(req.query)
    return success(res, rows, '查询成功', count)
  }),
  detail: asyncHandler(async (req: Request, res: Response) => {
    const record = await ComplaintService.detail(Number(req.params.id))
    return success(res, record, '查询成功')
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const record = await ComplaintService.create(req.body, (req as any).user)
    return success(res, record, '创建成功')
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const record = await ComplaintService.update(Number(req.params.id), req.body)
    return success(res, record, '修改成功')
  }),
  addRecord: asyncHandler(async (req: Request, res: Response) => {
    const rec = await ComplaintService.addRecord(Number(req.params.id), req.body, (req as any).user)
    return success(res, rec, '跟进成功')
  }),
  close: asyncHandler(async (req: Request, res: Response) => {
    await ComplaintService.close(Number(req.params.id), req.body, (req as any).user)
    return success(res, null, '关闭成功')
  }),
  delete: asyncHandler(async (req: Request, res: Response) => {
    await ComplaintService.delete(Number(req.params.id))
    return success(res, null, '删除成功')
  }),

  // ---- fs 边界：uploadAttachment 保留文件操作；DB 查记录走 Service ----

  async uploadAttachment(req: any, res: any) {
    const COMPLAINT_MAX_TOTAL_SIZE = 200 * 1024 * 1024
    try {
      const { id } = req.params
      // DB 查记录（用于文件命名 + 年月目录）
      const record: any = await ComplaintService.findForUpload(Number(id))

      const files: any[] = req.files || (req.file ? [req.file] : [])
      if (!files.length) return fail(res, '请选择要上传的文件', ErrorCode.PARAM_INVALID)

      // 总大小校验
      const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0)
      if (totalSize > COMPLAINT_MAX_TOTAL_SIZE) {
        cleanupFiles(files)
        return fail(res, `单次上传总大小不能超过 200MB（当前 ${(totalSize / 1024 / 1024).toFixed(1)}MB）`, ErrorCode.PARAM_INVALID)
      }

      // 年月目录：用客诉单的 complaint_time 或者 complaint_date 的 YYYYMM
      const baseDate = record.complaint_time || record.complaint_date || new Date()
      const ym = new Date(baseDate).toISOString().slice(0, 7).replace('-', '')
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'complaints', ym)
      ensureDir(uploadsDir)

      const complaintNoPrefix = record.complaint_no || `TS${String(record.complaint_id).padStart(6, '0')}`
      const datePart = dateStamp().slice(0, 8)
      const created: any[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = path.extname(file.originalname || '').toLowerCase()
        const ts = dateStamp().slice(9)
        const finalName = `${complaintNoPrefix}_${datePart}_${ts}_${i + 1}${ext}`
        const destPath = path.join(uploadsDir, finalName)
        fs.renameSync(file.path, destPath)
        const url = `/uploads/complaints/${ym}/${finalName}`
        created.push({
          name: finalName,
          original_name: file.originalname,
          url,
          size: file.size,
        })
      }

      return success(res, { files: created }, `上传成功 ${created.length} 个文件`)
    } catch (err: any) {
      cleanupFiles(req.files || [])
      logger.error('[QualityComplaint] uploadAttachment error:', err)
      return fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
