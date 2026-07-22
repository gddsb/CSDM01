import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { ReportOrder, ReportImage } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'


const UPLOAD_DIR = 'uploads/reports'

const ensureDir = () => {
  const dir = path.resolve(process.cwd(), UPLOAD_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

const getFileMd5 = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath)
  const hashSum = crypto.createHash('md5')
  hashSum.update(fileBuffer)
  return hashSum.digest('hex')
}

// 上传报工图片（同时持久化到 production_report_image 表）
// category: defect=不良, label=标签, exception=异常
// MD5去重只针对当前报工单已上传的图片，不对历史上传去重
export const uploadImages = async (req, res) => {
  try {
    const { report_no, category } = req.params
    const files = req.files || []
    if (files.length === 0) return fail(res, '请选择要上传的图片')

    if (!report_no) return fail(res, '报工单号不能为空')
    if (!category) return fail(res, '图片分类不能为空')

    // 解析报工单
    const reportOrder = await ReportOrder.findOne({ where: { report_no } })
    if (!reportOrder) return fail(res, '报工单不存在', ErrorCode.RECORD_NOT_FOUND)

    const dir = ensureDir()

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = report_no + '-' + dateStr + '-'

    // 从数据库查当前报工单的所有图片记录，用于MD5去重和流水号计算
    const dbRecords = await ReportImage.findAll({
      where: { report_order_id: reportOrder.report_order_id },
      raw: true,
      order: [['created_at', 'DESC']],
    })

    // 构建当前报工单已上传图片的MD5映射（只对当前工单去重，不对历史上传去重）
    const existingMap = new Map()
    dbRecords.forEach(r => {
      if (r.file_hash) {
        existingMap.set(r.file_hash, path.basename(r.image_url || ''))
      }
    })

    // 计算当前报工单当日最大流水号
    let maxSeq = 0
    dbRecords.forEach(r => {
      const fname = path.basename(r.image_url || '', path.extname(r.image_url || ''))
      if (fname.startsWith(prefix)) {
        const seqPart = fname.slice(prefix.length)
        const seqNum = parseInt(seqPart, 10)
        if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum
      }
    })

    const uploaded: string[] = []
    const skipped: string[] = []
    const newRecords: any[] = []
    let currentSeq = maxSeq
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileMd5 = getFileMd5(file.path)

      if (existingMap.has(fileMd5)) {
        const existName = existingMap.get(fileMd5)
        skipped.push(existName)
        const existUrl = `/${UPLOAD_DIR}/${existName}`
        uploaded.push(existUrl)
        fs.unlinkSync(file.path)
        continue
      }

      currentSeq += 1
      const seqStr = String(currentSeq).padStart(3, '0')
      const ext = path.extname(file.originalname) || '.jpg'
      const newName = `${prefix}${seqStr}${ext}`
      const destPath = path.join(dir, newName)
      fs.renameSync(file.path, destPath)
      const newUrl = `/${UPLOAD_DIR}/${newName}`
      uploaded.push(newUrl)
      existingMap.set(fileMd5, newName)
      newRecords.push({
        report_order_id: reportOrder.report_order_id,
        category,
        image_url: newUrl,
        file_hash: fileMd5,
      })
    }

    // 持久化新图片记录到 production_report_image 表
    if (newRecords.length > 0) {
      await ReportImage.bulkCreate(newRecords)
    }

    const newCount = uploaded.length - skipped.length
    const msg = skipped.length > 0
      ? `成功上传${newCount}张图片，跳过${skipped.length}张重复图片`
      : `成功上传${uploaded.length}张图片`
    return success(res, uploaded, msg)
  } catch (err) {
    console.error('上传报工图片失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 查询报工单图片列表
export const list = async (req, res) => {
  try {
    const { report_order_id, category } = req.query
    const where: any = {}
    if (report_order_id) where.report_order_id = Number(report_order_id)
    if (category) where.category = category

    const rows = await ReportImage.findAll({
      where,
      order: [['image_id', 'ASC']],
    })
    return success(res, rows, '查询成功')
  } catch (err) {
    console.error('查询报工图片列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除报工图片记录（同时删除文件）
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const image = await ReportImage.findOne({ where: { image_id: id } })
    if (!image) return fail(res, '图片记录不存在', ErrorCode.RECORD_NOT_FOUND)

    // 删除文件
    try {
      const filePath = path.resolve(process.cwd(), image.image_url.replace(/^\//, ''))
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (err) {
        logger.warn('[SilentCatch] // 文件删除失败不影响记录删除', err?.message)
    }

    await image.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除报工图片失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { uploadImages, list, remove }
