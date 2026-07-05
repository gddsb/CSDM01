import path from 'path'
import fs from 'fs'
import { Op } from 'sequelize'
import { DefectImage, DefectType } from '../models/index.js'
import { success, fail } from '../utils/response.js'

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
    return fail(res, '服务器错误', 500)
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
      return fail(res, '不良项不存在', 404)
    }

    // 检查已有图片数量
    const existingCount = await DefectImage.count({ where: { defect_id: id } })
    if (existingCount + files.length > 10) {
      files.forEach(f => { try { fs.unlinkSync(f.path) } catch {} })
      return fail(res, `每种不良最多上传10张图片，当前已有${existingCount}张`)
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'defects')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const created = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // 计算流水码：已有数量 + 当前序号
      const seqNum = existingCount + i + 1
      const seqStr = String(seqNum).padStart(2, '0')
      const ext = path.extname(file.originalname) || '.jpg'
      const newName = `${defect.defect_code}-${seqStr}${ext}`
      const destPath = path.join(uploadsDir, newName)

      // 移动文件
      fs.renameSync(file.path, destPath)

      const record = await DefectImage.create({
        defect_id: id,
        image_url: `/uploads/defects/${newName}`,
        image_name: newName,
        sort_order: seqNum,
      })
      created.push(record)
    }

    return success(res, created, `成功上传${created.length}张图片`)
  } catch (err) {
    console.error('上传不良图片失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除不良图片
export const deleteImage = async (req, res) => {
  try {
    const { id, imageId } = req.params
    const image = await DefectImage.findOne({ where: { image_id: imageId, defect_id: id } })
    if (!image) return fail(res, '图片不存在', 404)

    // 删除物理文件
    const filePath = path.resolve(process.cwd(), image.image_url.replace(/^\//, ''))
    try { fs.unlinkSync(filePath) } catch {}

    await image.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除不良图片失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { listImages, uploadImages, deleteImage }
