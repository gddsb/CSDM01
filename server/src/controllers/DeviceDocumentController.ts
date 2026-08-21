import path from 'path'
import fs from 'fs'
import { Op } from 'sequelize'
import { DeviceDocument, Device } from '../models/index.js'
import { DOC_TYPE_MAP } from '../models/DeviceDocument.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

// 允许的文档类型集合
const ALLOWED_DOC_TYPES = new Set(Object.keys(DOC_TYPE_MAP))

// 各文档类型对应的子目录
const DOC_TYPE_DIR_MAP: Record<string, string> = {
  'factory': 'factory',
  'acceptance': 'acceptance',
  'external_repair': 'external_repair',
  'internal_repair': 'internal_repair',
  'modification': 'modification',
}

// 允许的文件扩展名（含点号）
const ALLOWED_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.txt', '.zip', '.rar',
])

// 文件大小上限：50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

// 从文件名获取格式后缀（小写，不含点号）
function getFormat(filename: string | undefined): string {
  if (!filename) return ''
  const ext = path.extname(filename).toLowerCase().replace(/^\./, '')
  return ext
}

// 当前日期字符串 YYYYMMDD
function dateStamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

// 安全化文件名中的非法字符（用于命名规范）
function safeNameSegment(input: string | undefined): string {
  if (!input) return ''
  return String(input).replace(/[\\/:*?"<>|\s]+/g, '_')
}

// 确保目标目录存在
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// 计算文件大小描述
function formatSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

export default {
  /**
   * 分页查询文档列表（按设备、文档类型、关键词筛选）
   */
  async list(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        device_id,
        device_name,
        device_code,
        doc_type,
        keyword,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (device_id) where.device_id = Number(device_id)
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
      if (doc_type) {
        const types = String(doc_type).split(',').filter(Boolean)
        if (types.length === 1) where.doc_type = types[0]
        else if (types.length > 1) where.doc_type = { [Op.in]: types }
      }
      if (keyword) {
        where[Op.or] = [
          { doc_name: { [Op.like]: `%${keyword}%` } },
          { device_name: { [Op.like]: `%${keyword}%` } },
          { device_code: { [Op.like]: `%${keyword}%` } },
          { related_order: { [Op.like]: `%${keyword}%` } },
        ]
      }
      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
        if (end_date) where.created_at[Op.lte] = new Date(String(end_date) + ' 23:59:59')
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))
      const { count, rows } = await DeviceDocument.findAndCountAll({
        where,
        order: [['doc_type', 'ASC'], ['created_at', 'DESC'], ['doc_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      const list = (rows || []).map((r: any) => {
        const d = r.toJSON ? r.toJSON() : r
        return { ...d, file_size_text: formatSize(d.file_size), doc_type_name: DOC_TYPE_MAP[d.doc_type as string] || d.doc_type }
      })

      success(res, { list, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[DeviceDocument] list error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取文档详情
   */
  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceDocument.findOne({ where: { doc_id: id } })
      if (!record) {
        return fail(res, '文档不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const d: any = record.toJSON ? record.toJSON() : record
      d.file_size_text = formatSize(d.file_size)
      d.doc_type_name = DOC_TYPE_MAP[d.doc_type] || d.doc_type
      success(res, d)
    } catch (err: any) {
      logger.error('[DeviceDocument] detail error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 上传文档（支持多文件）
   * - 表单字段：device_id, doc_type, doc_name, version, valid_until, related_order, remarks
   * - 文件字段：files（多文件）
   * - 命名规范：{doc_type}_{设备编号}_{文档名称}_{版本}_{日期}.ext
   * - 按文档类型分目录：uploads/device/documents/{factory|acceptance|external_repair|internal_repair|modification}/
   */
  async upload(req: any, res: any) {
    try {
      const userInfo: any = (req as any).user || {}
      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])

      // 接收 multipart 表单字段
      const device_id = req.body?.device_id
      const doc_type = req.body?.doc_type
      const doc_name = req.body?.doc_name
      const version = req.body?.version || 'v1'
      const valid_until = req.body?.valid_until || null
      const related_order = req.body?.related_order || null
      const remarks = req.body?.remarks || null

      if (!device_id) {
        cleanupFiles(files)
        return fail(res, '请选择设备', ErrorCode.PARAM_INVALID)
      }
      if (!doc_type || !ALLOWED_DOC_TYPES.has(doc_type)) {
        cleanupFiles(files)
        return fail(res, `文档类型不合法，可选值：${[...ALLOWED_DOC_TYPES].join('、')}`, ErrorCode.PARAM_INVALID)
      }
      if (!doc_name) {
        cleanupFiles(files)
        return fail(res, '请填写文档名称', ErrorCode.PARAM_INVALID)
      }
      if (files.length === 0) {
        return fail(res, '请选择要上传的文件', ErrorCode.PARAM_INVALID)
      }

      // 加载设备（用于补全冗余字段）
      const device = await Device.findOne({ where: { device_id } })
      if (!device) {
        cleanupFiles(files)
        return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const deviceCode = (device as any).device_code || ''
      const deviceName = (device as any).device_name || ''

      // 创建目标目录
      const subDir = DOC_TYPE_DIR_MAP[doc_type] || doc_type
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'documents', subDir)
      ensureDir(uploadsDir)

      const created: any[] = []
      const ts = Date.now()
      const ds = dateStamp()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // 校验文件大小
        if (file.size && file.size > MAX_FILE_SIZE) {
          cleanupFiles(files)
          return fail(res, `文件「${file.originalname}」超过50MB大小限制`, ErrorCode.PARAM_INVALID)
        }
        const ext = path.extname(file.originalname || '').toLowerCase()
        if (!ext || !ALLOWED_EXTS.has(ext)) {
          cleanupFiles(files)
          return fail(res, `文件「${file.originalname}」格式不支持，允许：${[...ALLOWED_EXTS].join('、')}`, ErrorCode.PARAM_INVALID)
        }

        // 命名规范：{doc_type}_{设备编号}_{文档名称}_{版本}_{日期}_{序号}.ext
        const safeDocName = safeNameSegment(doc_name)
        const safeDeviceCode = safeNameSegment(deviceCode) || String(device_id)
        const seq = String(i + 1).padStart(2, '0')
        const newName = `${doc_type}_${safeDeviceCode}_${safeDocName}_${version}_${ds}_${seq}${ext}`
        const destPath = path.join(uploadsDir, newName)
        try {
          fs.renameSync(file.path, destPath)
        } catch (e) {
          // 兜底：rename 失败时回退为 copy + unlink
          fs.copyFileSync(file.path, destPath)
          try { fs.unlinkSync(file.path) } catch { /* ignore */ }
        }
        const relPath = `/uploads/device/documents/${subDir}/${newName}`

        const record = await DeviceDocument.create({
          device_id: Number(device_id),
          device_code: deviceCode,
          device_name: deviceName,
          doc_type,
          doc_name,
          file_path: relPath,
          file_format: ext.replace(/^\./, ''),
          file_size: file.size || null,
          version,
          related_order,
          valid_until: valid_until ? String(valid_until).slice(0, 10) : null,
          uploaded_by: userInfo.userId || null,
          uploaded_by_name: userInfo.username || '',
          remarks,
        })
        created.push(record)
      }

      success(res, created, `成功上传${created.length}个文档`)
    } catch (err: any) {
      logger.error('[DeviceDocument] upload error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 更新文档信息（名称、版本、有效期、备注、关联工单）
   */
  async update(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceDocument.findOne({ where: { doc_id: id } })
      if (!record) {
        return fail(res, '文档不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const { doc_name, version, valid_until, related_order, remarks, device_id } = req.body || {}

      const update: any = {}
      if (doc_name !== undefined) update.doc_name = doc_name
      if (version !== undefined) update.version = version
      if (valid_until !== undefined) update.valid_until = valid_until ? String(valid_until).slice(0, 10) : null
      if (related_order !== undefined) update.related_order = related_order || null
      if (remarks !== undefined) update.remarks = remarks

      // 设备切换时同步冗余字段
      if (device_id !== undefined && device_id && Number(device_id) !== Number(record.getDataValue('device_id'))) {
        const device = await Device.findOne({ where: { device_id } })
        if (!device) {
          return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)
        }
        update.device_id = Number(device_id)
        update.device_code = (device as any).device_code || ''
        update.device_name = (device as any).device_name || ''
      }

      await record.update(update)
      success(res, record, '更新成功')
    } catch (err: any) {
      logger.error('[DeviceDocument] update error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除文档（同时删除物理文件）
   */
  async delete(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceDocument.findOne({ where: { doc_id: id } })
      if (!record) {
        return fail(res, '文档不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      // 删除物理文件
      const relPath = record.getDataValue('file_path')
      if (relPath) {
        const filePath = path.resolve(process.cwd(), relPath.replace(/^\//, ''))
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        } catch (e) {
          logger.warn('[DeviceDocument] delete file failed:', relPath, e?.message)
        }
      }

      await record.destroy()
      success(res, null, '删除成功')
    } catch (err: any) {
      logger.error('[DeviceDocument] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 按设备查询所有文档（按文档类型分组返回）
   */
  async listByDevice(req: any, res: any) {
    try {
      const { deviceId } = req.params
      if (!deviceId) {
        return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)
      }
      const rows = await DeviceDocument.findAll({
        where: { device_id: Number(deviceId) },
        order: [['doc_type', 'ASC'], ['created_at', 'DESC'], ['doc_id', 'DESC']],
      })

      // 按文档类型分组
      const groups: Record<string, any[]> = {}
      for (const key of Object.keys(DOC_TYPE_MAP)) {
        groups[key] = []
      }
      const list = (rows || []).map((r: any) => {
        const d = r.toJSON ? r.toJSON() : r
        return { ...d, file_size_text: formatSize(d.file_size), doc_type_name: DOC_TYPE_MAP[d.doc_type as string] || d.doc_type }
      })
      for (const item of list) {
        const t = item.doc_type
        if (!groups[t]) groups[t] = []
        groups[t].push(item)
      }

      // 同时返回设备信息
      const device = await Device.findOne({ where: { device_id: Number(deviceId) } })

      success(res, {
        device: device || null,
        groups,
        total: list.length,
      })
    } catch (err: any) {
      logger.error('[DeviceDocument] listByDevice error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 下载文档（直接以附件形式返回物理文件）
   */
  async download(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceDocument.findOne({ where: { doc_id: id } })
      if (!record) {
        return fail(res, '文档不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const relPath = record.getDataValue('file_path')
      if (!relPath) {
        return fail(res, '文件路径为空', ErrorCode.BUSINESS_ERROR)
      }
      const filePath = path.resolve(process.cwd(), relPath.replace(/^\//, ''))
      if (!fs.existsSync(filePath)) {
        return fail(res, '物理文件不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      // 安全检查：必须在 uploads 目录下
      const uploadsRoot = path.resolve(process.cwd(), 'uploads')
      const relative = path.relative(uploadsRoot, filePath)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return fail(res, '文件路径不合法', ErrorCode.PARAM_INVALID)
      }

      // 使用原始文档名称作为下载文件名
      const docName = record.getDataValue('doc_name') || path.basename(filePath)
      const format = record.getDataValue('file_format') || ''
      const downloadName = format ? `${docName}.${format}` : docName
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`)
      res.setHeader('Content-Type', 'application/octet-stream')

      const stream = fs.createReadStream(filePath)
      stream.on('error', (err) => {
        logger.error('[DeviceDocument] download stream error:', err)
        if (!res.headersSent) {
          return fail(res, '文件读取失败', ErrorCode.SYSTEM_ERROR)
        }
        res.end()
      })
      stream.pipe(res)
    } catch (err: any) {
      logger.error('[DeviceDocument] download error:', err)
      if (!res.headersSent) {
        fail(res, err.message || '下载失败', ErrorCode.SYSTEM_ERROR)
      }
    }
  },
}

// 清理临时文件（multer 接收到的）
function cleanupFiles(files: any[]) {
  if (!files || files.length === 0) return
  for (const f of files) {
    try {
      if (f && f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path)
    } catch { /* ignore */ }
  }
}
