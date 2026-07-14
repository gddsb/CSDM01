import { Op } from 'sequelize'
import { Customer } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 客户档案列表
export const list = async (req, res) => {
  try {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 50 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { customer_code: { [Op.like]: `%${keyword}%` } },
        { customer_name: { [Op.like]: `%${keyword}%` } },
        { short_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap = { '启用': 1, '停用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Customer.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['customer_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询客户档案列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 客户详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const customer = await Customer.findOne({ where: { customer_id: id } })
    if (!customer) return fail(res, '客户不存在', 404)
    return success(res, customer, '查询成功')
  } catch (err) {
    console.error('查询客户详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建客户
export const create = async (req, res) => {
  try {
    const { customer_code, customer_name } = req.body
    if (!customer_code || !customer_name) {
      return fail(res, '客户编号和名称不能为空')
    }
    const exists = await Customer.findOne({ where: { customer_code } })
    if (exists) return fail(res, '客户编号已存在')
    const payload = { ...req.body }
    // status 兼容前端传 "启用"/"停用"/1/0
    if (payload.status === '启用' || payload.status === 1 || payload.status === '1') {
      payload.status = 1
    } else if (payload.status === '停用' || payload.status === 0 || payload.status === '0') {
      payload.status = 0
    } else {
      payload.status = 1
    }
    payload.created_by = req.user?.username || null
    const customer = await Customer.create(payload)
    return success(res, customer, '创建成功')
  } catch (err) {
    console.error('创建客户失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改客户
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const customer = await Customer.findOne({ where: { customer_id: id } })
    if (!customer) return fail(res, '客户不存在', 404)
    if (req.body.customer_code && req.body.customer_code !== customer.customer_code) {
      const exists = await Customer.findOne({
        where: { customer_code: req.body.customer_code, customer_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '客户编号已存在')
    }
    const payload = { ...req.body }
    if (payload.status !== undefined) {
      if (payload.status === '启用' || payload.status === 1 || payload.status === '1') {
        payload.status = 1
      } else if (payload.status === '停用' || payload.status === 0 || payload.status === '0') {
        payload.status = 0
      }
    }
    await customer.update(payload)
    return success(res, customer, '修改成功')
  } catch (err) {
    console.error('修改客户失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除客户
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const customer = await Customer.findOne({ where: { customer_id: id } })
    if (!customer) return fail(res, '客户不存在', 404)
    await customer.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除客户失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove }
