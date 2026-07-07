import { Op } from 'sequelize'
import { WorkOrder, Order, ProductionLine, Material, ProcessReport, ManpowerRecord, ExceptionRecord } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import { generateWorkOrderNo } from '../utils/sequence.js'

// 工单状态: 0=开立, 1=开工, 2=完工
const statusMap = { '开立': 0, '开工': 1, '完工': 2 }

// 将状态参数（字符串/数字/数组）转换为整数数组
const parseStatusParam = (status) => {
  if (status === undefined || status === '') return null
  const arr = Array.isArray(status) ? status : [status]
  const nums = []
  arr.forEach(s => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach(p => {
        const n = statusMap[p] !== undefined ? statusMap[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = statusMap[s] !== undefined ? statusMap[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

// 工单列表
export const list = async (req, res) => {
  try {
    const { keyword, status, order_id, line_id, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { work_order_no: { [Op.like]: `%${keyword}%` } },
        { order_no: { [Op.like]: `%${keyword}%` } },
        { material_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    const statusNums = parseStatusParam(status)
    if (statusNums) {
      where.status = statusNums.length === 1 ? statusNums[0] : { [Op.in]: statusNums }
    }
    if (order_id) where.order_id = Number(order_id)
    if (line_id) where.line_id = Number(line_id)
    if (dateStart || dateEnd) {
      where.start_time = {}
      if (dateStart) where.start_time[Op.gte] = new Date(dateStart)
      if (dateEnd) where.start_time[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await WorkOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [['work_order_no', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询工单列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 工单详情（含报工、人员、异常记录）
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const workOrder = await WorkOrder.findOne({
      where: { work_order_id: id },
      include: [
        { model: Order, as: 'order' },
        { model: ProcessReport, as: 'process_reports' },
        { model: ManpowerRecord, as: 'manpower_records' },
        { model: ExceptionRecord, as: 'exception_records' },
      ],
    })
    if (!workOrder) return fail(res, '工单不存在', 404)
    return success(res, workOrder, '查询成功')
  } catch (err) {
    console.error('查询工单详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建工单（自动生成工单号 WO+YYYYMMDD+3位序号）
export const create = async (req, res) => {
  try {
    const { order_id, line_id, material_id, planned_qty, plan_start_time, plan_end_time, remarks } = req.body
    if (!order_id) return fail(res, '订单 ID 不能为空')
    if (!line_id) return fail(res, '产线 ID 不能为空')

    const order = await Order.findOne({ where: { order_id } })
    if (!order) return fail(res, '订单不存在', 404)

    const line = await ProductionLine.findOne({ where: { line_id } })
    if (!line) return fail(res, '产线不存在', 404)

    // 工单料品默认沿用订单料品
    const materialId = material_id || order.material_id
    let materialName = order.material_name
    if (material_id && material_id !== order.material_id) {
      const material = await Material.findOne({ where: { material_id } })
      if (!material) return fail(res, '料品不存在', 404)
      materialName = material.material_name
    }

    const work_order_no = await generateWorkOrderNo()
    const qty = planned_qty !== undefined ? planned_qty : order.planned_qty
    const workOrder = await WorkOrder.create({
      work_order_no,
      order_id: order.order_id,
      order_no: order.order_no,
      line_id: line.line_id,
      line_name: line.line_name,
      material_id: materialId,
      material_name: materialName,
      planned_qty: qty,
      target_qty: qty,
      plan_start_time,
      plan_end_time,
      remarks,
      status: 0,
      created_by: req.user?.username || null,
    })
    return success(res, workOrder, '创建成功')
  } catch (err) {
    console.error('创建工单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改工单
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const workOrder = await WorkOrder.findOne({ where: { work_order_id: id } })
    if (!workOrder) return fail(res, '工单不存在', 404)
    if (workOrder.status !== 0) {
      return fail(res, '当前工单状态不允许修改')
    }
    const { line_id, material_id, planned_qty, plan_start_time, plan_end_time, remarks, status } = req.body
    const updateData = {}
    if (planned_qty !== undefined) {
      updateData.planned_qty = planned_qty
      updateData.target_qty = planned_qty
    }
    if (plan_start_time !== undefined) updateData.plan_start_time = plan_start_time
    if (plan_end_time !== undefined) updateData.plan_end_time = plan_end_time
    if (remarks !== undefined) updateData.remarks = remarks
    if (status !== undefined) updateData.status = status
    if (line_id && line_id !== workOrder.line_id) {
      const line = await ProductionLine.findOne({ where: { line_id } })
      if (!line) return fail(res, '产线不存在', 404)
      updateData.line_id = line.line_id
      updateData.line_name = line.line_name
    }
    if (material_id && material_id !== workOrder.material_id) {
      const material = await Material.findOne({ where: { material_id } })
      if (!material) return fail(res, '料品不存在', 404)
      updateData.material_id = material.material_id
      updateData.material_name = material.material_name
    }
    await workOrder.update(updateData)
    return success(res, workOrder, '修改成功')
  } catch (err) {
    console.error('修改工单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除工单
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const workOrder = await WorkOrder.findOne({ where: { work_order_id: id } })
    if (!workOrder) return fail(res, '工单不存在', 404)
    if (workOrder.status !== 0) {
      return fail(res, '当前工单状态不允许删除')
    }
    // 检查是否有报工/人员/异常记录
    const [reportCount, manpowerCount, exceptionCount] = await Promise.all([
      ProcessReport.count({ where: { work_order_id: id } }),
      ManpowerRecord.count({ where: { work_order_id: id } }),
      ExceptionRecord.count({ where: { work_order_id: id } }),
    ])
    if (reportCount + manpowerCount + exceptionCount > 0) {
      return fail(res, `该工单存在关联记录(报工${reportCount}/人员${manpowerCount}/异常${exceptionCount})，无法删除`)
    }
    await workOrder.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除工单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 开工
export const start = async (req, res) => {
  try {
    const { id } = req.params
    const { start_time } = req.body
    const workOrder = await WorkOrder.findOne({ where: { work_order_id: id } })
    if (!workOrder) return fail(res, '工单不存在', 404)
    if (workOrder.status !== 0) return fail(res, '当前工单状态不允许开工')

    const now = new Date()
    let startTime = workOrder.start_time || new Date(start_time || now)
    
    const minTime = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    if (startTime < minTime) return fail(res, '开工时间不可早于当前时间往前推4小时')
    if (startTime > now) return fail(res, '开工时间不可晚于当前时间')

    await workOrder.update({ status: 1, start_time: startTime })

    const lineId = workOrder.line_id
    const lineProcesses = await import('../models/LineProcess.js').then(m => m.default).then(model => 
      model.findAll({ where: { line_id: lineId } })
    )

    const processIds = lineProcesses.map(lp => lp.process_id)
    const processes = await import('../models/Process.js').then(m => m.default).then(model =>
      model.findAll({ where: { process_id: processIds } })
    )

    const ProcessReportModel = await import('../models/ProcessReport.js').then(m => m.default)
    const ManpowerRecordModel = await import('../models/ManpowerRecord.js').then(m => m.default)

    for (const process of processes) {
      await ProcessReportModel.create({
        work_order_id: workOrder.work_order_id,
        work_order_no: workOrder.work_order_no,
        process_id: process.process_id,
        process_name: process.process_name,
        input_qty: 0,
        defect_material: 0,
        defect_process: 0,
        defect_scrap: 0,
        output_qty: 0,
        report_user: req.user?.username || '',
        report_user_name: req.user?.real_name || '',
        report_time: startTime,
      })
    }

    await ManpowerRecordModel.create({
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      process_id: null,
      process_name: '整单',
      emp_id: req.user?.emp_id || '',
      emp_name: req.user?.real_name || '',
      work_date: startTime,
      shift: '白班',
      start_time: startTime,
      end_time: null,
      hours: 0,
      created_by: req.user?.username || '',
    })

    return success(res, workOrder, '工单已开工，报工记录和人员记录已自动生成')
  } catch (err) {
    console.error('开工失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 完工
export const finish = async (req, res) => {
  try {
    const { id } = req.params
    const workOrder = await WorkOrder.findOne({ where: { work_order_id: id } })
    if (!workOrder) return fail(res, '工单不存在', 404)
    if (workOrder.status !== 1) return fail(res, '当前工单状态不允许完工')
    const { total_hours, effective_hours, labor_hours, finished_qty } = req.body
    await workOrder.update({
      status: 2,
      finish_time: workOrder.finish_time || new Date(),
      total_hours,
      effective_hours,
      labor_hours,
      finished_qty: finished_qty !== undefined ? finished_qty : workOrder.finished_qty,
    })
    return success(res, workOrder, '工单已完工')
  } catch (err) {
    console.error('完工失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove, start, finish }
