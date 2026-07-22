import { Op } from 'sequelize'
import { ManpowerRecord, ReportOrder } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

const calcHours = (start, end) => {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  const diff = (e - s) / (1000 * 60 * 60)
  return diff > 0 ? Number(diff.toFixed(2)) : 0
}

// 根据报工单时间计算人员工时的开始/结束/小时数
// 开始时间 = 报工单 report_time
// 结束时间 = 完工状态(status=1)取 finish_time；开工状态(status=0)取当前时间（已投入工时实时计算）
const resolveTimeFromReportOrder = (reportOrder) => {
  if (!reportOrder) return { start_time: null, end_time: null, hours: 0 }
  const start_time = reportOrder.report_time || null
  let end_time = null
  // status: 0=开工, 1=完工（数字或字符串均支持）
  const statusVal = reportOrder.status
  const isFinished = Number(statusVal) === 1 || statusVal === '完工'
  if (isFinished && reportOrder.finish_time) {
    end_time = reportOrder.finish_time
  } else {
    // 开工状态：用当前时间作为结束时间，计算"已投入工时"
    end_time = new Date()
  }
  const hours = calcHours(start_time, end_time)
  return { start_time, end_time, hours }
}

const buildRecordData = async (body, existingRecord = null) => {
  const {
    report_order_id,
    record_date,
    shift,
    skilled_count,
    general_count,
    labor_count,
    other_count,
    remarks,
  } = body

  const sk = Number(skilled_count) || 0
  const gn = Number(general_count) || 0
  const lb = Number(labor_count) || 0
  const ot = Number(other_count) || 0
  const total_people = sk + gn + lb + ot

  // 优先使用 body.report_order_id，否则回退到 existingRecord 关联的报工单
  const roId = report_order_id || existingRecord?.report_order_id
  let timeInfo = { start_time: existingRecord?.start_time || null, end_time: existingRecord?.end_time || null, hours: existingRecord?.hours || 0 }
  if (roId) {
    const reportOrder = await ReportOrder.findOne({ where: { report_order_id: roId } })
    timeInfo = resolveTimeFromReportOrder(reportOrder)
  }

  const { start_time, end_time, hours } = timeInfo
  const man_hours = Number((hours * total_people).toFixed(2))

  return {
    record_date,
    shift,
    start_time,
    end_time,
    hours,
    skilled_count: sk,
    general_count: gn,
    labor_count: lb,
    other_count: ot,
    total_people,
    man_hours,
    remarks,
  }
}

export const list = async (req, res) => {
  try {
    const { report_order_id, record_date, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
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
    const { rows, count } = await ManpowerRecord.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_date', 'DESC'], ['record_id', 'DESC']],
    })

    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询人员记录列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const record = await ManpowerRecord.findOne({ where: { record_id: id } })
    if (!record) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, record)
  } catch (err) {
    console.error('获取人员记录详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const create = async (req, res) => {
  try {
    const { report_order_id } = req.body
    if (!report_order_id) return fail(res, '报工单 ID 不能为空')

    const reportOrder = await ReportOrder.findOne({ where: { report_order_id } })
    if (!reportOrder) return fail(res, '报工单不存在', ErrorCode.RECORD_NOT_FOUND)

    // 每个报工单仅允许一条人员工时记录（开工时自动创建），禁止重复创建
    const existing = await ManpowerRecord.findOne({ where: { report_order_id } })
    if (existing) {
      return fail(res, '该报工单已存在人员工时记录，请直接修改')
    }

    const data = await buildRecordData(req.body)
    const record = await ManpowerRecord.create({
      ...data,
      report_order_id: reportOrder.report_order_id,
      record_user: req.user?.username || null,
      record_user_name: req.user?.real_name || req.user?.username || null,
    })

    return success(res, record, '创建成功')
  } catch (err) {
    console.error('创建人员记录失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const record = await ManpowerRecord.findOne({ where: { record_id: id } })
    if (!record) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)

    const data = await buildRecordData(req.body, record)
    await record.update(data)
    return success(res, record, '修改成功')
  } catch (err) {
    console.error('修改人员记录失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const record = await ManpowerRecord.findOne({ where: { record_id: id } })
    if (!record) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)

    await record.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除人员记录失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 按报工单汇总人员记录
export const summaryByReportOrder = async (req, res) => {
  try {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query

    const roWhere: any = {}
    if (keyword) {
      roWhere[Op.or] = [
        { report_no: { [Op.like]: `%${keyword}%` } },
        { order_no: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap = { '开工': 0, '完工': 1 }
      const statusArr = String(status).split(',').map(s => statusMap[s] !== undefined ? statusMap[s] : Number(s)).filter(s => !isNaN(s))
      if (statusArr.length === 1) roWhere.status = statusArr[0]
      else if (statusArr.length > 1) roWhere.status = { [Op.in]: statusArr }
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit

    const { rows: reportOrders, count } = await ReportOrder.findAndCountAll({
      where: roWhere,
      limit,
      offset,
      order: [['report_no', 'DESC']],
      include: [
        {
          model: ManpowerRecord,
          as: 'manpower_records',
          required: false,
        },
      ],
    })

    const summaryList = reportOrders.map(ro => {
      const records = ro.manpower_records || []
      const total_man_hours = records.reduce((sum, r) => sum + Number(r.man_hours || 0), 0)
      const total_hours = records.reduce((sum, r) => sum + Number(r.hours || 0), 0)
      const avg_hours = records.length > 0
        ? Number((total_hours / records.length).toFixed(2))
        : 0
      const maxSkilled = records.length > 0
        ? Math.max(...records.map(r => Number(r.skilled_count || 0)))
        : 0
      const maxGeneral = records.length > 0
        ? Math.max(...records.map(r => Number(r.general_count || 0)))
        : 0
      const maxLabor = records.length > 0
        ? Math.max(...records.map(r => Number(r.labor_count || 0)))
        : 0
      const maxOther = records.length > 0
        ? Math.max(...records.map(r => Number(r.other_count || 0)))
        : 0
      const maxTotal = records.length > 0
        ? Math.max(...records.map(r => Number(r.total_people || 0)))
        : 0

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

    return success(res, summaryList, '查询成功', count)
  } catch (err) {
    console.error('查询人员记录汇总失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove, summaryByReportOrder }
