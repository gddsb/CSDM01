import { Op } from 'sequelize'
import { ExceptionRecord, WorkOrder, Order, Device } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 异常记录列表（支持 work_order_id/order_id 筛选）
export const list = async (req, res) => {
  try {
    const { work_order_id, order_id, exception_type, record_user, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (work_order_id) where.work_order_id = Number(work_order_id)
    if (order_id) where.order_id = Number(order_id)
    if (exception_type) where.exception_type = exception_type
    if (record_user) where.record_user = { [Op.like]: `%${record_user}%` }
    if (dateStart || dateEnd) {
      where.start_time = {}
      if (dateStart) where.start_time[Op.gte] = new Date(dateStart)
      if (dateEnd) where.start_time[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ExceptionRecord.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询异常记录列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建异常记录
export const create = async (req, res) => {
  try {
    const {
      work_order_id,
      order_id,
      exception_type,
      exception_type_name,
      device_id,
      start_time,
      end_time,
      duration,
      reason,
      handle_result,
      record_user,
      record_user_name,
    } = req.body

    if (!work_order_id && !order_id) {
      return fail(res, '工单 ID 或订单 ID 至少需要一个')
    }

    let workOrderNo = null
    let lineName = null
    let orderNo = null
    let actualOrderId = order_id || null
    let actualWorkOrderId = work_order_id || null

    if (work_order_id) {
      const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
      if (!workOrder) return fail(res, '工单不存在', 404)
      workOrderNo = workOrder.work_order_no
      lineName = workOrder.line_name
      // 若未传 order_id，沿用工单的订单 ID
      if (!actualOrderId && workOrder.order_id) {
        actualOrderId = workOrder.order_id
        orderNo = workOrder.order_no
      }
    }
    if (actualOrderId && !orderNo) {
      const order = await Order.findOne({ where: { order_id: actualOrderId } })
      if (order) orderNo = order.order_no
    }

    let deviceName = null
    if (device_id) {
      const device = await Device.findOne({ where: { device_id } })
      if (device) deviceName = device.device_name
    }

    // 若未传 duration 但有 start_time/end_time，自动计算时长(小时)
    let actualDuration = duration
    if (actualDuration === undefined && start_time && end_time) {
      const ms = new Date(end_time).getTime() - new Date(start_time).getTime()
      actualDuration = ms > 0 ? Number((ms / 3600000).toFixed(2)) : 0
    }

    const record = await ExceptionRecord.create({
      work_order_id: actualWorkOrderId,
      work_order_no: workOrderNo,
      line_name: lineName,
      order_id: actualOrderId,
      order_no: orderNo,
      exception_type,
      exception_type_name,
      device_id: device_id || null,
      device_name: deviceName,
      start_time: start_time ? new Date(start_time) : null,
      end_time: end_time ? new Date(end_time) : null,
      duration: actualDuration || 0,
      reason,
      handle_result,
      record_user,
      record_user_name,
    })

    return success(res, record, '创建成功')
  } catch (err) {
    console.error('创建异常记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create }
