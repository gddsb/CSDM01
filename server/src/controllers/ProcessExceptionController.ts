import { Op } from 'sequelize'
import { ProcessException, Device } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

function validateTimeRange(start, end): { valid: boolean; message?: string; duration?: number } {
  if (!start) return { valid: true }
  const s = new Date(start)
  if (isNaN(s.getTime())) return { valid: false, message: '开始时间格式不正确' }
  if (!end) return { valid: true }
  const e = new Date(end)
  if (isNaN(e.getTime())) return { valid: false, message: '结束时间格式不正确' }
  if (e < s) return { valid: false, message: '结束时间不能早于开始时间' }
  const dur = (e.getTime() - s.getTime()) / 3600000
  if (dur > 24) return { valid: false, message: '异常工时持续时长不能超过24小时' }
  return { valid: true, duration: Number(dur.toFixed(2)) }
}

export const list = async (req, res) => {
  try {
    const { report_order_id, exception_type, device_id, stop_type, page = 1, pageSize = 20 } = req.query
    const where: any = {}
    if (report_order_id) where.report_order_id = Number(report_order_id)
    if (exception_type) where.exception_type = exception_type
    if (device_id) where.device_id = Number(device_id)
    if (stop_type) where.stop_type = { [Op.like]: `%${stop_type}%` }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessException.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    })
    const data = rows.map(r => ({
      ...r.toJSON(),
      exception_images: r.exception_images ? JSON.parse(r.exception_images) : [],
    }))
    return success(res, data, '查询成功', count)
  } catch (err) {
    console.error('查询异常工时列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const create = async (req, res) => {
  try {
    const {
      report_order_id,
      exception_type,
      device_id,
      stop_type,
      confirm_user,
      confirm_user_name,
      start_time,
      end_time,
      description,
      exception_images,
      record_user,
      record_user_name,
    } = req.body

    if (!report_order_id) return fail(res, '报工单 ID 不能为空', ErrorCode.PARAM_INVALID)
    if (!exception_type) return fail(res, '异常类型不能为空', ErrorCode.PARAM_INVALID)
    if (!start_time) return fail(res, '开始时间不能为空', ErrorCode.PARAM_INVALID)

    const timeCheck = validateTimeRange(start_time, end_time)
    if (!timeCheck.valid) {
      return fail(res, timeCheck.message!, ErrorCode.PARAM_INVALID)
    }

    let deviceCode = null
    let deviceName = null
    if (device_id) {
      const device = await Device.findOne({ where: { device_id } })
      if (device) {
        deviceCode = device.device_code
        deviceName = device.device_name
      }
    }

    const duration = timeCheck.duration !== undefined ? timeCheck.duration : 0

    const imagesJson = exception_images
      ? (Array.isArray(exception_images) ? JSON.stringify(exception_images) : exception_images)
      : null

    const exception = await ProcessException.create({
      report_order_id,
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
      exception_images: imagesJson,
      record_user,
      record_user_name,
    })

    return success(res, exception, '创建成功')
  } catch (err) {
    console.error('创建异常工时记录失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const exception = await ProcessException.findOne({ where: { exception_id: id } })
    if (!exception) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)

    const {
      exception_type,
      device_id,
      stop_type,
      confirm_user,
      confirm_user_name,
      start_time,
      end_time,
      description,
      exception_images,
      record_user,
      record_user_name,
    } = req.body

    let deviceCode = exception.device_code
    let deviceName = exception.device_name
    if (device_id !== undefined) {
      if (device_id) {
        const device = await Device.findOne({ where: { device_id } })
        if (device) {
          deviceCode = device.device_code
          deviceName = device.device_name
        }
      } else {
        deviceCode = null
        deviceName = null
      }
    }

    const st = start_time !== undefined ? start_time : exception.start_time
    const et = end_time !== undefined ? end_time : exception.end_time
    const timeCheck = validateTimeRange(st, et)
    if (!timeCheck.valid) {
      return fail(res, timeCheck.message!, ErrorCode.PARAM_INVALID)
    }
    const duration = timeCheck.duration !== undefined ? timeCheck.duration : exception.duration

    let imagesJson = exception.exception_images
    if (exception_images !== undefined) {
      imagesJson = Array.isArray(exception_images) ? JSON.stringify(exception_images) : exception_images
    }

    await exception.update({
      exception_type: exception_type !== undefined ? exception_type : exception.exception_type,
      device_id: device_id !== undefined ? (device_id || null) : exception.device_id,
      device_code: deviceCode,
      device_name: deviceName,
      stop_type: stop_type !== undefined ? stop_type : exception.stop_type,
      confirm_user: confirm_user !== undefined ? confirm_user : exception.confirm_user,
      confirm_user_name: confirm_user_name !== undefined ? confirm_user_name : exception.confirm_user_name,
      start_time: start_time ? new Date(start_time) : exception.start_time,
      end_time: end_time !== undefined ? (end_time ? new Date(end_time) : null) : exception.end_time,
      duration,
      description: description !== undefined ? description : exception.description,
      exception_images: imagesJson,
      record_user: record_user !== undefined ? record_user : exception.record_user,
      record_user_name: record_user_name !== undefined ? record_user_name : exception.record_user_name,
    })

    return success(res, exception, '修改成功')
  } catch (err) {
    console.error('修改异常工时记录失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const exception = await ProcessException.findOne({ where: { exception_id: id } })
    if (!exception) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
    await exception.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除异常工时记录失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, create, update, remove }
