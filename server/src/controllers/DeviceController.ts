import { Op } from 'sequelize'
import { Device } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

const ALLOWED_DEVICE_TYPES = new Set(['生产设备', '检测设备', '辅助设备', '其他设备'])

// 设备列表
export const list = async (req, res) => {
  try {
    const { keyword, status, device_type, line_id, is_special, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { device_code: { [Op.like]: `%${keyword}%` } },
        { device_name: { [Op.like]: `%${keyword}%` } },
        { device_model: { [Op.like]: `%${keyword}%` } },
        { serial_no: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (is_special !== undefined && is_special !== '') {
      where.is_special = Number(is_special)
    }
    if (status !== undefined && status !== '') {
      const statusArr = Array.isArray(status) ? status : status.split(',')
      const statusValues = statusArr.map(s => Number(s)).filter(s => !isNaN(s))
      if (statusValues.length === 1) {
        where.status = statusValues[0]
      } else if (statusValues.length > 1) {
        where.status = { [Op.in]: statusValues }
      }
    }
    if (device_type) where.device_type = device_type
    if (line_id) where.line_id = Number(line_id)
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    let order = [['device_type', 'ASC'], ['device_code', 'ASC']]
    if (req.query.sortBy) {
      const allowedSortFields = ['device_code', 'device_name', 'device_type', 'device_model', 'serial_no', 'location', 'status', 'created_at', 'updated_at']
      const fields = req.query.sortBy.split(',').filter(f => allowedSortFields.includes(f))
      if (fields.length > 0) {
        const orders = (req.query.sortOrder || 'asc').split(',')
        order = fields.map((field, idx) => [field, (orders[idx]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC')])
      }
    }
    const { rows, count } = await Device.findAndCountAll({
      where,
      limit,
      offset,
      order,
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询设备列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 设备详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const device = await Device.findOne({ where: { device_id: id } })
    if (!device) return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, device, '查询成功')
  } catch (err) {
    console.error('查询设备详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 创建设备
export const create = async (req, res) => {
  try {
    const { device_code, device_name, device_type, device_model, serial_no, location, line_id, responsible_person, is_special, status, last_inspection_date, inspection_cycle, next_inspection_date, manufacturer, purchase_date, warranty_end } = req.body
    if (!device_code || !device_name) {
      return fail(res, '设备编码和名称不能为空', ErrorCode.PARAM_INVALID)
    }
    if (device_type && !ALLOWED_DEVICE_TYPES.has(device_type)) {
      return fail(res, `设备类型不合法，可选值：${[...ALLOWED_DEVICE_TYPES].join('、')}`, ErrorCode.PARAM_INVALID)
    }
    const exists = await Device.findOne({ where: { device_code } })
    if (exists) return fail(res, '设备编码已存在', ErrorCode.RECORD_EXISTS)
    const device = await Device.create({
      device_code, device_name, device_type, device_model, serial_no, location, line_id, responsible_person, is_special, status, last_inspection_date, inspection_cycle, next_inspection_date, manufacturer, purchase_date, warranty_end,
    })
    return success(res, device, '创建成功')
  } catch (err) {
    console.error('创建设备失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改设备
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const device = await Device.findOne({ where: { device_id: id } })
    if (!device) return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)
    if (req.body.device_code && req.body.device_code !== device.device_code) {
      const exists = await Device.findOne({
        where: { device_code: req.body.device_code, device_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '设备编码已存在')
    }
    const { device_code, device_name, device_type, device_model, serial_no, location, line_id, responsible_person, is_special, status, last_inspection_date, inspection_cycle, next_inspection_date, manufacturer, purchase_date, warranty_end } = req.body
    if (device_type !== undefined && device_type !== null && device_type !== '' && !ALLOWED_DEVICE_TYPES.has(device_type)) {
      return fail(res, `设备类型不合法，可选值：${[...ALLOWED_DEVICE_TYPES].join('、')}`, ErrorCode.PARAM_INVALID)
    }
    await device.update({
      device_code, device_name, device_type, device_model, serial_no, location, line_id, responsible_person, is_special, status, last_inspection_date, inspection_cycle, next_inspection_date, manufacturer, purchase_date, warranty_end,
    })
    return success(res, device, '修改成功')
  } catch (err) {
    console.error('修改设备失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除设备
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const device = await Device.findOne({ where: { device_id: id } })
    if (!device) return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)
    await device.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除设备失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove }
