import { Op } from 'sequelize'
import { ProductionLine } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 产线列表
export const list = async (req, res) => {
  try {
    const { keyword, status, workshop, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { line_code: { [Op.like]: `%${keyword}%` } },
        { line_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') where.status = Number(status)
    if (workshop) where.workshop = workshop

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProductionLine.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['line_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询产线列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 产线详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const line = await ProductionLine.findOne({ where: { line_id: id } })
    if (!line) return fail(res, '产线不存在', 404)
    return success(res, line, '查询成功')
  } catch (err) {
    console.error('查询产线详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建产线
export const create = async (req, res) => {
  try {
    const { line_code, line_name } = req.body
    if (!line_code || !line_name) {
      return fail(res, '产线编码和名称不能为空')
    }
    const exists = await ProductionLine.findOne({ where: { line_code } })
    if (exists) return fail(res, '产线编码已存在')
    const line = await ProductionLine.create(req.body)
    return success(res, line, '创建成功')
  } catch (err) {
    console.error('创建产线失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改产线
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const line = await ProductionLine.findOne({ where: { line_id: id } })
    if (!line) return fail(res, '产线不存在', 404)
    if (req.body.line_code && req.body.line_code !== line.line_code) {
      const exists = await ProductionLine.findOne({
        where: { line_code: req.body.line_code, line_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '产线编码已存在')
    }
    await line.update(req.body)
    return success(res, line, '修改成功')
  } catch (err) {
    console.error('修改产线失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除产线
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const line = await ProductionLine.findOne({ where: { line_id: id } })
    if (!line) return fail(res, '产线不存在', 404)
    await line.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除产线失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove }
