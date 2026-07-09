import { Op } from 'sequelize'
import path from 'path'
import fs from 'fs'
import { DefectType, DefectImage } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 不良分类列表
export const list = async (req, res) => {
  try {
    const { keyword, status, defect_type, category_name, display, dateStart, dateEnd, page = 1, pageSize = 50 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { defect_code: { [Op.like]: `%${keyword}%` } },
        { defect_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap = { '启用': 1, '停用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (defect_type) where.defect_type = defect_type
    if (category_name) where.category_name = category_name
    if (display !== undefined && display !== '') {
      const displayVal = typeof display === 'string' ? Number(display) : display
      where.display = !!displayVal
    }
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await DefectType.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['defect_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询不良分类列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 不良分类详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const defect = await DefectType.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '不良分类不存在', 404)
    return success(res, defect, '查询成功')
  } catch (err) {
    console.error('查询不良分类详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建不良分类
export const create = async (req, res) => {
  try {
    const { defect_code, defect_name } = req.body
    if (!defect_code || !defect_name) {
      return fail(res, '不良编码和名称不能为空')
    }
    const exists = await DefectType.findOne({ where: { defect_code } })
    if (exists) return fail(res, '不良编码已存在')
    const defect = await DefectType.create(req.body)
    return success(res, defect, '创建成功')
  } catch (err) {
    console.error('创建不良分类失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改不良分类
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const defect = await DefectType.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '不良分类不存在', 404)
    if (req.body.defect_code && req.body.defect_code !== defect.defect_code) {
      const exists = await DefectType.findOne({
        where: { defect_code: req.body.defect_code, defect_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '不良编码已存在')
    }
    await defect.update(req.body)
    return success(res, defect, '修改成功')
  } catch (err) {
    console.error('修改不良分类失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除不良分类
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const defect = await DefectType.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '不良分类不存在', 404)

    // 级联删除关联图片
    const images = await DefectImage.findAll({ where: { defect_id: id } })
    images.forEach(img => {
      try {
        const filePath = path.resolve(process.cwd(), img.image_url.replace(/^\//, ''))
        fs.unlinkSync(filePath)
      } catch {}
    })
    await DefectImage.destroy({ where: { defect_id: id } })

    await defect.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除不良分类失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 生成下一个不良编码（自动编码）
export const nextCode = async (req, res) => {
  try {
    const count = await DefectType.count()
    const nextNum = count + 1
    const code = `D-${String(nextNum).padStart(3, '0')}`
    return success(res, { defect_code: code }, '查询成功')
  } catch (err) {
    console.error('生成不良编码失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove, nextCode }
