import { Op } from 'sequelize'
import { Device } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 设备列表
export const list = async (req, res) => {
  try {
    const { keyword, status, device_type, line_id, dateStart, dateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { device_code: { [Op.like]: `%${keyword}%` } },
        { device_name: { [Op.like]: `%${keyword}%` } },
        { device_model: { [Op.like]: `%${keyword}%` } },
        { serial_no: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') where.status = Number(status)
    if (device_type) where.device_type = device_type
    if (line_id) where.line_id = Number(line_id)
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Device.findAndCountAll({
      where,
      limit,
      offset,
      order: [['device_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询设备列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 设备详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const device = await Device.findOne({ where: { device_id: id } })
    if (!device) return fail(res, '设备不存在', 404)
    return success(res, device, '查询成功')
  } catch (err) {
    console.error('查询设备详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建设备
export const create = async (req, res) => {
  try {
    const { device_code, device_name } = req.body
    if (!device_code || !device_name) {
      return fail(res, '设备编码和名称不能为空')
    }
    const exists = await Device.findOne({ where: { device_code } })
    if (exists) return fail(res, '设备编码已存在')
    const device = await Device.create(req.body)
    return success(res, device, '创建成功')
  } catch (err) {
    console.error('创建设备失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改设备
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const device = await Device.findOne({ where: { device_id: id } })
    if (!device) return fail(res, '设备不存在', 404)
    if (req.body.device_code && req.body.device_code !== device.device_code) {
      const exists = await Device.findOne({
        where: { device_code: req.body.device_code, device_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '设备编码已存在')
    }
    await device.update(req.body)
    return success(res, device, '修改成功')
  } catch (err) {
    console.error('修改设备失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除设备
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const device = await Device.findOne({ where: { device_id: id } })
    if (!device) return fail(res, '设备不存在', 404)
    await device.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除设备失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove }
