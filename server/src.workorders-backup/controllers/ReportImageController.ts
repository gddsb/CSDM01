import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { Op } from 'sequelize'
import { ProcessReport } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const UPLOAD_DIR = 'uploads/reports'

const ensureDir = (reportNo) => {
  const dir = path.resolve(process.cwd(), UPLOAD_DIR, reportNo || 'default')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

const getFileMd5 = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath)
  const hashSum = crypto.createHash('md5')
  hashSum.update(fileBuffer)
  return hashSum.digest('hex')
}

const getExistingFileMap = (dir) => {
  const map = new Map()
  if (!fs.existsSync(dir)) return map
  const files = fs.readdirSync(dir)
  for (const f of files) {
    const filePath = path.join(dir, f)
    try {
      const md5 = getFileMd5(filePath)
      map.set(md5, f)
    } catch (e) {
      // skip
    }
  }
  return map
}

const parseImages = (images) => {
  if (!images) return []
  if (Array.isArray(images)) return images
  try {
    return JSON.parse(images)
  } catch {
    return []
  }
}

export const uploadImages = async (req, res) => {
  try {
    const { report_no, category } = req.params
    const files = req.files || []
    if (files.length === 0) return fail(res, '请选择要上传的图片')

    const reportNo = report_no || 'REPORT'
    const dir = ensureDir(reportNo)

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const categoryPrefix = category ? `${category}_` : ''

    const prefix = reportNo + '_' + dateStr + '_' + categoryPrefix
    const existingFiles = fs.readdirSync(dir).filter(f => f.startsWith(prefix))
    const existingMap = getExistingFileMap(dir)

    const uploaded = []
    const skipped = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileMd5 = getFileMd5(file.path)

      if (existingMap.has(fileMd5)) {
        const existName = existingMap.get(fileMd5)
        skipped.push(existName)
        uploaded.push(`/${UPLOAD_DIR}/${reportNo}/${existName}`)
        fs.unlinkSync(file.path)
        continue
      }

      const seqNum = existingFiles.length + uploaded.length - skipped.length + 1
      const seqStr = String(seqNum).padStart(3, '0')
      const ext = path.extname(file.originalname) || '.jpg'
      const newName = `${reportNo}_${dateStr}_${categoryPrefix}${seqStr}${ext}`
      const destPath = path.join(dir, newName)
      fs.renameSync(file.path, destPath)
      uploaded.push(`/${UPLOAD_DIR}/${reportNo}/${newName}`)
      existingMap.set(fileMd5, newName)
    }

    const newCount = uploaded.length - skipped.length
    const msg = skipped.length > 0
      ? `成功上传${newCount}张图片，跳过${skipped.length}张重复图片`
      : `成功上传${uploaded.length}张图片`
    return success(res, uploaded, msg)
  } catch (err) {
    console.error('上传报工图片失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { uploadImages }
