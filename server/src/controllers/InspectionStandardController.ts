import { Op } from 'sequelize'
import { InspectionStandard, InspectionStandardItem, Material } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { nowBeijingDate, formatDateTime, parseDateTime } from '../utils/date.js'

const TYPE_PREFIX: Record<string, string> = { '首件': 'SJ', '制程': 'ZC', '成品': 'CP', '来料': 'LL', '其它': 'QT' }
const STANDARD_TYPE_PREFIX: Record<string, string> = { '材料检验': 'CL', '产品检验': 'CP', '环境检验': 'HJ', '微生物检验标准': 'WS', '其它检验': 'QT' }

// 检验标准 status 存中文（开立/生效/失效），这里建立「可能传入的别名 ↔ DB 中文字」双向兼容表
// 兼容：0/"0"/"开立"→开立；1/"1"/"生效"→生效；2/"2"/"失效"→失效；其他中文字保留原值
const STATUS_VALUE_TO_DB: Record<string, string> = {
  '0': '开立', '开立': '开立', 'open': '开立',
  '1': '生效', '生效': '生效', 'active': '生效', '启用': '生效',
  '2': '失效', '失效': '失效', 'inactive': '失效', '停用': '失效', '禁用': '失效',
}
function normalizeStandardStatusValue(raw: string): string {
  if (raw === null || raw === undefined) return ''
  const key = String(raw).trim()
  if (!key) return ''
  return STATUS_VALUE_TO_DB[key] !== undefined ? STATUS_VALUE_TO_DB[key] : key
}

