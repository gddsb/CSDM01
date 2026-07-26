import { InspectionStandard, InspectionStandardItem } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'

async function list(req: any, res: any) {
  try {
    const { page = 1, page_size = 20, status, inspection_type, keyword } = req.query
    const pageNum = parseInt(page, 10)
    const pageSize = parseInt(page_size, 10)
    const where: any = {}
    if (status) where.status = status
    if (inspection_type) where.inspection_type = inspection_type
    if (keyword) {
      where[require('sequelize').Op.or] = [
        { standard_no: { [require('sequelize').Op.like]: `%${keyword}%` } },
        { standard_name: { [require('sequelize').Op.like]: `%${keyword}%` } },
      ]
    }
    const { count, rows } = await InspectionStandard.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (pageNum - 1) * pageSize,
    })
    success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
  } catch (err: any) {
    logger.error('[InspectionStandard] list error:', err)
    fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
  }
}

async function detail(req: any, res: any) {
  try {
    const { id } = req.params
    const record = await InspectionStandard.findOne({
      where: { standard_id: id },
      include: [{ model: InspectionStandardItem, as: 'items', order: [['sort_order', 'ASC'], ['item_id', 'ASC']] }],
    })
    if (!record) {
      return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
    }
    success(res, record)
  } catch (err: any) {
    logger.error('[InspectionStandard] detail error:', err)
    fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
  }
}

async function listItems(req: any, res: any) {
  try {
    const { standardId } = req.params
    const items = await InspectionStandardItem.findAll({
      where: { standard_id: standardId },
      order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
    })
    success(res, items)
  } catch (err: any) {
    logger.error('[InspectionStandard] listItems error:', err)
    fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, listItems }
