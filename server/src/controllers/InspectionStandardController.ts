import { Op } from 'sequelize'
import { InspectionStandard, InspectionStandardItem } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

export const list = async (req: any, res: any) => {
  try {
    const { page = 1, page_size = 20, status, inspection_type, keyword } = req.query
    const pageNum = parseInt(page, 10)
    const pageSize = Math.min(parseInt(page_size, 10), MAX_PAGE_SIZE)
    const where: any = {}
    if (status) where.status = status
    if (inspection_type) where.inspection_type = inspection_type
    if (keyword) {
      where[Op.or] = [
        { standard_no: { [Op.like]: `%${keyword}%` } },
        { standard_name: { [Op.like]: `%${keyword}%` } },
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

export const detail = async (req: any, res: any) => {
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

export const create = async (req: any, res: any) => {
  try {
    const { standard_no, standard_name, inspection_type, standard_type, customer_code, material_id, material_name, version_no, effective_date, status, created_by, description, items } = req.body
    if (!standard_no || !standard_name || !inspection_type || !standard_type) {
      return fail(res, '标准编号、标准名称、检验类型、标准类型不能为空')
    }
    const exists = await InspectionStandard.findOne({ where: { standard_no } })
    if (exists) return fail(res, '标准编号已存在')
    const record = await InspectionStandard.create({
      standard_no, standard_name, inspection_type, standard_type,
      customer_code: customer_code || null,
      material_id: material_id || null,
      material_name: material_name || null,
      version_no: version_no || 'V1',
      effective_date: effective_date || null,
      status: status || '开立',
      created_by: created_by || null,
      description: description || null,
    })
    if (items && Array.isArray(items) && items.length > 0) {
      const itemRecords = items.map((it: any) => ({
        standard_id: record.standard_id,
        item_name: it.item_name,
        category: it.category || null,
        method: it.method || null,
        sample_rule: it.sample_rule || null,
        standard_value: it.standard_value,
        unit: it.unit || null,
        sort_order: it.sort_order || 0,
      }))
      await InspectionStandardItem.bulkCreate(itemRecords)
    }
    success(res, record, '创建成功')
  } catch (err: any) {
    logger.error('[InspectionStandard] create error:', err)
    fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const update = async (req: any, res: any) => {
  try {
    const { id } = req.params
    const record = await InspectionStandard.findOne({ where: { standard_id: id } })
    if (!record) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
    if (req.body.standard_no && req.body.standard_no !== record.standard_no) {
      const exists = await InspectionStandard.findOne({
        where: { standard_no: req.body.standard_no, standard_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '标准编号已存在')
    }
    const { standard_no, standard_name, inspection_type, standard_type, customer_code, material_id, material_name, version_no, effective_date, status, description, items } = req.body
    await record.update({
      standard_no, standard_name, inspection_type, standard_type,
      customer_code: customer_code || null,
      material_id: material_id || null,
      material_name: material_name || null,
      version_no: version_no || 'V1',
      effective_date: effective_date || null,
      status: status || '开立',
      description: description || null,
    })
    if (items && Array.isArray(items)) {
      await InspectionStandardItem.destroy({ where: { standard_id: id } })
      if (items.length > 0) {
        const itemRecords = items.map((it: any) => ({
          standard_id: id,
          item_name: it.item_name,
          category: it.category || null,
          method: it.method || null,
          sample_rule: it.sample_rule || null,
          standard_value: it.standard_value,
          unit: it.unit || null,
          sort_order: it.sort_order || 0,
        }))
        await InspectionStandardItem.bulkCreate(itemRecords)
      }
    }
    success(res, record, '修改成功')
  } catch (err: any) {
    logger.error('[InspectionStandard] update error:', err)
    fail(res, err.message || '修改失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const remove = async (req: any, res: any) => {
  try {
    const { id } = req.params
    const record = await InspectionStandard.findOne({ where: { standard_id: id } })
    if (!record) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
    await InspectionStandardItem.destroy({ where: { standard_id: id } })
    await record.destroy()
    success(res, null, '删除成功')
  } catch (err: any) {
    logger.error('[InspectionStandard] remove error:', err)
    fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const listItems = async (req: any, res: any) => {
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

export default { list, detail, create, update, remove, listItems }
