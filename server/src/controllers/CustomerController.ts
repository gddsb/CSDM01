import { Op } from 'sequelize'
import { Customer } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const PHONE_REGEX = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/

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

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 客户详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const customer = await Customer.findOne({ where: { customer_id: id } })
    if (!customer) return fail(res, '客户不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, customer, '查询成功')
  } catch (err) {
    console.error('查询客户详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 创建客户
export const create = async (req, res) => {
  try {
    const { customer_code, customer_name, short_name, customer_category, customer_type, contact_person, phone, email, address, effective_date, expiry_date, credit_level, tax_id, bank_account, bank_name, remark, sort_order } = req.body
    if (!customer_code || !customer_name) {
      return fail(res, '客户编号和名称不能为空', ErrorCode.PARAM_INVALID)
    }

    if (email !== undefined && email !== '' && !EMAIL_REGEX.test(email)) {
      return fail(res, '邮箱格式不正确', ErrorCode.PARAM_INVALID)
    }
    if (phone !== undefined && phone !== '' && !PHONE_REGEX.test(phone)) {
      return fail(res, '联系电话格式不正确', ErrorCode.PARAM_INVALID)
    }

    const exists = await Customer.findOne({ where: { customer_code } })
    if (exists) return fail(res, '客户编号已存在', ErrorCode.RECORD_EXISTS)
    const customer = await Customer.create({
      customer_code, customer_name, short_name, customer_category, customer_type, contact_person, phone, email, address, effective_date, expiry_date, credit_level, tax_id, bank_account, bank_name, remark, sort_order,
      status: 1,
      created_by: req.user?.username || null,
    })
    return success(res, customer, '创建成功')
  } catch (err) {
    console.error('创建客户失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改客户
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const customer = await Customer.findOne({ where: { customer_id: id } })
    if (!customer) return fail(res, '客户不存在', ErrorCode.RECORD_NOT_FOUND)
    if (req.body.customer_code && req.body.customer_code !== customer.customer_code) {
      const exists = await Customer.findOne({
        where: { customer_code: req.body.customer_code, customer_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '客户编号已存在')
    }
    const { customer_code, customer_name, short_name, customer_category, customer_type, contact_person, phone, email, address, status, effective_date, expiry_date, credit_level, tax_id, bank_account, bank_name, remark, sort_order } = req.body

    if (email !== undefined && email !== '' && !EMAIL_REGEX.test(email)) {
      return fail(res, '邮箱格式不正确', ErrorCode.PARAM_INVALID)
    }
    if (phone !== undefined && phone !== '' && !PHONE_REGEX.test(phone)) {
      return fail(res, '联系电话格式不正确', ErrorCode.PARAM_INVALID)
    }

    const payload = {
      customer_code, customer_name, short_name, customer_category, customer_type, contact_person, phone, email, address, effective_date, expiry_date, credit_level, tax_id, bank_account, bank_name, remark, sort_order,
    }
    if (status !== undefined) {
      payload.status = (status === '启用' || status === 1 || status === '1') ? 1 : (status === '停用' || status === 0 || status === '0') ? 0 : 1
    }
    await customer.update(payload)
    return success(res, customer, '修改成功')
  } catch (err) {
    console.error('修改客户失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除客户
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const customer = await Customer.findOne({ where: { customer_id: id } })
    if (!customer) return fail(res, '客户不存在', ErrorCode.RECORD_NOT_FOUND)
    await customer.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除客户失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove }
