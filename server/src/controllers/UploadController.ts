import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { success, fail, MAX_PAGE_SIZE } from '../utils/response.js'

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
    console.error('图片上传失败:', err)
    return fail(res, err.message || '上传失败')
  }
}

export default { uploadImage }
