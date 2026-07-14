import { Op } from 'sequelize'
import { ProcessReport, WorkOrder, Process, Device } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import { generateProcessReportNo } from '../utils/sequence.js'

const syncWorkOrderSummary = async (workOrderId) => {
  const reports = await ProcessReport.findAll({
    where: { work_order_id: workOrderId },
    attributes: ['input_qty', 'output_qty', 'defect_material', 'defect_process', 'defect_scrap'],
  })
  const summary = reports.reduce((acc, r) => {
    acc.start_qty += Number(r.input_qty || 0)
    acc.qualified_qty += Number(r.output_qty || 0)
    acc.defect_material += Number(r.defect_material || 0)
    acc.defect_process += Number(r.defect_process || 0)
    acc.defect_scrap += Number(r.defect_scrap || 0)
    return acc
  }, { start_qty: 0, qualified_qty: 0, defect_material: 0, defect_process: 0, defect_scrap: 0 })
  await WorkOrder.update(
    {
      start_qty: summary.start_qty,
      qualified_qty: summary.qualified_qty,
      finished_qty: summary.qualified_qty,
      defect_material: summary.defect_material,
      defect_process: summary.defect_process,
      defect_scrap: summary.defect_scrap,
    },
    { where: { work_order_id: workOrderId } }
  )
}

