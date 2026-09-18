/**
 * 人员工时记录 Service（ManpowerRecordController 下沉）
 *
 * 核心业务：
 *   - calcHours / resolveTimeFromReportOrder — 按报工单状态推导工时起止
 *   - buildRecordData — 组装 ManpowerRecord 数据（total_people / man_hours）
 *   - summaryByReportOrder — 按报工单聚合人员记录（total_man_hours / max 各工种人数）
 *
 * create / remove 为系统自动创建，手动禁止，Service 层抛 AppError
 */
import { Op } from 'sequelize'
import { ManpowerRecord, ReportOrder } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { nowBeijingDate, parseDateTime } from '../utils/date.js'

export const calcHours = (start: any, end: any): number => {
  if (!start || !end) return 0
  const s = parseDateTime(start) || new Date(start)
  const e = parseDateTime(end) || new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  const diff = (e.getTime() - s.getTime()) / (1000 * 60 * 60)
  return diff > 0 ? Number(diff.toFixed(2)) : 0
}

export const resolveTimeFromReportOrder = (reportOrder: any) => {
  if (!reportOrder) return { start_time: null, end_time: null, hours: 0 }
  const start_time = reportOrder.report_time || null
  const statusVal = reportOrder.status
  const isFinished = Number(statusVal) === 1 || statusVal === '完工'
  const end_time = (isFinished && reportOrder.finish_time)
    ? reportOrder.finish_time
    : nowBeijingDate()
  const hours = calcHours(start_time, end_time)
  return { start_time, end_time, hours }
}

export const ManpowerRecordService = {
  async list(query: any) {
    const { report_order_id, record_date, dateStart, dateEnd, page = 1, pageSize = 20 } = query
    const where: any = {}
    if (report_order_id) where.report_order_id = Number(report_order_id)
    if (record_date) where.record_date = record_date
    if (dateStart || dateEnd) {
      where.record_date = where.record_date || {}
      if (dateStart) where.record_date[Op.gte] = dateStart
      if (dateEnd) where.record_date[Op.lte] = dateEnd
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await ManpowerRecord.findAndCountAll({
      where, limit, offset,
      order: [['record_date', 'DESC'], ['record_id', 'DESC']],
    })
  },

  async detail(id: number | string) {
    const record = await ManpowerRecord.findOne({ where: { record_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)
    return record
  },

  async create() {
    throw new AppError('人员工时记录由系统自动创建，不允许手动新增', 30001, 403)
  },

  /** 组装 ManpowerRecord 数据（按 body + 可选 existingRecord + 关联 ReportOrder 时间） */
  async buildRecordData(body: any, existingRecord: any = null) {
    const { report_order_id, record_date, shift, skilled_count, general_count, labor_count, other_count, remarks } = body
    const sk = Number(skilled_count) || 0
    const gn = Number(general_count) || 0
    const lb = Number(labor_count) || 0
    const ot = Number(other_count) || 0
    const total_people = sk + gn + lb + ot

    const roId = report_order_id || existingRecord?.report_order_id
    let timeInfo = { start_time: existingRecord?.start_time || null, end_time: existingRecord?.end_time || null, hours: existingRecord?.hours || 0 }
    if (roId) {
      const reportOrder = await ReportOrder.findOne({ where: { report_order_id: roId } })
      timeInfo = resolveTimeFromReportOrder(reportOrder)
    }
    const { start_time, end_time, hours } = timeInfo
    const man_hours = Number((hours * total_people).toFixed(2))

    return { record_date, shift, start_time, end_time, hours, skilled_count: sk, general_count: gn, labor_count: lb, other_count: ot, total_people, man_hours, remarks }
  },

  async update(id: number | string, body: any) {
    const record = await ManpowerRecord.findOne({ where: { record_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)
    const data = await this.buildRecordData(body, record)
    await record.update(data)
    return record
  },

  async remove() {
    throw new AppError('人员工时记录由系统自动创建，不允许删除', 30001, 403)
  },

  /** 按报工单汇总人员记录 */
  async summaryByReportOrder(query: any) {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 20 } = query
    const roWhere: any = {}
    if (keyword) {
      roWhere[Op.or] = [
        { report_no: { [Op.like]: `%${keyword}%` } },
        { order_no: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap: Record<string, number> = { '开工': 0, '完工': 1 }
      const statusArr = String(status).split(',').map(s => statusMap[s] !== undefined ? statusMap[s] : Number(s)).filter((s: any) => !isNaN(s))
      if (statusArr.length === 1) roWhere.status = statusArr[0]
      else if (statusArr.length > 1) roWhere.status = { [Op.in]: statusArr }
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows: reportOrders, count } = await ReportOrder.findAndCountAll({
      where: roWhere, limit, offset,
      order: [['report_no', 'DESC']],
      include: [{ model: ManpowerRecord, as: 'manpower_records', required: false }],
    })

    const summaryList = reportOrders.map((ro: any) => {
      const records = ro.manpower_records || []
      const total_man_hours = records.reduce((sum: number, r: any) => sum + Number(r.man_hours || 0), 0)
      const total_hours = records.reduce((sum: number, r: any) => sum + Number(r.hours || 0), 0)
      const avg_hours = records.length > 0 ? Number((total_hours / records.length).toFixed(2)) : 0
      const maxSkilled = records.length > 0 ? Math.max(...records.map((r: any) => Number(r.skilled_count || 0))) : 0
      const maxGeneral = records.length > 0 ? Math.max(...records.map((r: any) => Number(r.general_count || 0))) : 0
      const maxLabor = records.length > 0 ? Math.max(...records.map((r: any) => Number(r.labor_count || 0))) : 0
      const maxOther = records.length > 0 ? Math.max(...records.map((r: any) => Number(r.other_count || 0))) : 0
      const maxTotal = records.length > 0 ? Math.max(...records.map((r: any) => Number(r.total_people || 0))) : 0
      return {
        report_order_id: ro.report_order_id,
        report_no: ro.report_no,
        order_no: ro.order_no,
        status: ro.status,
        report_time: ro.report_time,
        finish_time: ro.finish_time,
        total_man_hours: Number(total_man_hours.toFixed(2)),
        total_hours: Number(total_hours.toFixed(2)),
        avg_hours,
        skilled_count: maxSkilled,
        general_count: maxGeneral,
        labor_count: maxLabor,
        other_count: maxOther,
        total_people: maxTotal,
        record_count: records.length,
      }
    })

    return { rows: summaryList, count }
  },
}

export default ManpowerRecordService
