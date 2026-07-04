import { Op } from 'sequelize'
import { Material } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 料品列表
export const list = async (req, res) => {
  try {
    const { keyword, status, category_code, customer_code, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { material_code: { [Op.like]: `%${keyword}%` } },
        { material_name: { [Op.like]: `%${keyword}%` } },
        { specification: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') where.status = Number(status)
    if (category_code) where.category_code = category_code
    if (customer_code) where.customer_code = customer_code

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Material.findAndCountAll({
      where,
      limit,
      offset,
      order: [['material_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询料品列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 料品详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const material = await Material.findOne({ where: { material_id: id } })
    if (!material) return fail(res, '料品不存在', 404)
    return success(res, material, '查询成功')
  } catch (err) {
    console.error('查询料品详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建料品
export const create = async (req, res) => {
  try {
    const { material_code, material_name } = req.body
    if (!material_code || !material_name) {
      return fail(res, '料品编码和名称不能为空')
    }
    const exists = await Material.findOne({ where: { material_code } })
    if (exists) return fail(res, '料品编码已存在')
    const material = await Material.create(req.body)
    return success(res, material, '创建成功')
  } catch (err) {
    console.error('创建料品失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改料品
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const material = await Material.findOne({ where: { material_id: id } })
    if (!material) return fail(res, '料品不存在', 404)
    if (req.body.material_code && req.body.material_code !== material.material_code) {
      const exists = await Material.findOne({
        where: { material_code: req.body.material_code, material_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '料品编码已存在')
    }
    await material.update(req.body)
    return success(res, material, '修改成功')
  } catch (err) {
    console.error('修改料品失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除料品
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const material = await Material.findOne({ where: { material_id: id } })
    if (!material) return fail(res, '料品不存在', 404)
    await material.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除料品失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove }
