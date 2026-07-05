import { Op } from 'sequelize'
import { OperationLog } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 日志列表（分页 + 筛选）
export const list = async (req, res) => {
  try {
    const { username, module, method, status, startDate, endDate, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (username) where.username = { [Op.like]: `%${username}%` }
    if (module) where.module = { [Op.like]: `%${module}%` }
    if (method) where.method = method
    if (status !== undefined && status !== '') where.status = Number(status)
    if (startDate || endDate || dateStart || dateEnd) {
      where.created_at = {}
      if (startDate || dateStart) where.created_at[Op.gte] = new Date(startDate || dateStart)
      if (endDate || dateEnd) where.created_at[Op.lte] = new Date((endDate || dateEnd) + ' 23:59:59')
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await OperationLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['log_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询操作日志列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list }
