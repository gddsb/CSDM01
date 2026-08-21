import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

const UPLOAD_DIR = 'uploads/common'

const ensureDir = () => {
  const dir = path.resolve(process.cwd(), UPLOAD_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export const uploadImage = async (req, res) => {
  try {
    const file = req.file
    if (!file) return fail(res, '请选择要上传的图片')

    const dir = ensureDir()
    const ext = path.extname(file.originalname) || '.png'
    const md5 = crypto.createHash('md5')
    md5.update(fs.readFileSync(file.path))
    const hash = md5.digest('hex')
    const newName = `${hash}${ext}`
    const newPath = path.join(dir, newName)

    if (!fs.existsSync(newPath)) {
      fs.renameSync(file.path, newPath)
    } else {
      try { fs.unlinkSync(file.path) } catch {}
    }

    const url = `/${UPLOAD_DIR}/${newName}`
    return success(res, { url, name: newName }, '上传成功')
  } catch (err) {
    logger.error('图片上传失败:', err)
    return fail(res, '上传失败', ErrorCode.SYSTEM_ERROR)
  }
}

// 设备图片通用上传：按 doc_type 分目录
// 命名规范：{doc_type}_{doc_id}_{序号}_{时间戳}.ext
const DEVICE_DIR_MAP = {
  fault: 'uploads/device/fault',
  repair: 'uploads/device/repair',
  inspection: 'uploads/device/inspection',
  maintenance: 'uploads/device/maintenance',
  calibration: 'uploads/device/calibration',
}

export const uploadDeviceImage = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : [])
    if (files.length === 0) {
      return fail(res, '请选择要上传的图片', ErrorCode.PARAM_INVALID)
    }

    const docType = req.body.doc_type || req.query.doc_type
    const docId = req.body.doc_id || req.query.doc_id
    if (!docType || !DEVICE_DIR_MAP[docType]) {
      // 清理临时文件
      files.forEach((f) => { try { fs.unlinkSync(f.path) } catch {} })
      return fail(res, `单据类型无效，可选值：${Object.keys(DEVICE_DIR_MAP).join('/')}`, ErrorCode.PARAM_INVALID)
    }
    if (!docId) {
      files.forEach((f) => { try { fs.unlinkSync(f.path) } catch {} })
      return fail(res, '单据ID不能为空', ErrorCode.PARAM_INVALID)
    }

    const relDir = DEVICE_DIR_MAP[docType]
    const dir = path.resolve(process.cwd(), relDir)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const ts = Date.now()
    const created = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const seq = i + 1
      const ext = path.extname(file.originalname) || '.jpg'
      const newName = `${docType}_${docId}_${seq}_${ts}${ext}`
      const destPath = path.join(dir, newName)
      fs.renameSync(file.path, destPath)
      created.push({
        doc_type: docType,
        doc_id: Number(docId),
        file_path: `/${relDir}/${newName}`,
        file_name: file.originalname || newName,
        file_size: file.size || null,
        sort_order: seq,
      })
    }

    return success(res, created, `成功上传${created.length}张图片`)
  } catch (err) {
    logger.error('设备图片上传失败:', err)
    return fail(res, '上传失败', ErrorCode.SYSTEM_ERROR)
  }
}

export default { uploadImage, uploadDeviceImage }
