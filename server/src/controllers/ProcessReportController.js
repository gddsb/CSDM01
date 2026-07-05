import { Op } from 'sequelize'
import { ProcessReport, WorkOrder, Process, Device } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 报工列表（支持 work_order_id 筛选）
export const list = async (req, res) => {
  try {
    const { work_order_id, process_id, report_user, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
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

// 创建报工记录
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
    })

    // 同步工单完工数量
    const allReports = await ProcessReport.findAll({
      where: { work_order_id },
      attributes: ['output_qty'],
    })
    const totalFinished = allReports.reduce((sum, r) => sum + Number(r.output_qty || 0), 0)
    await workOrder.update({ finished_qty: totalFinished })

    return success(res, report, '创建成功')
  } catch (err) {
    console.error('创建报工记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create }
