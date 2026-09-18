/**
 * 不良图片 Service（DefectImageController 下沉）
 *
 * 只处理 DB CRUD + 业务校验（不良项存在性、数量上限、hash 去重）；
 * 文件系统 IO（hash 计算、rename/unlink、目录创建）保留在 Controller。
 */
import sequelize from '../config/database.js'
import { DefectImage, DefectType } from '../models/index.js'
import { AppError } from '../utils/error.js'

/** 每种不良最多上传图片数量 */
const MAX_IMAGES_PER_DEFECT = 10

export const DefectImageService = {
  /** 查某不良项下的所有图片（按 sort_order + image_id 排序） */
  async listByDefect(defectId: number | string) {
    return await DefectImage.findAll({
      where: { defect_id: Number(defectId) },
      order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
    })
  },

  /** 校验不良项存在，返回 defect 实例（含 defect_code 供文件命名用） */
  async assertDefectExists(defectId: number | string) {
    const defect = await DefectType.findOne({
      where: { defect_id: Number(defectId) },
    })
    if (!defect) throw new AppError('不良项不存在', 10002, 404)
    return defect
  },

  /** 校验上传数量上限，返回现有图片数量 */
  async checkUploadLimit(defectId: number | string, incoming: number) {
    const existingCount = await DefectImage.count({ where: { defect_id: Number(defectId) } })
    if (existingCount + incoming > MAX_IMAGES_PER_DEFECT) {
      throw new AppError(
        `每种不良最多上传${MAX_IMAGES_PER_DEFECT}张图片，当前已有${existingCount}张`,
        10001, 400,
      )
    }
    return existingCount
  },

  /** 按 hash 查重（同一不良项下是否已有相同文件） */
  async checkDuplicate(defectId: number | string, fileHash: string) {
    const exists = await DefectImage.findOne({
      where: { defect_id: Number(defectId), file_hash: fileHash },
    })
    return !!exists
  },

  /** 创建图片记录 */
  async createImage(data: {
    defect_id: number
    image_url: string
    image_name: string
    sort_order: number
    file_hash: string
  }) {
    return await DefectImage.create(data)
  },

  /** 查图片并校验归属（必须是指定 defectId 下的图片） */
  async findByIdAndDefect(defectId: number | string, imageId: number | string) {
    const image = await DefectImage.findOne({
      where: { image_id: Number(imageId), defect_id: Number(defectId) },
    })
    if (!image) throw new AppError('图片不存在', 10002, 404)
    return image
  },

  /** 删除图片记录（Controller 负责 fs 清理） */
  async destroyImage(image: any) {
    await image.destroy()
  },
}

export default DefectImageService
