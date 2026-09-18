/**
 * 操作日志 Service（OperationLogController 下沉）
 *
 * 只处理 DB 查询 + 分页参数校验；
 * 业务参数解析（日期范围、状态码转换、limit 上限）保留在 Service 内统一处理。
 */
import { Op } from 'sequelize'
import { OperationLog } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'

export const OperationLogService = {
  /** 分页查日志（支持 username/module/method/status/dateRange 筛选） */
  async list(query: any = {}) {
    const { username, module, method, status, startDate, endDate, dateStart, dateEnd } = query
    const page = Number(query.page) || 1
    const pageSize = Math.min(Number(query.pageSize) || 20, MAX_PAGE_SIZE)

    const where: any = {}
    if (username) where.username = { [Op.like]: `%${username}%` }
    if (module) where.module = { [Op.like]: `%${module}%` }
    if (method) where.method = method
    if (status !== undefined && status !== '') where.status = Number(status)

    const sd = startDate || dateStart
    const ed = endDate || dateEnd
    if (sd || ed) {
      where.created_at = {}
      if (sd) where.created_at[Op.gte] = new Date(sd)
      if (ed) where.created_at[Op.lte] = new Date(String(ed) + ' 23:59:59')
    }

    const { rows, count } = await OperationLog.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['log_id', 'DESC']],
    })
    return { rows, count, page, pageSize }
  },
}

export default OperationLogService
