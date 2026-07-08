import { Op } from 'sequelize'
import { ProcessException, WorkOrder, Device } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export const list = async (req, res) => {
  try {
    const { work_order_id, exception_type, device_id, stop_type, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (work_order_id) where.work_order_id = Number(work_order_id)
    if (exception_type) where.exception_type = exception_type
    if (device_id) where.device_id = Number(device_id)
    if (stop_type) where.stop_type = { [Op.like]: `%${stop_type}%` }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessException.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询异常工时列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const create = async (req, res) => {
  try {
    const {
      work_order_id,
      exception_type,
      device_id,
      stop_type,
      confirm_user,
      confirm_user_name,
      start_time,
      end_time,
      description,
      record_user,
      record_user_name,
    } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!exception_type) return fail(res, '异常类型不能为空')
    if (!start_time) return fail(res, '开始时间不能为空')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    let deviceCode = null
    let deviceName = null
    if (device_id) {
      const device = await Device.findOne({ where: { device_id } })
      if (device) {
        deviceCode = device.device_code
        deviceName = device.device_name
      }
    }

    let duration = 0
    if (start_time && end_time) {
      const start = new Date(start_time)
      const end = new Date(end_time)
      duration = Number(((end - start) / 3600000).toFixed(2))
    }

    const exception = await ProcessException.create({
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      exception_type,
      device_id: device_id || null,
      device_code: deviceCode,
      device_name: deviceName,
      stop_type,
      confirm_user,
      confirm_user_name,
      start_time: new Date(start_time),
      end_time: end_time ? new Date(end_time) : null,
      duration,
      description,
      record_user,
      record_user_name,
    })

    return success(res, exception, '创建成功')
  } catch (err) {
    console.error('创建异常工时记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const exception = await ProcessException.findOne({ where: { exception_id: id } })
    if (!exception) return fail(res, '记录不存在', 404)
    await exception.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除异常工时记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create, remove }