// 检验标准自动编号：BZ-{类型前缀}-{YYYY}-{3位流水码}  yearly 按年重置
// 例：BZ-CL-2026-001、BZ-CP-2026-002、BZ-WS-2026-001
// 与 sys_number_rule 配置对齐：前缀 BZ-CL / BZ-CP / BZ-HJ / BZ-WS / BZ-QT，date_format=YYYY，separator=-，seq_width=3，reset_by=yearly
export const generateNo = async (req: any, res: any) => {
  try {
    const { standard_type } = req.query
    if (!standard_type) {
      return fail(res, '标准类型不能为空')
    }
    const year = new Date().getFullYear()
    const typePrefix = STANDARD_TYPE_PREFIX[standard_type] || 'QT'
    const prefix = `BZ-${typePrefix}-${year}-`
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
    const { page = 1, page_size = 20, status, keyword, standard_no, standard_type } = req.query
    const pageNum = parseInt(page, 10)
    const pageSize = Math.min(parseInt(page_size, 10), MAX_PAGE_SIZE)
    const where: any = {}
    if (status !== undefined && status !== null && status !== '') {
      const statusList = String(status)
        .split(',')
        .map(s => normalizeStandardStatusValue(s))
        .filter(Boolean)
      if (statusList.length > 0) {
        where.status = statusList.length > 1 ? { [Op.in]: statusList } : statusList[0]
      }
    }
    if (standard_no) where.standard_no = standard_no
    if (standard_type) where.standard_type = standard_type
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
    const { standard_no, standard_name, standard_type, inspection_plan, customer_code, material_id, material_name, version_no, effective_date, status, created_by, description, items } = req.body
    if (!standard_no || !standard_name || !standard_type) {
      return fail(res, '标准编号、标准名称、标准类型不能为空')
    }
    const exists = await InspectionStandard.findOne({ where: { standard_no } })
    if (exists) return fail(res, '标准编号已存在')
    const record = await InspectionStandard.create({
      standard_no, standard_name, standard_type,
      inspection_type: '',
      inspection_plan: inspection_plan || null,
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
        sampling_plan: it.sampling_plan || 'AQL抽样',
        sampling_detail: it.sampling_detail ? (typeof it.sampling_detail === 'string' ? it.sampling_detail : JSON.stringify(it.sampling_detail)) : null,
        standard_value: it.standard_value,
        unit: it.unit || null,
        defect_level: it.defect_level || null,
        sort_order: it.sort_order || 0,
        inspection_types: Array.isArray(it.inspection_types) ? it.inspection_types.join(',') : (it.inspection_types || null),
        item_type: it.item_type || 'qualitative',
        need_sample_count: it.need_sample_count ?? 0,
        upper_limit: it.upper_limit ?? null,
        lower_limit: it.lower_limit ?? null,
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
    const { standard_no, standard_name, standard_type, inspection_plan, customer_code, material_id, material_name, version_no, effective_date, status, description, items } = req.body

    // 审核生效时自动设置生效日期
    const targetStatus = status !== undefined ? status : record.status
    let finalEffectiveDate = record.effective_date
    if (effective_date !== undefined) {
      finalEffectiveDate = effective_date ? (parseDateTime(effective_date) || nowBeijingDate()) : null
    }
    if (targetStatus === '生效' && !finalEffectiveDate) {
      finalEffectiveDate = nowBeijingDate()
    }

    // 审核生效时，将同标准号的其他"生效"版本设为"失效"并记录失效时间
    if (targetStatus === '生效' && record.status !== '生效') {
      const now = nowBeijingDate()
      await InspectionStandard.update(
        { status: '失效', expiry_date: now },
        { where: { standard_no: record.standard_no, status: '生效', standard_id: { [Op.ne]: id } } },
      )
    }

    await record.update({
      standard_no: standard_no !== undefined ? standard_no : record.standard_no,
      standard_name: standard_name !== undefined ? standard_name : record.standard_name,
      standard_type: standard_type !== undefined ? standard_type : record.standard_type,
      inspection_type: '',
      inspection_plan: inspection_plan !== undefined ? (inspection_plan || null) : record.inspection_plan,
      customer_code: customer_code !== undefined ? (customer_code || null) : record.customer_code,
      material_id: material_id !== undefined ? (material_id || null) : record.material_id,
      material_name: material_name !== undefined ? (material_name || null) : record.material_name,
      // 版本号不允许通过编辑接口手动修改，只能通过复制/改版功能自动生成
      version_no: record.version_no,
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
          sampling_plan: it.sampling_plan || 'AQL抽样',
          sampling_detail: it.sampling_detail ? (typeof it.sampling_detail === 'string' ? it.sampling_detail : JSON.stringify(it.sampling_detail)) : null,
          standard_value: it.standard_value,
          unit: it.unit || null,
          defect_level: it.defect_level || null,
          sort_order: it.sort_order || 0,
          inspection_types: Array.isArray(it.inspection_types) ? it.inspection_types.join(',') : (it.inspection_types || null),
          item_type: it.item_type || 'qualitative',
          need_sample_count: it.need_sample_count ?? 0,
          upper_limit: it.upper_limit ?? null,
          lower_limit: it.lower_limit ?? null,
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

    // 生成新标准号：BZ-{类型前缀}-{YYYY}-{3位流水码}，按标准类型分组流水
    const year = new Date().getFullYear()
    const typePrefix = STANDARD_TYPE_PREFIX[record.standard_type] || 'QT'
    const prefix = `BZ-${typePrefix}-${year}-`
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
      inspection_plan: record.inspection_plan,
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
        sampling_plan: it.sampling_plan || 'AQL抽样',
        sampling_detail: it.sampling_detail || null,
        standard_value: it.standard_value,
        unit: it.unit || null,
        defect_level: it.defect_level || null,
        sort_order: it.sort_order || 0,
        inspection_types: it.inspection_types || null,
        item_type: it.item_type || 'qualitative',
        need_sample_count: it.need_sample_count ?? 0,
        upper_limit: it.upper_limit ?? null,
        lower_limit: it.lower_limit ?? null,
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
      inspection_plan: record.inspection_plan,
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
        sampling_plan: it.sampling_plan || 'AQL抽样',
        sampling_detail: it.sampling_detail || null,
        standard_value: it.standard_value,
        unit: it.unit || null,
        defect_level: it.defect_level || null,
        sort_order: it.sort_order || 0,
        inspection_types: it.inspection_types || null,
        item_type: it.item_type || 'qualitative',
        need_sample_count: it.need_sample_count ?? 0,
        upper_limit: it.upper_limit ?? null,
        lower_limit: it.lower_limit ?? null,
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
