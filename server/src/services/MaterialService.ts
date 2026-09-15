/**
 * 料品 Service（MaterialController 下沉）
 * 纯 CRUD + 必填字段校验 + material_code 唯一性
 */
import { Op } from 'sequelize'
import { Material } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

export const MaterialService = {
  async list(query: any) {
    const { keyword, is_active, category_name, dateStart, dateEnd, page = 1, pageSize = 20, page_size } = query
    const actualPageSize = page_size || pageSize
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { material_code: { [Op.like]: `%${keyword}%` } },
        { material_name: { [Op.like]: `%${keyword}%` } },
        { specification: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (is_active !== undefined && is_active !== '') where.is_active = is_active === 'true'
    if (category_name) where.category_name = { [Op.like]: `%${category_name}%` }
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }
    const limit = Math.min(Number(actualPageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await Material.findAndCountAll({ where, limit, offset, order: [['created_at', 'DESC']] })
  },

  async detail(id: number | string) {
    const material = await Material.findOne({ where: { material_id: Number(id) } })
    if (!material) throw new AppError('料品不存在', 10002, 404)
    return material
  },

  async create(body: any) {
    const { material_code, material_name, category_name, unit_name, effective_date, expiry_date } = body
    if (!material_code || !material_name || !category_name || !unit_name || !effective_date || !expiry_date) {
      throw new AppError('料号、品名、分类名称、单位名称、生效日期、失效日期不能为空', 10001, 400)
    }
    const exists = await Material.findOne({ where: { material_code } })
    if (exists) throw new AppError('料号已存在', 20001, 409)
    return await Material.create(body as any)
  },

  async update(id: number | string, body: any) {
    const material = await Material.findOne({ where: { material_id: Number(id) } })
    if (!material) throw new AppError('料品不存在', 10002, 404)
    if (body.material_code && body.material_code !== (material as any).material_code) {
      const exists = await Material.findOne({
        where: { material_code: body.material_code, material_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('料号已存在', 20001, 409)
    }
    await material.update(body as any)
    return material
  },

  async remove(id: number | string) {
    const material = await Material.findOne({ where: { material_id: Number(id) } })
    if (!material) throw new AppError('料品不存在', 10002, 404)
    await material.destroy()
    return true
  },
}

export default MaterialService
