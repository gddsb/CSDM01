/**
 * 不良分类 Service（DefectTypeController 下沉）
 *
 * 业务：不良分类 CRUD + 三段式自动编码生成
 *   编码格式：{检验类型缩写}-{不良类型缩写}-{两位流水码}
 *   categoryMap: '来料检验类型'→'IC', '制程检验类型'→'PC'
 *   typeMap: 10 种不良类型 → 3 位缩写
 *
 * fs 级联删除（物理图片清理）保留在 Controller
 */
import { Op } from 'sequelize'
import { DefectType, DefectImage } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

const categoryMap: Record<string, string> = {
  '来料检验类型': 'IC',
  '制程检验类型': 'PC',
}
const typeMap: Record<string, string> = {
  '外观不良': 'COS',
  '尺寸不良': 'DIM',
  '理化不良': 'PHC',
  '材质不良': 'MAT',
  '标识不良': 'LBL',
  '污染异物': 'CON',
  '运输不良': 'TRD',
  '来料不良': 'INC',
  '制程不良': 'PNC',
  '检验报废': 'SCR',
}

/** 生成下一个不良编码（三段式） */
export function buildDefectCode(defectType?: string, categoryName?: string, count = 0): string {
  const catCode = (categoryName && categoryMap[categoryName]) || 'XX'
  const typeCode = (defectType && typeMap[defectType]) || 'XX'
  return `${catCode}-${typeCode}-${String(count + 1).padStart(2, '0')}`
}

export const DefectTypeService = {
  async list(query: any) {
    const { keyword, status, defect_type, category_name, display, dateStart, dateEnd, page = 1, pageSize = 50 } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { defect_code: { [Op.like]: `%${keyword}%` } },
        { defect_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap: Record<string, number> = { '启用': 1, '停用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (defect_type) where.defect_type = defect_type
    if (category_name) where.category_name = category_name
    if (display !== undefined && display !== '') {
      if (Array.isArray(display)) {
        where.display = { [Op.in]: display.map(v => Number(v)) }
      } else {
        const displayVal = typeof display === 'string' ? Number(display) : display
        where.display = !!displayVal
      }
    }
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await DefectType.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['defect_id', 'DESC']],
    })
  },

  async detail(id: number | string) {
    const defect = await DefectType.findOne({ where: { defect_id: Number(id) } })
    if (!defect) throw new AppError('不良分类不存在', 10002, 404)
    return defect
  },

  /** 创建：自动生成三段式编码（如未提供） */
  async create(body: any) {
    if (!body.defect_name) throw new AppError('不良名称不能为空', 10001, 400)

    let finalCode: string | undefined = body.defect_code
    if (!finalCode && body.defect_type && body.category_name) {
      const count = await DefectType.count({
        where: { defect_type: body.defect_type, category_name: body.category_name },
      })
      finalCode = buildDefectCode(body.defect_type, body.category_name, count)
    }
    // 唯一性兜底：如编码已存在，递推直到唯一
    if (finalCode) {
      let exists = await DefectType.findOne({ where: { defect_code: finalCode } })
      while (exists) {
        const count = await DefectType.count({
          where: { defect_type: body.defect_type, category_name: body.category_name },
        })
        finalCode = buildDefectCode(body.defect_type, body.category_name, count)
        exists = await DefectType.findOne({ where: { defect_code: finalCode } })
      }
    }

    return await DefectType.create({ ...body, defect_code: finalCode } as any)
  },

  async update(id: number | string, body: any) {
    const defect = await DefectType.findOne({ where: { defect_id: Number(id) } })
    if (!defect) throw new AppError('不良分类不存在', 10002, 404)
    if (body.defect_code && body.defect_code !== (defect as any).defect_code) {
      const exists = await DefectType.findOne({
        where: { defect_code: body.defect_code, defect_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('不良编码已存在', 20001, 409)
    }
    await defect.update(body as any)
    return defect
  },

  /**
   * 删除不良分类
   * @param id defect_id
   * @returns 需要物理删除的图片路径列表（Controller 负责 fs 清理）
   */
  async remove(id: number | string): Promise<string[]> {
    const defect = await DefectType.findOne({ where: { defect_id: Number(id) } })
    if (!defect) throw new AppError('不良分类不存在', 10002, 404)

    // 收集图片路径 → 返回给 Controller 做 fs 删除
    const images = await DefectImage.findAll({
      where: { defect_id: Number(id) },
      attributes: ['image_url'],
    })
    const paths = images.map((img: any) => img.getDataValue('image_url'))

    await DefectImage.destroy({ where: { defect_id: Number(id) } })
    await defect.destroy()

    return paths
  },

  /** 生成下一个不良编码（公开接口，供前端预览） */
  async nextCode(defectType?: string, categoryName?: string): Promise<{ defect_code: string }> {
    const where: any = {}
    if (categoryName) where.category_name = categoryName
    if (defectType) where.defect_type = defectType
    const count = await DefectType.count({ where })
    return { defect_code: buildDefectCode(defectType, categoryName, count) }
  },
}

export default DefectTypeService
