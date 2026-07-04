import { Op } from 'sequelize'
import { WorkOrder, Order, ProductionLine, Material, ProcessReport, ManpowerRecord, ExceptionRecord } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 工单状态: 0=待开工, 1=已开工, 2=已完工, 3=已关闭

// 生成工单号: WO + YYYYMMDD + 3位序号
async function generateWorkOrderNo() {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}${mm}${dd}`
  const prefix = `WO${dateStr}`
  const count = await WorkOrder.count({
    where: {
      work_order_no: { [Op.like]: `${prefix}%` },
    },
  })
  const seq = String(count + 1).padStart(3, '0')
  return `${prefix}${seq}`
}

// 工单列表
export const list = async (req, res) => {
  try {
    const { keyword, status, order_id, line_id, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { work_order_no: { [Op.like]: `%${keyword}%` } },
        { order_no: { [Op.like]: `%${keyword}%` } },
        { material_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') where.status = Number(status)
    if (order_id) where.order_id = Number(order_id)
    if (line_id) where.line_id = Number(line_id)

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await WorkOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [['work_order_id', 'DESC']],
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
    const { order_id, line_id, material_id, target_qty, start_time, finish_time } = req.body
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
    const workOrder = await WorkOrder.create({
      work_order_no,
      order_id: order.order_id,
      order_no: order.order_no,
      line_id: line.line_id,
      line_name: line.line_name,
      material_id: materialId,
      material_name: materialName,
      target_qty: target_qty || 0,
      start_time,
      finish_time,
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
    const { line_id, material_id, target_qty, start_time, finish_time, status } = req.body
    const updateData = { target_qty, start_time, finish_time, status }
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
    const workOrder = await WorkOrder.findOne({ where: { work_order_id: id } })
    if (!workOrder) return fail(res, '工单不存在', 404)
    if (workOrder.status !== 0) return fail(res, '当前工单状态不允许开工')
    await workOrder.update({ status: 1, start_time: workOrder.start_time || new Date() })
    return success(res, workOrder, '工单已开工')
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

// 关闭
export const close = async (req, res) => {
  try {
    const { id } = req.params
    const workOrder = await WorkOrder.findOne({ where: { work_order_id: id } })
    if (!workOrder) return fail(res, '工单不存在', 404)
    if (workOrder.status !== 2) return fail(res, '当前工单状态不允许关闭')
    await workOrder.update({ status: 3 })
    return success(res, workOrder, '工单已关闭')
  } catch (err) {
    console.error('关闭工单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove, start, finish, close }
