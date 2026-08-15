import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { Op } from 'sequelize'
import { DefectImage, DefectType } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

const computeFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('data', data => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

// 不良图片列表
export const listImages = async (req, res) => {
  try {
    const { id } = req.params
    const images = await DefectImage.findAll({
      where: { defect_id: id },
      order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
    })
    return success(res, images, '查询成功')
  } catch (err) {
    console.error('查询不良图片列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 上传不良图片（支持多文件，最多10张）
export const uploadImages = async (req, res) => {
  try {
    const { id } = req.params
    const files = req.files || []
    if (files.length === 0) {
      return fail(res, '请选择要上传的图片')
    }

    // 查找不良项，获取不良编码
    const defect = await DefectType.findOne({ where: { defect_id: id } })
    if (!defect) {
      // 清理临时文件
      files.forEach(f => { try { fs.unlinkSync(f.path) } catch {} })
      return fail(res, '不良项不存在', ErrorCode.RECORD_NOT_FOUND)
    }

    // 检查已有图片数量
    const existingCount = await DefectImage.count({ where: { defect_id: id } })
    if (existingCount + files.length > 10) {
      files.forEach(f => { try { fs.unlinkSync(f.path) } catch {} })
      return fail(res, `每种不良最多上传10张图片，当前已有${existingCount}张`)
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'defects')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    // 计算所有文件的哈希并检查重复
    const fileInfoList = []
    const hashSet = new Set()
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const hash = await computeFileHash(file.path)
      // 检查当前批次内是否重复
      if (hashSet.has(hash)) {
        files.forEach(f => { try { fs.unlinkSync(f.path) } catch {} })
        return fail(res, `第${i + 1}张图片与本次上传的其他图片重复`)
      }
      hashSet.add(hash)
      // 检查数据库中同一不良项下是否已有相同图片
      const exists = await DefectImage.findOne({
        where: { defect_id: id, file_hash: hash },
      })
      if (exists) {
        files.forEach(f => { try { fs.unlinkSync(f.path) } catch {} })
        return fail(res, `图片「${file.originalname}」已存在，请勿重复上传`)
      }
      fileInfoList.push({ file, hash })
    }

    const created = []
    for (let i = 0; i < fileInfoList.length; i++) {
      const { file, hash } = fileInfoList[i]
      const seqNum = existingCount + i + 1
      const seqStr = String(seqNum).padStart(2, '0')
      const ext = path.extname(file.originalname) || '.jpg'
      const newName = `${defect.defect_code}-${seqStr}${ext}`
      const destPath = path.join(uploadsDir, newName)

      fs.renameSync(file.path, destPath)

      const record = await DefectImage.create({
        defect_id: id,
        image_url: `/uploads/defects/${newName}`,
        image_name: newName,
        sort_order: seqNum,
        file_hash: hash,
      })
      created.push(record)
    }

    return success(res, created, `成功上传${created.length}张图片`)
  } catch (err) {
    console.error('上传不良图片失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除不良图片
export const deleteImage = async (req, res) => {
  try {
    const { id, imageId } = req.params
    const image = await DefectImage.findOne({ where: { image_id: imageId, defect_id: id } })
    if (!image) return fail(res, '图片不存在', ErrorCode.RECORD_NOT_FOUND)

    // 删除物理文件
    const filePath = path.resolve(process.cwd(), image.image_url.replace(/^\//, ''))
    try { fs.unlinkSync(filePath) } catch {}

    await image.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除不良图片失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { listImages, uploadImages, deleteImage }
