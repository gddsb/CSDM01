import { Op } from 'sequelize'
import { SystemLog } from '../models/index.js'
import { logger } from '../utils/logger.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

/** 日志级别下拉中文化（保持 DB 大写值，前端用中文 label） */
const LEVEL_PRIORITY: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

export const list = async (req, res) => {
  try {
    const { level, keyword, page = 1, pageSize = 50, dateStart, dateEnd, category } = req.query

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit

    const where: any = {}
    if (level) where.level = String(level).toUpperCase()
    if (category) where.category = String(category)
    if (keyword) {
      const kw = String(keyword)
      where[Op.or] = [
        { message: { [Op.like]: `%${kw}%` } },
        { details: { [Op.like]: `%${kw}%` } },
        { path: { [Op.like]: `%${kw}%` } },
      ]
    }
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(String(dateStart))
      if (dateEnd) where.created_at[Op.lte] = new Date(String(dateEnd) + ' 23:59:59')
    }

    const { rows, count } = await SystemLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['log_id', 'DESC']],
    })

    return success(res, rows, '查询成功', count)
  } catch (err) {
    logger.error({ err, source: 'SystemLogController.list' }, '查询系统日志失败')
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list }
