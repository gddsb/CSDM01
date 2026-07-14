import { Op } from 'sequelize'
import { ProcessReport, WorkOrder, Process, Device } from '../models/index.js'
import { success, fail } from '../utils/response.js'

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

// 报工列表（支持 work_order_id 筛选）
export const list = async (req, res) => {
  try {
    const { keyword, work_order_id, process_id, report_user, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
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
      include: [{ model: WorkOrder, as: 'work_order', attributes: ['work_order_id', 'status'] }],
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

// 修改报工记录（仅报工单处于"开立"或"开工"状态时可修改）
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工记录不存在', 404)

    if (report.status === '完工') {
      return fail(res, '报工单已完工，不可修改')
    }

    const {
      input_qty,
      defect_material,
      defect_process,
      defect_scrap,
      output_qty,
      device_id,
      report_user,
      report_user_name,
      report_time,
    } = req.body

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
      input_qty: input_qty !== undefined ? input_qty : report.input_qty,
      defect_material: defect_material !== undefined ? defect_material : report.defect_material,
      defect_process: defect_process !== undefined ? defect_process : report.defect_process,
      defect_scrap: defect_scrap !== undefined ? defect_scrap : report.defect_scrap,
      output_qty: output_qty !== undefined ? output_qty : report.output_qty,
      device_id: device_id !== undefined ? device_id : report.device_id,
      device_name: deviceName,
      report_user: report_user !== undefined ? report_user : report.report_user,
      report_user_name: report_user_name !== undefined ? report_user_name : report.report_user_name,
      report_time: report_time ? new Date(report_time) : report.report_time,
    })

    await syncWorkOrderSummary(report.work_order_id)

    return success(res, report, '修改成功')
  } catch (err) {
    console.error('修改报工记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建报工记录（状态默认为"开立"）
export const create = async (req, res) => {
  try {
    const {
      work_order_id,
      process_id,
      input_qty,
      defect_material,
      defect_process,
      defect_scrap,
      output_qty,
      device_id,
      report_user,
      report_user_name,
      report_time,
    } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    // 工单必须处于"已开工"状态才允许创建报工记录
    if (workOrder.status !== '已开工') {
      return fail(res, '工单未开工，不允许创建报工记录')
    }

    const process = await Process.findOne({ where: { process_id } })
    if (!process) return fail(res, '工序不存在', 404)

    let deviceName = null
    if (device_id) {
      const device = await Device.findOne({ where: { device_id } })
      if (device) deviceName = device.device_name
    }

    const report = await ProcessReport.create({
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      process_id: process.process_id,
      process_name: process.process_name,
      input_qty: input_qty || 0,
      defect_material: defect_material || 0,
      defect_process: defect_process || 0,
      defect_scrap: defect_scrap || 0,
      output_qty: output_qty || 0,
      device_id: device_id || null,
      device_name: deviceName,
      report_user,
      report_user_name,
      report_time: report_time ? new Date(report_time) : new Date(),
      status: 0,
    })

    await syncWorkOrderSummary(work_order_id)

    return success(res, report, '创建成功')
  } catch (err) {
    console.error('创建报工记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 报工单开工（开立 → 开工）
export const start = async (req, res) => {
  try {
    const { id } = req.params
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工记录不存在', 404)

    if (report.status !== '开立') {
      return fail(res, '当前报工单状态不允许开工')
    }

    // 校验关联工单必须处于"已开工"状态
    const workOrder = await WorkOrder.findOne({ where: { work_order_id: report.work_order_id } })
    if (!workOrder) return fail(res, '关联工单不存在', 404)
    if (workOrder.status !== '已开工') {
      return fail(res, '关联工单未开工，报工单无法开工')
    }

    await report.update({ status: 1, report_time: new Date() })

    return success(res, report, '报工单已开工')
  } catch (err) {
    console.error('报工单开工失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 报工单完工（开工 → 完工）
export const finish = async (req, res) => {
  try {
    const { id } = req.params
    const report = await ProcessReport.findOne({ where: { report_id: id } })
    if (!report) return fail(res, '报工记录不存在', 404)

    if (report.status !== '开工') {
      return fail(res, '当前报工单状态不允许完工')
    }

    await report.update({ status: 2 })

    await syncWorkOrderSummary(report.work_order_id)

    return success(res, report, '报工单已完工')
  } catch (err) {
    console.error('报工单完工失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create, update, start, finish }
