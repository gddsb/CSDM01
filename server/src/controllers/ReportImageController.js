import path from 'path'
import fs from 'fs'
import { Op } from 'sequelize'
import { ProcessReport } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const UPLOAD_DIR = 'uploads/reports'

const ensureDir = () => {
  const dir = path.resolve(process.cwd(), UPLOAD_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
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

    const dir = ensureDir()

    const reportNo = report_no || 'REPORT'
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const categoryPrefix = category ? `${category}_` : ''

    const prefix = reportNo + '_' + dateStr + '_' + categoryPrefix
    const existingFiles = fs.readdirSync(dir).filter(f => f.startsWith(prefix))

    const uploaded = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const seqNum = existingFiles.length + uploaded.length + 1
      const seqStr = String(seqNum).padStart(3, '0')
      const ext = path.extname(file.originalname) || '.jpg'
      const newName = `${reportNo}_${dateStr}_${categoryPrefix}${seqStr}${ext}`
      const destPath = path.join(dir, newName)
      fs.renameSync(file.path, destPath)
      uploaded.push(`/${UPLOAD_DIR}/${newName}`)
    }

    return success(res, uploaded, `成功上传${uploaded.length}张图片`)
  } catch (err) {
    console.error('上传报工图片失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { uploadImages }
