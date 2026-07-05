import { Op } from 'sequelize'
import { Process } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 工序列表
export const list = async (req, res) => {
  try {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 50 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { process_code: { [Op.like]: `%${keyword}%` } },
        { process_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') where.status = Number(status)
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Process.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['process_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询工序列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 工序详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const process = await Process.findOne({ where: { process_id: id } })
    if (!process) return fail(res, '工序不存在', 404)
    return success(res, process, '查询成功')
  } catch (err) {
    console.error('查询工序详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建工序
export const create = async (req, res) => {
  try {
    const { process_code, process_name } = req.body
    if (!process_code || !process_name) {
      return fail(res, '工序编码和名称不能为空')
    }
    const exists = await Process.findOne({ where: { process_code } })
    if (exists) return fail(res, '工序编码已存在')
    const process = await Process.create(req.body)
    return success(res, process, '创建成功')
  } catch (err) {
    console.error('创建工序失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改工序
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const process = await Process.findOne({ where: { process_id: id } })
    if (!process) return fail(res, '工序不存在', 404)
    if (req.body.process_code && req.body.process_code !== process.process_code) {
      const exists = await Process.findOne({
        where: { process_code: req.body.process_code, process_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '工序编码已存在')
    }
    await process.update(req.body)
    return success(res, process, '修改成功')
  } catch (err) {
    console.error('修改工序失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除工序
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const process = await Process.findOne({ where: { process_id: id } })
    if (!process) return fail(res, '工序不存在', 404)
    await process.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除工序失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove }
