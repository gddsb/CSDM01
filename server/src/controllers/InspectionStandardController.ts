import { Op } from 'sequelize'
import { InspectionStandard, InspectionStandardItem, Material } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { nowBeijingDate, formatDateTime, parseDateTime } from '../utils/date.js'

const TYPE_PREFIX: Record<string, string> = { '首件': 'SJ', '制程': 'ZC', '成品': 'CP', '来料': 'LL', '其它': 'QT' }
const STANDARD_TYPE_PREFIX: Record<string, string> = { '通用标准': 'TY', '专用标准': 'ZY', '临时标准': 'LS' }

export const generateNo = async (req: any, res: any) => {
  try {
    const { standard_type } = req.query
    if (!standard_type) {
      return fail(res, '标准类型不能为空')
    }
    const year = new Date().getFullYear()
    const prefix = `BZ-${STANDARD_TYPE_PREFIX[standard_type] || 'TY'}-${year}-`
    const lastRecord = await InspectionStandard.findOne({
      where: { standard_no: { [Op.like]: `${prefix}%` } },
      order: [['standard_no', 'DESC']],
    })
    let seq = 1
    if (lastRecord) {
      const match = lastRecord.standard_no.match(/-(\d{3})$/)
      if (match) seq = parseInt(match[1], 10) + 1
    }
    const standardNo = `${prefix}${String(seq).padStart(3, '0')}`
    success(res, { standard_no: standardNo })
  } catch (err: any) {
    logger.error('[InspectionStandard] generateNo error:', err)
    fail(res, err.message || '生成编号失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const list = async (req: any, res: any) => {
  try {
    const { page = 1, page_size = 20, status, keyword } = req.query
    const pageNum = parseInt(page, 10)
    const pageSize = Math.min(parseInt(page_size, 10), MAX_PAGE_SIZE)
    const where: any = {}
    if (status) where.status = status
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
      include: [
        { model: InspectionStandardItem, as: 'items', order: [['sort_order', 'ASC'], ['item_id', 'ASC']] },
        { model: Material, as: 'material', attributes: ['material_id', 'material_code', 'material_name', 'specification'] },
      ],
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
    const { standard_no, standard_name, standard_type, customer_code, material_id, material_name, version_no, effective_date, status, created_by, description, items } = req.body
    if (!standard_no || !standard_name || !standard_type) {
      return fail(res, '标准编号、标准名称、标准类型不能为空')
    }
    const exists = await InspectionStandard.findOne({ where: { standard_no } })
    if (exists) return fail(res, '标准编号已存在')
    const record = await InspectionStandard.create({
      standard_no, standard_name, standard_type,
      inspection_type: '',
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
        defect_level: it.defect_level || null,
        sort_order: it.sort_order || 0,
        inspection_types: Array.isArray(it.inspection_types) ? it.inspection_types.join(',') : (it.inspection_types || null),
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
    const { standard_no, standard_name, standard_type, customer_code, material_id, material_name, version_no, effective_date, status, description, items } = req.body

    // 审核生效时自动设置生效日期
    const targetStatus = status || record.status
    let finalEffectiveDate = record.effective_date
    if (effective_date !== undefined) {
      finalEffectiveDate = effective_date ? (parseDateTime(effective_date) || nowBeijingDate()) : null
    }
    if (targetStatus === '生效' && !finalEffectiveDate) {
      finalEffectiveDate = nowBeijingDate()
    }

    await record.update({
      standard_no: standard_no !== undefined ? standard_no : record.standard_no,
      standard_name: standard_name !== undefined ? standard_name : record.standard_name,
      standard_type: standard_type !== undefined ? standard_type : record.standard_type,
      inspection_type: '',
      customer_code: customer_code !== undefined ? (customer_code || null) : record.customer_code,
      material_id: material_id !== undefined ? (material_id || null) : record.material_id,
      material_name: material_name !== undefined ? (material_name || null) : record.material_name,
      version_no: version_no !== undefined ? version_no : record.version_no,
      effective_date: finalEffectiveDate,
      status: status !== undefined ? status : record.status,
      description: description !== undefined ? description : record.description,
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
          defect_level: it.defect_level || null,
          sort_order: it.sort_order || 0,
          inspection_types: Array.isArray(it.inspection_types) ? it.inspection_types.join(',') : (it.inspection_types || null),
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

// 复制：生成新的标准号，状态为开立
export const copy = async (req: any, res: any) => {
  try {
    const { id } = req.params
    const record = await InspectionStandard.findOne({
      where: { standard_id: id },
      include: [{ model: InspectionStandardItem, as: 'items', order: [['sort_order', 'ASC'], ['item_id', 'ASC']] }],
    })
    if (!record) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)

    // 生成新标准号
    const year = new Date().getFullYear()
    const prefix = `BZ-${STANDARD_TYPE_PREFIX[record.standard_type] || 'TY'}-${year}-`
    const lastRecord = await InspectionStandard.findOne({
      where: { standard_no: { [Op.like]: `${prefix}%` } },
      order: [['standard_no', 'DESC']],
    })
    let seq = 1
    if (lastRecord) {
      const match = lastRecord.standard_no.match(/-(\d{3})$/)
      if (match) seq = parseInt(match[1], 10) + 1
    }
    const newStandardNo = `${prefix}${String(seq).padStart(3, '0')}`

    const newRecord = await InspectionStandard.create({
      standard_no: newStandardNo,
      standard_name: record.standard_name,
      standard_type: record.standard_type,
      inspection_type: '',
      customer_code: record.customer_code,
      material_id: record.material_id,
      material_name: record.material_name,
      version_no: 'V1',
      effective_date: null,
      status: '开立',
      created_by: req.user?.userId || null,
      description: record.description,
    })

    const items = (record as any).items || []
    if (items.length > 0) {
      const itemRecords = items.map((it: any) => ({
        standard_id: newRecord.standard_id,
        item_name: it.item_name,
        category: it.category || null,
        method: it.method || null,
        sample_rule: it.sample_rule || null,
        standard_value: it.standard_value,
        unit: it.unit || null,
        defect_level: it.defect_level || null,
        sort_order: it.sort_order || 0,
        inspection_types: it.inspection_types || null,
      }))
      await InspectionStandardItem.bulkCreate(itemRecords)
    }
    success(res, newRecord, '复制成功')
  } catch (err: any) {
    logger.error('[InspectionStandard] copy error:', err)
    fail(res, err.message || '复制失败', ErrorCode.SYSTEM_ERROR)
  }
}

// 改版：标准号不变，版本号+1，状态为开立
export const revise = async (req: any, res: any) => {
  try {
    const { id } = req.params
    const record = await InspectionStandard.findOne({
      where: { standard_id: id },
      include: [{ model: InspectionStandardItem, as: 'items', order: [['sort_order', 'ASC'], ['item_id', 'ASC']] }],
    })
    if (!record) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)

    // 查找同标准号的最新版本号
    const allVersions = await InspectionStandard.findAll({
      where: { standard_no: record.standard_no },
      order: [['version_no', 'DESC']],
    })
    let maxVersion = 0
    allVersions.forEach((r: any) => {
      const match = String(r.version_no || '').match(/^V(\d+)$/i)
      if (match) maxVersion = Math.max(maxVersion, parseInt(match[1], 10))
    })
    const newVersionNo = `V${maxVersion + 1}`

    const newRecord = await InspectionStandard.create({
      standard_no: record.standard_no,
      standard_name: record.standard_name,
      standard_type: record.standard_type,
      inspection_type: '',
      customer_code: record.customer_code,
      material_id: record.material_id,
      material_name: record.material_name,
      version_no: newVersionNo,
      effective_date: null,
      status: '开立',
      created_by: req.user?.userId || null,
      description: record.description,
    })

    const items = (record as any).items || []
    if (items.length > 0) {
      const itemRecords = items.map((it: any) => ({
        standard_id: newRecord.standard_id,
        item_name: it.item_name,
        category: it.category || null,
        method: it.method || null,
        sample_rule: it.sample_rule || null,
        standard_value: it.standard_value,
        unit: it.unit || null,
        defect_level: it.defect_level || null,
        sort_order: it.sort_order || 0,
        inspection_types: it.inspection_types || null,
      }))
      await InspectionStandardItem.bulkCreate(itemRecords)
    }
    success(res, newRecord, '改版成功')
  } catch (err: any) {
    logger.error('[InspectionStandard] revise error:', err)
    fail(res, err.message || '改版失败', ErrorCode.SYSTEM_ERROR)
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

export default { list, detail, create, update, remove, listItems, generateNo, copy, revise }
