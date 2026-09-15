/**
 * 工序异常工时 Service（ProcessExceptionController 下沉）
 *
 * 业务规则：
 * - 换型换线同一报工单只能有一条（防止重复）
 * - 时间范围校验：end >= start，持续不超过 24 小时
 * - 自动算 duration（小时）
 * - 冗余 device_code / device_name
 */
import { Op } from 'sequelize'
import { ProcessException, Device } from '../models/index.js'
import { parseDateTime, nowBeijingDate } from '../utils/date.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

// ---------- 纯函数 ----------

export interface TimeRangeResult { valid: boolean; message?: string; duration?: number }

/** 时间范围校验（纯函数） */
export function validateTimeRange(start: any, end: any): TimeRangeResult {
  if (!start) return { valid: true }
  const s = parseDateTime(start) || new Date(start)
  if (isNaN(s.getTime())) return { valid: false, message: '开始时间格式不正确' }
  if (!end) return { valid: true }
  const e = parseDateTime(end) || new Date(end)
  if (isNaN(e.getTime())) return { valid: false, message: '结束时间格式不正确' }
  if (e < s) return { valid: false, message: '结束时间不能早于开始时间' }
  const dur = (e.getTime() - s.getTime()) / 3600000
  if (dur > 24) return { valid: false, message: '异常工时持续时长不能超过24小时' }
  return { valid: true, duration: Number(dur.toFixed(2)) }
}

/** 构建列表 where（纯函数） */
export function buildExceptionWhere(query: any): any {
  const where: any = {}
  const { report_order_id, exception_type, device_id, start_date, end_date } = query
  if (report_order_id) where.report_order_id = report_order_id
  if (exception_type) where.exception_type = exception_type
  if (device_id) where.device_id = device_id
  if (start_date || end_date) {
    where.start_time = {}
    if (start_date) where.start_time[Op.gte] = parseDateTime(start_date) || new Date(start_date)
    if (end_date) where.start_time[Op.lte] = parseDateTime(end_date) || new Date(end_date)
  }
  return where
}

// ---------- Service ----------

export const ProcessExceptionService = {
  /** 异常工时列表 */
  async list(query: any) {
    const where = buildExceptionWhere(query)
    const limit = Math.min(Number(query.page_size) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit

    return await ProcessException.findAndCountAll({
      where,
      limit,
      offset,
      order: [['start_time', 'DESC']],
    })
  },

  /** 创建异常工时 */
  async create(body: any, actor?: any) {
    if (!body.report_order_id) throw new AppError('报工单 ID 不能为空', 10001, 400)
    if (!body.exception_type) throw new AppError('异常类型不能为空', 10001, 400)
    if (!body.start_time) throw new AppError('开始时间不能为空', 10001, 400)

    // 换型换线不允许重复
    if (body.exception_type === '换型换线') {
      const existing = await ProcessException.count({
        where: { report_order_id: body.report_order_id, exception_type: '换型换线' },
      })
      if (existing > 0) {
        throw new AppError('该报工单已存在换型换线记录，不允许重复创建', 20001, 409)
      }
    }

    const timeCheck = validateTimeRange(body.start_time, body.end_time)
    if (!timeCheck.valid) throw new AppError(timeCheck.message || '时间校验失败', 10001, 400)

    let deviceCode: string | null = null
    let deviceName: string | null = null
    if (body.device_id) {
      const device = await Device.findOne({ where: { device_id: body.device_id } })
      if (device) {
        deviceCode = (device as any).device_code
        deviceName = (device as any).device_name
      }
    }

    const duration = timeCheck.duration !== undefined ? timeCheck.duration : 0
    const imagesJson = body.exception_images
      ? (Array.isArray(body.exception_images) ? JSON.stringify(body.exception_images) : body.exception_images)
      : null
    const safeStartTime = parseDateTime(body.start_time) || nowBeijingDate()
    const safeEndTime = body.end_time ? (parseDateTime(body.end_time) || null) : null

    return await ProcessException.create({
      report_order_id: body.report_order_id,
      exception_type: body.exception_type,
      device_id: body.device_id || null,
      device_code: deviceCode,
      device_name: deviceName,
      stop_type: body.stop_type,
      confirm_user: body.confirm_user,
      confirm_user_name: body.confirm_user_name,
      start_time: safeStartTime,
      end_time: safeEndTime,
      duration,
      description: body.description,
      exception_images: imagesJson,
      record_user: actor?.username || body.record_user || null,
      record_user_name: actor?.realName || actor?.username || body.record_user_name || null,
    } as any)
  },

  /** 修改异常工时（自动重算 duration） */
  async update(id: number | string, body: any, actor?: any) {
    const record = await ProcessException.findOne({ where: { exception_id: Number(id) } })
    if (!record) throw new AppError('异常工时记录不存在', 10002, 404)

    const start = body.start_time !== undefined ? body.start_time : (record as any).start_time
    const end = body.end_time !== undefined ? body.end_time : (record as any).end_time
    const timeCheck = validateTimeRange(start, end)
    if (!timeCheck.valid) throw new AppError(timeCheck.message || '时间校验失败', 10001, 400)

    const updateData: any = {}
    if (body.exception_type !== undefined) updateData.exception_type = body.exception_type
    if (body.device_id !== undefined) {
      updateData.device_id = body.device_id
      const device = await Device.findOne({ where: { device_id: body.device_id } })
      if (device) {
        updateData.device_code = (device as any).device_code
        updateData.device_name = (device as any).device_name
      }
    }
    if (body.stop_type !== undefined) updateData.stop_type = body.stop_type
    if (body.start_time !== undefined) updateData.start_time = parseDateTime(body.start_time)
    if (body.end_time !== undefined) updateData.end_time = body.end_time ? (parseDateTime(body.end_time) || null) : null
    updateData.duration = timeCheck.duration !== undefined ? timeCheck.duration : (record as any).duration
    if (body.description !== undefined) updateData.description = body.description
    if (body.exception_images !== undefined) {
      updateData.exception_images = body.exception_images
        ? (Array.isArray(body.exception_images) ? JSON.stringify(body.exception_images) : body.exception_images)
        : null
    }

    await record.update(updateData)
    return record
  },

  /** 删除异常工时 */
  async remove(id: number | string) {
    const record = await ProcessException.findOne({ where: { exception_id: Number(id) } })
    if (!record) throw new AppError('异常工时记录不存在', 10002, 404)
    await record.destroy()
    return true
  },
}

export default ProcessExceptionService