export const list = async (req, res) => {
  try {
    const { keyword, work_order_id, process_id, report_user, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { report_no: { [Op.like]: `%${keyword}%` } },
        { work_order_no: { [Op.like]: `%${keyword}%` } },
        { process_name: { [Op.like]: `%${keyword}%` } },
        { report_user_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (work_order_id) where.work_order_id = Number(work_order_id)
    if (process_id) where.process_id = Number(process_id)
    if (report_user) where.report_user = { [Op.like]: `%${report_user}%` }
    if (dateStart || dateEnd) {
      where.report_time = {}
      if (dateStart) where.report_time[Op.gte] = new Date(dateStart)
      if (dateEnd) where.report_time[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessReport.findAndCountAll({
      where,
      limit,
      offset,
      order: [['report_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询报工列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工单不存在', 404)
    return success(res, report, '查询成功')
  } catch (err) {
    console.error('查询报工单详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const create = async (req, res) => {
  try {
    const {
      work_order_id,
      process_id,
      report_date,
      shift,
      team,
      report_user,
      report_user_name,
    } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    if (workOrder.status !== '开工') {
      return fail(res, '工单未开工，不允许创建报工单')
    }

    const targetDate = report_date ? new Date(report_date) : new Date()
    const dateStr = targetDate.toISOString().split('T')[0]

    const todayReports = await ProcessReport.findAll({
      where: {
        work_order_id,
        report_date: dateStr,
      },
    })
    if (todayReports.length > 0) {
      return fail(res, '该工单今天已创建报工单，一个工单每天只能创建一个报工单')
    }

    const lastReport = await ProcessReport.findOne({
      where: { work_order_id },
      order: [['report_id', 'DESC']],
    })
    if (lastReport && lastReport.status === '开始报工') {
      return fail(res, '上一条报工单尚未结束报工，请先结束报工后再新增')
    }

    const reportNo = await generateProcessReportNo()

    const reportCount = await ProcessReport.count({
      where: { work_order_id }
    })

    const report = await ProcessReport.create({
      report_no: reportNo,
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      line_id: workOrder.line_id,
      line_name: workOrder.line_name,
      material_id: workOrder.material_id,
      material_code: workOrder.material_code,
      material_name: workOrder.material_name,
      specification: workOrder.specification,
      unit: workOrder.unit,
      planned_qty: workOrder.planned_qty,
      process_id: process_id || null,
      process_name: null,
      report_count: reportCount + 1,
      report_date: dateStr,
      shift: shift || null,
      team: team || null,
      report_user: report_user || req.user?.username || '',
      report_user_name: report_user_name || req.user?.real_name || '',
      report_time: new Date(),
      report_start_time: new Date(),
      status: 0,
    })

    return success(res, report, '创建成功')
  } catch (err) {
    console.error('创建报工单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工单不存在', 404)

    if (report.status === '结束报工') {
      return fail(res, '报工单已结束报工，不可修改')
    }

    const {
      process_id,
      report_date,
      shift,
      team,
      input_qty,
      defect_material,
      defect_process,
      defect_scrap,
      output_qty,
      device_id,
      report_user,
      report_user_name,
    } = req.body

    let processName = report.process_name
    if (process_id !== undefined) {
      if (process_id) {
        const process = await Process.findOne({ where: { process_id } })
        if (process) processName = process.process_name
      } else {
        processName = null
      }
    }

    let deviceName = report.device_name
    if (device_id !== undefined) {
      if (device_id) {
        const device = await Device.findOne({ where: { device_id } })
        if (device) deviceName = device.device_name
      } else {
        deviceName = null
      }
    }

    await report.update({
      process_id: process_id !== undefined ? process_id : report.process_id,
      process_name: processName,
      report_date: report_date !== undefined ? report_date : report.report_date,
      shift: shift !== undefined ? shift : report.shift,
      team: team !== undefined ? team : report.team,
      input_qty: input_qty !== undefined ? input_qty : report.input_qty,
      defect_material: defect_material !== undefined ? defect_material : report.defect_material,
      defect_process: defect_process !== undefined ? defect_process : report.defect_process,
      defect_scrap: defect_scrap !== undefined ? defect_scrap : report.defect_scrap,
      output_qty: output_qty !== undefined ? output_qty : report.output_qty,
      device_id: device_id !== undefined ? device_id : report.device_id,
      device_name: deviceName,
      report_user: report_user !== undefined ? report_user : report.report_user,
      report_user_name: report_user_name !== undefined ? report_user_name : report.report_user_name,
    })

    await syncWorkOrderSummary(report.work_order_id)

    return success(res, report, '修改成功')
  } catch (err) {
    console.error('修改报工单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { action } = req.body
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工单不存在', 404)

    const workOrder = await WorkOrder.findOne({ where: { work_order_id: report.work_order_id } })
    if (!workOrder) return fail(res, '关联工单不存在', 404)
    if (workOrder.status !== '开工') {
      return fail(res, '关联工单未开工，无法切换报工状态')
    }

    if (action === 'end') {
      if (report.status !== '开始报工') {
        return fail(res, '当前状态不允许结束报工')
      }
      await report.update({ status: 1, report_end_time: new Date() })
      await syncWorkOrderSummary(report.work_order_id)
      return success(res, report, '已结束报工')
    } else if (action === 'start') {
      if (report.status !== '结束报工') {
        return fail(res, '当前状态不允许开始报工')
      }
      await report.update({ status: 0 })
      return success(res, report, '已开始报工')
    }

    return fail(res, '无效的操作')
  } catch (err) {
    console.error('切换报工状态失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const start = async (req, res) => {
  try {
    const { id } = req.params
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工单不存在', 404)

    if (report.status !== '开始报工') {
      return fail(res, '当前状态不允许开工')
    }

    const workOrder = await WorkOrder.findOne({ where: { work_order_id: report.work_order_id } })
    if (!workOrder) return fail(res, '关联工单不存在', 404)
    if (workOrder.status !== '开工') {
      return fail(res, '关联工单未开工，报工单无法开工')
    }

    await report.update({ report_time: new Date(), report_start_time: new Date() })

    return success(res, report, '报工单已开工')
  } catch (err) {
    console.error('报工单开工失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const finish = async (req, res) => {
  try {
    const { id } = req.params
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工单不存在', 404)

    if (report.status !== '结束报工') {
      return fail(res, '当前状态不允许完工')
    }

    await report.update({ report_end_time: new Date() })

    await syncWorkOrderSummary(report.work_order_id)

    return success(res, report, '报工单已完工')
  } catch (err) {
    console.error('报工单完工失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工单不存在', 404)

    if (report.status === '结束报工') {
      return fail(res, '已结束报工的报工单不可删除')
    }

    const workOrderId = report.work_order_id
    await report.destroy()
    await syncWorkOrderSummary(workOrderId)

    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除报工单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, toggleStatus, start, finish, remove }
