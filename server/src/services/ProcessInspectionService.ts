/**
 * 过程检验业务 Service
 *
 * 简化版业务流（移动端优先）：
 *   选在制品 → 填过程参数 → 判定 → 提交（一步完成，跳过审核）
 *
 * 状态机：0=待检, 1=检验中, 2=已完成, 3=已关闭
 *   - 创建时默认 0=待检
 *   - submit 时一次性写入参数 + 结果 + 检验人 + 检验时间，状态 → 2=已完成
 *
 * 移动端列表（在制品）：
 *   拉取 status='开工' 的 ReportOrder 列表作为在制品源
 */
import { Op } from 'sequelize'
import {
  ProcessInspection,
  ReportOrder,
  Order,
} from '../models/index.js'
import { generateProcessInspectionNo } from '../utils/sequence.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { nowBeijingDate } from '../utils/date.js'

export const PROCESS_STATUS_REVERSE: Record<string, number> = {
  '待检': 0, '检验中': 1, '已完成': 2, '已关闭': 3,
}

// ---------- 纯函数 ----------

export function parseProcessStatusParam(status: any): number[] | null {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  for (const s of arr) {
    const parts = typeof s === 'string' && s.includes(',') ? s.split(',') : [s]
    for (const p of parts) {
      const n = PROCESS_STATUS_REVERSE[p as string] !== undefined
        ? PROCESS_STATUS_REVERSE[p as string]
        : Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

export function buildProcessWhere(query: any): any {
  const where: any = {}
  const { inspection_no, work_order_no, process_name, product_name, result, status, start_date, end_date } = query

  if (inspection_no) where.inspection_no = { [Op.like]: `%${inspection_no}%` }
  if (work_order_no) where.work_order_no = { [Op.like]: `%${work_order_no}%` }
  if (process_name) where.process_name = { [Op.like]: `%${process_name}%` }
  if (product_name) where.product_name = { [Op.like]: `%${product_name}%` }
  if (result) where.result = result

  const statusArr = parseProcessStatusParam(status)
  if (statusArr) where.status = { [Op.in]: statusArr }

  if (start_date || end_date) {
    where.created_at = {}
    if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
    if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
  }

  return where
}

/**
 * 查询在制品列表（移动端选在制品来源）
 * 取 status='开工' 的 ReportOrder（即未完工的报工单）
 */
export async function listWip(query: any) {
  const pageNum = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.page_size) || 30))
  const where: any = { status: 0 } // 0=开工（ReportOrder 状态：0=开工, 1=完工）

  if (query.keyword) {
    const kw = String(query.keyword).trim()
    where[Op.or] = [
      { report_no: { [Op.like]: `%${kw}%` } },
      { order_no: { [Op.like]: `%${kw}%` } },
      { material_name: { [Op.like]: `%${kw}%` } },
      { material_code: { [Op.like]: `%${kw}%` } },
    ]
  }

  const { count, rows } = await ReportOrder.findAndCountAll({
    where,
    limit: pageSize,
    offset: (pageNum - 1) * pageSize,
    order: [['report_order_id', 'DESC']],
    raw: true,
  })

  return {
    list: rows.map((r: any) => ({
      report_order_id: r.report_order_id,
      work_order_no: r.report_no || r.order_no || '',
      process_name: r.line_name || '',
      product_name: r.material_name || '',
      material_code: r.material_code || '',
      quantity: Number(r.report_qty) || 0,
    })),
    total: count,
    page: pageNum,
    page_size: pageSize,
  }
}

// ---------- Service ----------

