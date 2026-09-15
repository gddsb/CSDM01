/**
 * 客户档案 Service（CustomerController 下沉）
 *
 * 业务：Customer CRUD + 入参校验
 *   - email / phone 正则校验
 *   - list 的 statusMap（'启用'→1, '停用'→0）
 *   - create 默认 status=1, created_by=actor.username
 *   - update 支持 status 多态解析（'启用'/'停用'/1/0/'1'/'0'）
 */
import { Op } from 'sequelize'
import { Customer } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const PHONE_REGEX = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/

function validateContact(email?: string, phone?: string) {
  if (email !== undefined && email !== '' && !EMAIL_REGEX.test(email)) {
    throw new AppError('邮箱格式不正确', 10001, 400)
  }
  if (phone !== undefined && phone !== '' && !PHONE_REGEX.test(phone)) {
    throw new AppError('联系电话格式不正确', 10001, 400)
  }
}

/** 多态状态解析：支持 '启用'/'停用'/1/0/'1'/'0' */
export function parseCustomerStatus(v: any): number {
  if (v === '启用' || v === 1 || v === '1') return 1
  if (v === '停用' || v === 0 || v === '0') return 0
  return 1 // 默认启用
}

export const CustomerService = {
  async list(query: any) {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 50 } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { customer_code: { [Op.like]: `%${keyword}%` } },
        { customer_name: { [Op.like]: `%${keyword}%` } },
        { short_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap: Record<string, number> = { '启用': 1, '停用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await Customer.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['customer_id', 'DESC']],
    })
  },

  async detail(id: number | string) {
    const customer = await Customer.findOne({ where: { customer_id: Number(id) } })
    if (!customer) throw new AppError('客户不存在', 10002, 404)
    return customer
  },

  async create(body: any, actor?: any) {
    const { customer_code, customer_name, email, phone } = body
    if (!customer_code || !customer_name) {
      throw new AppError('客户编号和名称不能为空', 10001, 400)
    }
    validateContact(email, phone)

    const exists = await Customer.findOne({ where: { customer_code } })
    if (exists) throw new AppError('客户编号已存在', 20001, 409)

    return await Customer.create({
      ...body,
      status: 1,
      created_by: actor?.username || null,
    } as any)
  },

  async update(id: number | string, body: any) {
    const customer = await Customer.findOne({ where: { customer_id: Number(id) } })
    if (!customer) throw new AppError('客户不存在', 10002, 404)

    if (body.customer_code && body.customer_code !== (customer as any).customer_code) {
      const exists = await Customer.findOne({
        where: { customer_code: body.customer_code, customer_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('客户编号已存在', 20001, 409)
    }

    validateContact(body.email, body.phone)

    const payload: any = { ...body }
    if (payload.status !== undefined) {
      payload.status = parseCustomerStatus(payload.status)
    }
    await customer.update(payload)
    return customer
  },

  async remove(id: number | string) {
    const customer = await Customer.findOne({ where: { customer_id: Number(id) } })
    if (!customer) throw new AppError('客户不存在', 10002, 404)
    await customer.destroy()
    logger.info(`客户已删除: customer_id=${id}, customer_code=${(customer as any).customer_code}`)
    return true
  },
}

export default CustomerService
