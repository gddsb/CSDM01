/**
 * 供应商档案 Service（SupplierController 下沉）
 *
 * 业务：Supplier CRUD + 入参校验 + 种子数据 bulkCreate
 *   - email / phone regex 校验（与 Customer 共用规则但各自内嵌）
 *   - statusMap: '生效'/'启用'→1, '失效'/'停用'→0（比 Customer 多两个别名）
 *   - update 的 parseSupplierStatus：6 种输入形式
 *   - seed：去重 + bulkCreate updateOnDuplicate
 *
 * fs 读 suppliers.json 保留在 Controller（外部数据文件属于 IO 边界）
 */
import { Op } from 'sequelize'
import { Supplier } from '../models/index.js'
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

/** 多态状态解析：支持 '生效'/'启用'/'失效'/'停用'/1/0/'1'/'0' */
export function parseSupplierStatus(v: any): number {
  if (v === '生效' || v === '启用' || v === 1 || v === '1') return 1
  if (v === '失效' || v === '停用' || v === 0 || v === '0') return 0
  return 1 // 默认启用
}

export const SupplierService = {
  async list(query: any) {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 50 } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { supplier_code: { [Op.like]: `%${keyword}%` } },
        { supplier_name: { [Op.like]: `%${keyword}%` } },
        { short_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap: Record<string, number> = { '生效': 1, '启用': 1, '失效': 0, '停用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await Supplier.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['supplier_id', 'DESC']],
    })
  },

  async detail(id: number | string) {
    const supplier = await Supplier.findOne({ where: { supplier_id: Number(id) } })
    if (!supplier) throw new AppError('供应商不存在', 10002, 404)
    return supplier
  },

  async create(body: any, actor?: any) {
    const { supplier_code, supplier_name, email, phone } = body
    if (!supplier_code || !supplier_name) {
      throw new AppError('供应商编码和名称不能为空', 10001, 400)
    }
    validateContact(email, phone)

    const exists = await Supplier.findOne({ where: { supplier_code } })
    if (exists) throw new AppError('供应商编码已存在', 20001, 409)

    return await Supplier.create({
      ...body,
      status: 1,
      created_by: actor?.username || null,
    } as any)
  },

  async update(id: number | string, body: any) {
    const supplier = await Supplier.findOne({ where: { supplier_id: Number(id) } })
    if (!supplier) throw new AppError('供应商不存在', 10002, 404)

    if (body.supplier_code && body.supplier_code !== (supplier as any).supplier_code) {
      const exists = await Supplier.findOne({
        where: { supplier_code: body.supplier_code, supplier_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('供应商编码已存在', 20001, 409)
    }

    validateContact(body.email, body.phone)

    const payload: any = { ...body }
    if (payload.status !== undefined) {
      payload.status = parseSupplierStatus(payload.status)
    }
    await supplier.update(payload)
    return supplier
  },

  async remove(id: number | string) {
    const supplier = await Supplier.findOne({ where: { supplier_id: Number(id) } })
    if (!supplier) throw new AppError('供应商不存在', 10002, 404)
    await supplier.destroy()
    logger.info(`供应商已删除: supplier_id=${id}, supplier_code=${(supplier as any).supplier_code}`)
    return true
  },

  /**
   * 种子数据 bulk upsert
   * @param rawData JSON 解析后的数组（已由 Controller 完成 fs 读取）
   */
  async seed(rawData: any[]): Promise<number> {
    const seen = new Set()
    const uniqueData = rawData.filter(item => {
      if (seen.has(item.supplier_code)) return false
      seen.add(item.supplier_code)
      return true
    })

    const updateOnDuplicate = [
      'supplier_name', 'short_name', 'supplier_category', 'contact_person', 'phone', 'email',
      'address', 'status', 'credit_level', 'tax_id', 'bank_account', 'bank_name', 'remark',
      'sort_order', 'updated_at',
    ]
    const result = await Supplier.bulkCreate(uniqueData, { updateOnDuplicate } as any)
    return result.length
  },
}

export default SupplierService