export const ProcessInspectionService = {
  /** 在制品列表（移动端） */
  async listWip(query: any) {
    return listWip(query)
  },

  /** 过程检验列表 */
  async list(query: any) {
    const where = buildProcessWhere(query)
    const pageNum = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.page_size) || 20))

    const { count, rows } = await ProcessInspection.findAndCountAll({
      where,
      order: [['inspection_id', 'DESC']],
      limit: pageSize,
      offset: (pageNum - 1) * pageSize,
    })

    return { list: rows, total: count, page: pageNum, page_size: pageSize }
  },

  /** 详情 */
  async detail(id: number | string) {
    const record = await ProcessInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('过程检验记录不存在', 10002, 404)
    return record
  },

  /** 创建过程检验（待检态，由后端自动生成编号） */
  async create(body: any) {
    const inspection_no = await generateProcessInspectionNo()
    return await ProcessInspection.create({
      inspection_no,
      report_order_id: body.report_order_id || null,
      work_order_no: body.work_order_no || '',
      process_name: body.process_name || '',
      product_name: body.product_name || '',
      material_code: body.material_code || '',
      quantity: body.quantity || 0,
      temperature: body.temperature || null,
      humidity: body.humidity || null,
      ph: body.ph || null,
      params_extra: body.params_extra || null,
      result: body.result || null,
      handle_type: body.handle_type || '',
      handle_reason: body.handle_reason || '',
      status: 0,
      inspector_id: body.inspector_id || null,
      inspector_name: body.inspector_name || '',
      inspection_time: body.inspection_time || null,
      remarks: body.remarks || null,
    } as any)
  },

  /** 一步提交（移动端：填参数 + 判定 + 提交，状态 → 已完成） */
  async submit(body: any, actor?: any) {
    if (!body.report_order_id && !body.work_order_no) {
      throw new AppError('在制品（报工单）不能为空', 10001, 400)
    }
    if (!body.result) {
      throw new AppError('检验结果不能为空', 10001, 400)
    }

    // 拉取报工单冗余字段
    let wip: any = null
    if (body.report_order_id) {
      wip = await ReportOrder.findOne({ where: { report_order_id: body.report_order_id }, raw: true })
    }
    if (!wip && body.work_order_no) {
      wip = await ReportOrder.findOne({
        where: { [Op.or]: [{ report_no: body.work_order_no }, { order_no: body.work_order_no }] },
        raw: true,
      })
    }

    const inspection_no = await generateProcessInspectionNo()
    const actorName = actor?.realName || actor?.username || body.inspector_name || ''
    const actorId = actor?.userId || body.inspector_id || null

    const record = await ProcessInspection.create({
      inspection_no,
      report_order_id: wip?.report_order_id || body.report_order_id || null,
      work_order_no: wip?.report_no || wip?.order_no || body.work_order_no || '',
      process_name: body.process_name || wip?.line_name || '',
      product_name: body.product_name || wip?.material_name || '',
      material_code: body.material_code || wip?.material_code || '',
      quantity: body.quantity || (wip?.report_qty ? Number(wip.report_qty) : 0),
      temperature: body.temperature || null,
      humidity: body.humidity || null,
      ph: body.ph || null,
      params_extra: body.params_extra || null,
      result: body.result,
      handle_type: body.handle_type || '',
      handle_reason: body.handle_reason || '',
      status: 2, // 直接完成
      inspector_id: actorId,
      inspector_name: actorName,
      inspection_time: nowBeijingDate(),
      remarks: body.remarks || null,
    } as any)

    return record
  },

  /** 修改（仅待检/检验中可改） */
  async update(id: number | string, body: any) {
    const record = await ProcessInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('过程检验记录不存在', 10002, 404)

    const cur = (record as any).getDataValue
      ? (record as any).dataValues?.status ?? (record as any).status
      : (record as any).status
    if (cur === 2 || cur === '已完成' || cur === 3 || cur === '已关闭') {
      throw new AppError('已完成的记录不可修改', 10001, 400)
    }

    const updateData: any = {}
    for (const k of [
      'temperature', 'humidity', 'ph', 'params_extra', 'result',
      'handle_type', 'handle_reason', 'remarks', 'process_name', 'product_name',
      'material_code', 'quantity',
    ]) {
      if (body[k] !== undefined) updateData[k] = body[k]
    }
    if (Object.keys(updateData).length > 0) await record.update(updateData)
    return record
  },

  /** 删除 */
  async remove(id: number | string) {
    const record = await ProcessInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('过程检验记录不存在', 10002, 404)
    await record.destroy()
    return true
  },
}

export default ProcessInspectionService
