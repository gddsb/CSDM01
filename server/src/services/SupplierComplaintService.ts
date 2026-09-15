/**
 * 供应商投诉 Service（SupplierComplaintController 下沉）
 *
 * 业务：QualitySupplierComplaint + IncomingInspection 关联
 * 状态：待处理(0) → 处理中(1) → 已回复(2) → 已关闭(3)
 */
import { Op } from 'sequelize'
import { QualitySupplierComplaint, Supplier, IncomingInspection } from '../models/index.js'
import { generateSupplierComplaintNo } from '../utils/sequence.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

export function parseSuppComplaintStatusParam(status: any): number[] | null {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  for (const s of arr) {
    const parts = typeof s === 'string' && s.includes(',') ? s.split(',') : [s]
    for (const p of parts) {
      const n = Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

export function buildSuppComplaintWhere(query: any): any {
  const where: any = {}
  const { complaint_no, supplier_name, supplier_id, status, start_date, end_date } = query
  if (complaint_no) where.complaint_no = { [Op.like]: `%${complaint_no}%` }
  if (supplier_name) where.supplier_name = { [Op.like]: `%${supplier_name}%` }
  if (supplier_id) where.supplier_id = supplier_id
  const statusArr = parseSuppComplaintStatusParam(status)
  if (statusArr) where.status = statusArr.length === 1 ? statusArr[0] : { [Op.in]: statusArr }
  if (start_date || end_date) {
    where.complaint_date = {}
    if (start_date) where.complaint_date[Op.gte] = new Date(String(start_date))
    if (end_date) where.complaint_date[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
  }
  return where
}

async function getSuppComplaintDetail(id: number) {
  return await QualitySupplierComplaint.findOne({
    where: { complaint_id: id },
    include: [
      { model: Supplier, as: 'supplier', required: false },
      { model: IncomingInspection, as: 'incoming_inspection', required: false },
    ],
  })
}

export const SupplierComplaintService = {
  async list(query: any) {
    const where = buildSuppComplaintWhere(query)
    const limit = Math.min(Number(query.pageSize) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit
    return await QualitySupplierComplaint.findAndCountAll({ where, limit, offset, order: [['complaint_date', 'DESC']] })
  },

  async detail(id: number | string) {
    const record = await getSuppComplaintDetail(Number(id))
    if (!record) throw new AppError('供应商投诉不存在', 10002, 404)
    return record
  },

  async create(body: any, actor?: any) {
    if (!body.supplier_id) throw new AppError('供应商不能为空', 10001, 400)
    if (!body.complaint_content && !body.complaint_desc) throw new AppError('投诉内容不能为空', 10001, 400)

    const supplier = await Supplier.findOne({ where: { supplier_id: body.supplier_id } })
    if (!supplier) throw new AppError('供应商不存在', 10002, 404)

    const complaint_no = await generateSupplierComplaintNo()
    return await QualitySupplierComplaint.create({
      complaint_no,
      supplier_id: body.supplier_id,
      supplier_code: (supplier as any).supplier_code,
      supplier_name: (supplier as any).supplier_name,
      contact_person: body.contact_person || (supplier as any).contact_person,
      contact_phone: body.contact_phone || (supplier as any).contact_phone,
      incoming_inspection_id: body.incoming_inspection_id || null,
      batch_no: body.batch_no || '',
      complaint_type: body.complaint_type || '',
      complaint_content: body.complaint_content || body.complaint_desc,
      complaint_date: body.complaint_date ? new Date(body.complaint_date) : new Date(),
      complaint_result: body.complaint_result || '',
      handle_suggestion: body.handle_suggestion || '',
      status: 0, // 待处理
      reporter_id: actor?.userId || null,
      reporter_name: actor?.username || actor?.realName || '',
    } as any)
  },

  async update(id: number | string, body: any) {
    const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!record) throw new AppError('供应商投诉不存在', 10002, 404)
    await record.update(body as any)
    return record
  },

  /** 下发（状态 0→1 处理中） */
  async issue(id: number | string, body: any, actor?: any) {
    const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!record) throw new AppError('供应商投诉不存在', 10002, 404)
    if ((record as any).status !== 0) throw new AppError('当前状态不可下发', 20001, 409)
    await record.update({
      status: 1,
      handler_id: body.handler_id || actor?.userId || null,
      handler_name: body.handler_name || actor?.username || '',
      issue_time: new Date(),
    } as any)
    return record
  },

  /** 回复供应商（状态 1→2 已回复） */
  async reply(id: number | string, body: any, actor?: any) {
    const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!record) throw new AppError('供应商投诉不存在', 10002, 404)
    if ((record as any).status !== 1) throw new AppError('当前状态不可回复', 20001, 409)
    if (!body.reply_content) throw new AppError('回复内容不能为空', 10001, 400)

    await record.update({
      status: 2,
      reply_content: body.reply_content,
      reply_time: new Date(),
      reply_user_id: actor?.userId || null,
      reply_user_name: actor?.username || actor?.realName || '',
    } as any)
    return record
  },

  /** 关闭（状态 →3 已关闭） */
  async close(id: number | string, body: any, actor?: any) {
    const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!record) throw new AppError('供应商投诉不存在', 10002, 404)
    if ((record as any).status >= 3) throw new AppError('已关闭的投诉不可重复关闭', 20001, 409)

    await record.update({
      status: 3,
      close_time: new Date(),
      close_reason: body.close_reason || '',
      close_user_id: actor?.userId || null,
      close_user_name: actor?.username || actor?.realName || '',
    } as any)
    return record
  },

  async delete(id: number | string) {
    const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!record) throw new AppError('供应商投诉不存在', 10002, 404)
    if ((record as any).status !== 0) throw new AppError('待处理状态的投诉才能删除', 20001, 409)
    await record.destroy()
    return true
  },
}

export default SupplierComplaintService
