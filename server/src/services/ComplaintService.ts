/**
 * 客诉管理 Service（ComplaintController 下沉）
 *
 * 业务：QualityComplaint + QualityComplaintRecord（跟进记录）
 * 状态：处理中(0) → 已关闭(1)
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import { QualityComplaint, QualityComplaintRecord, Customer, Material } from '../models/index.js'
import { generateComplaintNo } from '../utils/sequence.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

const STATUS_REVERSE: Record<string, number> = { '处理中': 0, '已关闭': 1 }

export function parseComplaintStatusParam(status: any): number[] | null {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  for (const s of arr) {
    const parts = typeof s === 'string' && s.includes(',') ? s.split(',') : [s]
    for (const p of parts) {
      const n = STATUS_REVERSE[p as string] !== undefined
        ? STATUS_REVERSE[p as string]
        : Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

export function buildComplaintWhere(query: any): any {
  const where: any = {}
  const { complaint_no, customer_id, customer_name, status, start_date, end_date } = query
  if (complaint_no) where.complaint_no = { [Op.like]: `%${complaint_no}%` }
  if (customer_id) where.customer_id = customer_id
  if (customer_name) where.customer_name = { [Op.like]: `%${customer_name}%` }
  const statusArr = parseComplaintStatusParam(status)
  if (statusArr) where.status = statusArr.length === 1 ? statusArr[0] : { [Op.in]: statusArr }
  if (start_date || end_date) {
    where.complaint_time = {}
    if (start_date) where.complaint_time[Op.gte] = new Date(String(start_date))
    if (end_date) where.complaint_time[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
  }
  return where
}

async function getComplaintDetail(id: number) {
  return await QualityComplaint.findOne({
    where: { complaint_id: id },
    include: [
      { model: QualityComplaintRecord, as: 'records', required: false, separate: true, order: [['record_id', 'ASC']] },
      { model: Customer, as: 'customer', required: false },
      { model: Material, as: 'material', required: false },
    ],
  })
}

export const ComplaintService = {
  async list(query: any) {
    const where = buildComplaintWhere(query)
    const limit = Math.min(Number(query.page_size) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit
    return await QualityComplaint.findAndCountAll({ where, limit, offset, order: [['complaint_time', 'DESC']] })
  },

  async detail(id: number | string) {
    const record = await getComplaintDetail(Number(id))
    if (!record) throw new AppError('客诉记录不存在', 10002, 404)
    return record
  },

  async create(body: any, actor?: any) {
    if (!body.complaint_desc) throw new AppError('投诉描述不能为空', 10001, 400)

    const complaint_no = await generateComplaintNo()
    const t = await sequelize.transaction()
    try {
      const record = await QualityComplaint.create({
        complaint_no,
        customer_id: body.customer_id || null,
        source: body.source || '',
        customer_name: body.customer_name || '',
        contact_person: body.contact_person || '',
        contact_phone: body.contact_phone || '',
        material_id: body.material_id || null,
        material_name: body.material_name || '',
        batch_no: body.batch_no || '',
        complaint_type: body.complaint_type || '',
        complaint_desc: body.complaint_desc,
        complaint_method: body.complaint_method || '',
        complaint_time: body.complaint_time ? new Date(body.complaint_time) : new Date(),
        require_reply: body.require_reply || false,
        reply_deadline: body.reply_deadline ? new Date(body.reply_deadline) : null,
        handle_direction: body.handle_direction || '',
        handler_id: body.handler_id || null,
        handler_name: body.handler_name || '',
        remarks: body.remarks || '',
        status: 0, // 处理中
        reporter_id: actor?.userId || null,
        reporter_name: actor?.username || '',
      } as any, { transaction: t })

      // 自动写第一条跟进记录（确认受理）
      await QualityComplaintRecord.create({
        complaint_id: (record as any).complaint_id,
        stage: '受理',
        action: '创建',
        content: body.complaint_desc,
        operator_id: actor?.userId || null,
        operator_name: actor?.username || actor?.realName || '',
      } as any, { transaction: t })

      await t.commit()
      return await getComplaintDetail(Number((record as any).complaint_id))
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  async update(id: number | string, body: any) {
    const record = await QualityComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!record) throw new AppError('客诉记录不存在', 10002, 404)
    await record.update(body as any)
    return record
  },

  /** 添加跟进记录 */
  async addRecord(id: number | string, body: any, actor?: any) {
    const complaint = await QualityComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!complaint) throw new AppError('客诉记录不存在', 10002, 404)

    const rec = await QualityComplaintRecord.create({
      complaint_id: Number(id),
      stage: body.stage || '处理',
      action: body.action || '跟进',
      content: body.content || '',
      operator_id: actor?.userId || null,
      operator_name: actor?.username || actor?.realName || '',
    } as any)

    // 关闭状态的跟进记录：自动把主表状态改回处理中
    if ((complaint as any).status === 1) {
      await complaint.update({ status: 0, close_time: null } as any)
    }

    return rec
  },

  /** 关闭客诉 */
  async close(id: number | string, body: any, actor?: any) {
    const complaint = await QualityComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!complaint) throw new AppError('客诉记录不存在', 10002, 404)

    const t = await sequelize.transaction()
    try {
      await complaint.update({ status: 1, close_time: new Date(), close_reason: body.close_reason || body.reason || '' } as any, { transaction: t })
      await QualityComplaintRecord.create({
        complaint_id: Number(id),
        stage: '结案',
        action: '关闭',
        content: body.close_reason || body.reason || '',
        operator_id: actor?.userId || null,
        operator_name: actor?.username || actor?.realName || '',
      } as any, { transaction: t })
      await t.commit()
      return true
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  async delete(id: number | string) {
    const complaint = await QualityComplaint.findOne({ where: { complaint_id: Number(id) } })
    if (!complaint) throw new AppError('客诉记录不存在', 10002, 404)

    if ((complaint as any).status !== 0) throw new AppError('处理中的客诉才能删除', 20001, 409)

    await QualityComplaintRecord.destroy({ where: { complaint_id: Number(id) } })
    await complaint.destroy()
    return true
  },

  // ---------- uploadAttachment DB 操作 ----------

  /** 查客诉记录用于附件上传（返回 complaint_no / complaint_time 等文件命名字段） */
  async findForUpload(complaintId: number) {
    const record = await QualityComplaint.findOne({ where: { complaint_id: complaintId } })
    if (!record) throw new AppError('客诉记录不存在', 10002, 404)
    return record
  },
}

export default ComplaintService
