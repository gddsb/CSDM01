/**
 * 不良图片 Controller — DB 操作全部走 Service；fs + crypto 边界保留 Controller
 */
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import DefectImageService from '../services/DefectImageService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

/** 流式计算文件 MD5 */
async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/** 清理临时文件数组 */
function cleanupFiles(files: any[]) {
  if (!files || files.length === 0) return
  for (const f of files) {
    try { if (f?.path) fs.unlinkSync(f.path) } catch { /* ignore */ }
  }
}

// 不良图片列表
export const listImages = asyncHandler(async (req: Request, res: Response) => {
  const images = await DefectImageService.listByDefect(Number(req.params.id))
  return success(res, images, '查询成功')
})

// 上传不良图片（支持多文件）
export const uploadImages = async (req: Request, res: Response) => {
  try {
    const defectId = Number(req.params.id)
    const files: any[] = (req as any).files || []
    if (files.length === 0) {
      return fail(res, '请选择要上传的图片')
    }

    // DB 前置校验
    const defect = await DefectImageService.assertDefectExists(defectId)
    const existingCount = await DefectImageService.checkUploadLimit(defectId, files.length)

    // 确保上传目录存在
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'defects')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    // 计算批次内 hash 并去重
    const hashBatchSet = new Set<string>()
    const fileHashList: Array<{ file: any; hash: string }> = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const hash = await computeFileHash(file.path)

      // 批次内重复 → 整体清理
      if (hashBatchSet.has(hash)) {
        cleanupFiles(files)
        return fail(res, `第${i + 1}张图片与本次上传的其他图片重复`)
      }
      hashBatchSet.add(hash)

      // 数据库内重复 → 整体清理
      const dbDuplicate = await DefectImageService.checkDuplicate(defectId, hash)
      if (dbDuplicate) {
        cleanupFiles(files)
        return fail(res, `图片「${file.originalname}」已存在，请勿重复上传`)
      }
      fileHashList.push({ file, hash })
    }

    // fs rename + DB create
    const created: any[] = []
    for (let i = 0; i < fileHashList.length; i++) {
      const { file, hash } = fileHashList[i]
      const seqNum = existingCount + i + 1
      const seqStr = String(seqNum).padStart(2, '0')
      const ext = path.extname(file.originalname) || '.jpg'
      const newName = `${(defect as any).defect_code}-${seqStr}${ext}`
      const destPath = path.join(uploadsDir, newName)

      fs.renameSync(file.path, destPath)

      const record = await DefectImageService.createImage({
        defect_id: defectId,
        image_url: `/uploads/defects/${newName}`,
        image_name: newName,
        sort_order: seqNum,
        file_hash: hash,
      })
      created.push(record)
    }

    return success(res, created, `成功上传${created.length}张图片`)
  } catch (err: any) {
    cleanupFiles((req as any).files || [])
    return fail(res, err.message || '服务器错误', err instanceof Error ? ErrorCode.SYSTEM_ERROR : ErrorCode.SYSTEM_ERROR)
  }
}

// 删除不良图片
export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const defectId = Number(req.params.id)
  const imageId = Number((req.params as any).imageId)
  const image = await DefectImageService.findByIdAndDefect(defectId, imageId)

  // 删物理文件
  const filePath = path.resolve(process.cwd(), (image as any).image_url.replace(/^\//, ''))
  try { fs.unlinkSync(filePath) } catch { /* ignore */ }

  await DefectImageService.destroyImage(image)
  return success(res, null, '删除成功')
})

export default { listImages, uploadImages, deleteImage }
