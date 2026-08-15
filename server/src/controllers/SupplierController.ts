import { Op } from 'sequelize'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Supplier } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const PHONE_REGEX = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const list = async (req, res) => {
  try {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 50 } = req.query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { supplier_code: { [Op.like]: `%${keyword}%` } },
        { supplier_name: { [Op.like]: `%${keyword}%` } },
        { short_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap = { '生效': 1, '启用': 1, '失效': 0, '停用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Supplier.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['supplier_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询供应商档案列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const supplier = await Supplier.findOne({ where: { supplier_id: id } })
    if (!supplier) return fail(res, '供应商不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, supplier, '查询成功')
  } catch (err) {
    console.error('查询供应商详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const create = async (req, res) => {
  try {
    const { supplier_code, supplier_name, short_name, supplier_category, contact_person, phone, email, address, credit_level, tax_id, bank_account, bank_name, remark, sort_order } = req.body
    if (!supplier_code || !supplier_name) {
      return fail(res, '供应商编码和名称不能为空', ErrorCode.PARAM_INVALID)
    }

    if (email !== undefined && email !== '' && !EMAIL_REGEX.test(email)) {
      return fail(res, '邮箱格式不正确', ErrorCode.PARAM_INVALID)
    }
    if (phone !== undefined && phone !== '' && !PHONE_REGEX.test(phone)) {
      return fail(res, '联系电话格式不正确', ErrorCode.PARAM_INVALID)
    }

    const exists = await Supplier.findOne({ where: { supplier_code } })
    if (exists) return fail(res, '供应商编码已存在', ErrorCode.RECORD_EXISTS)
    const supplier = await Supplier.create({
      supplier_code, supplier_name, short_name, supplier_category, contact_person, phone, email, address, credit_level, tax_id, bank_account, bank_name, remark, sort_order,
      status: 1,
      created_by: req.user?.username || null,
    })
    return success(res, supplier, '创建成功')
  } catch (err) {
    console.error('创建供应商失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const supplier = await Supplier.findOne({ where: { supplier_id: id } })
    if (!supplier) return fail(res, '供应商不存在', ErrorCode.RECORD_NOT_FOUND)
    if (req.body.supplier_code && req.body.supplier_code !== supplier.supplier_code) {
      const exists = await Supplier.findOne({
        where: { supplier_code: req.body.supplier_code, supplier_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '供应商编码已存在')
    }
    const { supplier_code, supplier_name, short_name, supplier_category, contact_person, phone, email, address, status, credit_level, tax_id, bank_account, bank_name, remark, sort_order } = req.body

    if (email !== undefined && email !== '' && !EMAIL_REGEX.test(email)) {
      return fail(res, '邮箱格式不正确', ErrorCode.PARAM_INVALID)
    }
    if (phone !== undefined && phone !== '' && !PHONE_REGEX.test(phone)) {
      return fail(res, '联系电话格式不正确', ErrorCode.PARAM_INVALID)
    }

    const payload: any = {
      supplier_code, supplier_name, short_name, supplier_category, contact_person, phone, email, address, credit_level, tax_id, bank_account, bank_name, remark, sort_order,
    }
    if (status !== undefined) {
      payload.status = (status === '生效' || status === '启用' || status === 1 || status === '1') ? 1 : (status === '失效' || status === '停用' || status === 0 || status === '0') ? 0 : 1
    }
    await supplier.update(payload)
    return success(res, supplier, '修改成功')
  } catch (err) {
    console.error('修改供应商失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const supplier = await Supplier.findOne({ where: { supplier_id: id } })
    if (!supplier) return fail(res, '供应商不存在', ErrorCode.RECORD_NOT_FOUND)
    await supplier.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除供应商失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const seed = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', 'seeders', 'suppliers.json')
    if (!fs.existsSync(filePath)) {
      return fail(res, '种子数据文件不存在', ErrorCode.RECORD_NOT_FOUND)
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)

    const seen = new Set()
    const uniqueData = data.filter(item => {
      if (seen.has(item.supplier_code)) return false
      seen.add(item.supplier_code)
      return true
    })

    const result = await Supplier.bulkCreate(uniqueData, {
      updateOnDuplicate: ['supplier_name', 'short_name', 'supplier_category', 'contact_person', 'phone', 'email', 'address', 'status', 'credit_level', 'tax_id', 'bank_account', 'bank_name', 'remark', 'sort_order', 'updated_at'],
    })
    return success(res, { count: result.length }, `种子数据导入成功（${result.length}条）`)
  } catch (err) {
    console.error('导入供应商种子数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove, seed }
