import { Op } from 'sequelize'
import { ManpowerRecord, WorkOrder } from '../models/index.js'
import { success, fail } from '../utils/response.js'

const calcHours = (start, end) => {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  const diff = (e - s) / (1000 * 60 * 60)
  return diff > 0 ? Number(diff.toFixed(2)) : 0
}

const buildRecordData = (body) => {
  const {
    record_date,
    shift,
    start_time,
    end_time,
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
  const hours = calcHours(start_time, end_time)
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
    const { report_id, work_order_id, record_date, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (report_id) where.report_id = Number(report_id)
    if (work_order_id) where.work_order_id = Number(work_order_id)
    if (record_date) where.record_date = record_date
    if (dateStart || dateEnd) {
      where.record_date = where.record_date || {}
      if (dateStart) where.record_date[Op.gte] = dateStart
      if (dateEnd) where.record_date[Op.lte] = dateEnd
    }

    const limit = Number(pageSize)
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
    return fail(res, '服务器错误', 500)
  }
}

export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const record = await ManpowerRecord.findOne({ where: { record_id: id } })
    if (!record) return fail(res, '记录不存在', 404)
    return success(res, record)
  } catch (err) {
    console.error('获取人员记录详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const create = async (req, res) => {
  try {
    const { report_id, work_order_id } = req.body
    if (!work_order_id) return fail(res, '工单 ID 不能为空')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    const data = buildRecordData(req.body)
    const record = await ManpowerRecord.create({
      ...data,
      report_id: report_id || null,
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      record_user: req.user?.username || null,
      record_user_name: req.user?.real_name || req.user?.username || null,
    })

    return success(res, record, '创建成功')
  } catch (err) {
    console.error('创建人员记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const record = await ManpowerRecord.findOne({ where: { record_id: id } })
    if (!record) return fail(res, '记录不存在', 404)

    const data = buildRecordData(req.body)
    await record.update(data)
    return success(res, record, '修改成功')
  } catch (err) {
    console.error('修改人员记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const record = await ManpowerRecord.findOne({ where: { record_id: id } })
    if (!record) return fail(res, '记录不存在', 404)

    await record.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除人员记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const summaryByWorkOrder = async (req, res) => {
  try {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const { Op } = await import('sequelize')

    const woWhere = {}
    if (keyword) {
      woWhere[Op.or] = [
        { work_order_no: { [Op.like]: `%${keyword}%` } },
        { order_no: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap = { '开立': 0, '开工': 1, '完工': 2 }
      woWhere.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit

    const { rows: workOrders, count } = await WorkOrder.findAndCountAll({
      where: woWhere,
      limit,
      offset,
      order: [['work_order_no', 'DESC']],
      include: [
        {
          model: ManpowerRecord,
          as: 'manpower_records',
          required: false,
        },
      ],
    })

    const summaryList = workOrders.map(wo => {
      const records = wo.manpower_records || []
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
        work_order_id: wo.work_order_id,
        work_order_no: wo.work_order_no,
        order_no: wo.order_no,
        status: wo.status,
        start_time: wo.start_time,
        finish_time: wo.finish_time,
        labor_hours: wo.labor_hours,
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
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove, summaryByWorkOrder }
