/**
 * 检验标准业务 Service
 *
 * 独特业务规则：
 * - 标准编号自动生成（BZ-{类型前缀}-{YYYY}-{3位流水码}，按标准类型分组）
 * - 版本号改版：同标准号 version_no +1（V1→V2）
 * - 状态流转："生效"时自动失效同标准号的其他"生效"版本
 */
import { Op } from 'sequelize'
import {
  InspectionStandard,
  InspectionStandardItem,
  Material,
} from '../models/index.js'
import { nowBeijingDate, parseDateTime } from '../utils/date.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

export const STANDARD_TYPE_PREFIX: Record<string, string> = {
  '材料检验': 'CL', '产品检验': 'CP', '环境检验': 'HJ', '微生物检验标准': 'WS', '其它检验': 'QT',
}

export const TYPE_PREFIX: Record<string, string> = {
  '首件': 'SJ', '制程': 'ZC', '成品': 'CP', '来料': 'LL', '其它': 'QT',
}

// ---------- 纯函数 ----------

/** 状态值标准化：数字/"0"/"开立"→"开立" 等双向兼容 */
const STATUS_VALUE_TO_DB: Record<string, string> = {
  '0': '开立', '开立': '开立', 'open': '开立',
  '1': '生效', '生效': '生效', 'active': '生效', '启用': '生效',
  '2': '失效', '失效': '失效', 'inactive': '失效', '停用': '失效', '禁用': '失效',
}
export function normalizeStandardStatusValue(raw: string): string {
  if (raw === null || raw === undefined) return ''
  const key = String(raw).trim()
  if (!key) return ''
  return STATUS_VALUE_TO_DB[key] !== undefined ? STATUS_VALUE_TO_DB[key] : key
}

/** 构建检验标准列表 where（纯函数） */
export function buildStandardWhere(query: any): any {
  const where: any = {}
  const { status, standard_no, standard_type, keyword } = query

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
  return where
}

/** 构建 Item 记录数组（用于 create/update/copy/revise，纯函数） */
export function buildStandardItemRecords(items: any[], standardId: number): any[] {
  return items.map((it: any) => ({
    standard_id: standardId,
    item_name: it.item_name,
    category: it.category || null,
    method: it.method || null,
    sampling_plan: it.sampling_plan || 'AQL抽样',
    sampling_detail: it.sampling_detail
      ? (typeof it.sampling_detail === 'string' ? it.sampling_detail : JSON.stringify(it.sampling_detail))
      : null,
    standard_value: it.standard_value,
    unit: it.unit || null,
    defect_level: it.defect_level || null,
    sort_order: it.sort_order || 0,
    inspection_types: Array.isArray(it.inspection_types)
      ? it.inspection_types.join(',')
      : (it.inspection_types || null),
    item_type: it.item_type || 'qualitative',
    need_sample_count: it.need_sample_count ?? 0,
    upper_limit: it.upper_limit ?? null,
    lower_limit: it.lower_limit ?? null,
  }))
}

// ---------- Service ----------

export const InspectionStandardService = {
  /** 生成检验标准编号（纯 DB 查询，无副作用） */
  async generateNo(standard_type: string): Promise<{ standard_no: string }> {
    if (!standard_type) throw new AppError('标准类型不能为空', 10001, 400)

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
    return { standard_no: `${prefix}${String(seq).padStart(3, '0')}` }
  },

  /** 列表 */
  async list(query: any) {
    const where = buildStandardWhere(query)
    const pageNum = parseInt(query.page, 10) || 1
    const pageSize = Math.min(parseInt(query.page_size, 10) || 20, MAX_PAGE_SIZE)

    return await InspectionStandard.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (pageNum - 1) * pageSize,
    })
  },

  /** 详情（含 items + material） */
  async detail(id: number | string) {
    const record = await InspectionStandard.findOne({
      where: { standard_id: Number(id) },
      include: [
        { model: InspectionStandardItem, as: 'items', order: [['sort_order', 'ASC'], ['item_id', 'ASC']] },
        { model: Material, as: 'material', attributes: ['material_id', 'material_code', 'material_name', 'specification'] },
      ],
    })
    if (!record) throw new AppError('记录不存在', 10002, 404)
    return record
  },

  /** 创建检验标准（唯一性校验 + 自动生成 items） */
  async create(body: any, username?: string | null) {
    const { standard_no, standard_name, standard_type } = body
    if (!standard_no || !standard_name || !standard_type) {
      throw new AppError('标准编号、标准名称、标准类型不能为空', 10001, 400)
    }

    const exists = await InspectionStandard.findOne({ where: { standard_no } })
    if (exists) throw new AppError('标准编号已存在', 10003, 409)

    const record = await InspectionStandard.create({
      standard_no,
      standard_name,
      standard_type,
      inspection_type: '',
      inspection_plan: body.inspection_plan || null,
      customer_code: body.customer_code || null,
      material_id: body.material_id || null,
      material_name: body.material_name || null,
      version_no: body.version_no || 'V1',
      effective_date: body.effective_date || null,
      status: body.status || '开立',
      created_by: username || null,
      description: body.description || null,
    } as any)

    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const itemRecords = buildStandardItemRecords(body.items, (record as any).standard_id)
      await InspectionStandardItem.bulkCreate(itemRecords)
    }

    return record
  },

  /** 修改检验标准（含状态流转：生效时自动失效同标准号其他生效版本） */
  async update(id: number | string, body: any) {
    const record = await InspectionStandard.findOne({ where: { standard_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    // 编号唯一性校验
    if (body.standard_no && body.standard_no !== (record as any).standard_no) {
      const exists = await InspectionStandard.findOne({
        where: { standard_no: body.standard_no, standard_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('标准编号已存在', 10003, 409)
    }

    // 生效日期处理
    const targetStatus = body.status !== undefined ? body.status : (record as any).status
    let finalEffectiveDate = (record as any).effective_date
    if (body.effective_date !== undefined) {
      finalEffectiveDate = body.effective_date
        ? (parseDateTime(body.effective_date) || nowBeijingDate())
        : null
    }
    if (targetStatus === '生效' && !finalEffectiveDate) {
      finalEffectiveDate = nowBeijingDate()
    }

    // 状态流转：生效时自动失效同标准号其他"生效"版本
    if (targetStatus === '生效' && (record as any).status !== '生效') {
      const now = nowBeijingDate()
      await InspectionStandard.update(
        { status: '失效', expiry_date: now },
        { where: {
          standard_no: (record as any).standard_no,
          status: '生效',
          standard_id: { [Op.ne]: Number(id) },
        } },
      )
    }

    // 版本号不允许手动改（只能 copy/revise）
    await record.update({
      standard_no: body.standard_no !== undefined ? body.standard_no : (record as any).standard_no,
      standard_name: body.standard_name !== undefined ? body.standard_name : (record as any).standard_name,
      standard_type: body.standard_type !== undefined ? body.standard_type : (record as any).standard_type,
      inspection_type: '',
      inspection_plan: body.inspection_plan !== undefined ? (body.inspection_plan || null) : (record as any).inspection_plan,
      customer_code: body.customer_code !== undefined ? (body.customer_code || null) : (record as any).customer_code,
      material_id: body.material_id !== undefined ? (body.material_id || null) : (record as any).material_id,
      material_name: body.material_name !== undefined ? (body.material_name || null) : (record as any).material_name,
      version_no: (record as any).version_no,
      effective_date: finalEffectiveDate,
      status: body.status !== undefined ? body.status : (record as any).status,
      description: body.description !== undefined ? body.description : (record as any).description,
    })

    // items 全量替换
    if (body.items && Array.isArray(body.items)) {
      await InspectionStandardItem.destroy({ where: { standard_id: Number(id) } })
      if (body.items.length > 0) {
        const itemRecords = buildStandardItemRecords(body.items, Number(id))
        await InspectionStandardItem.bulkCreate(itemRecords)
      }
    }

    return record
  },

  /** 删除（级联删 items） */
  async remove(id: number | string) {
    const record = await InspectionStandard.findOne({ where: { standard_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    await InspectionStandardItem.destroy({ where: { standard_id: Number(id) } })
    await record.destroy()
    return true
  },

  /** 复制（同标准类型生成新编号 + version_no=V1 + status=开立） */
  async copy(id: number | string, username?: string | null) {
    const record = await InspectionStandard.findOne({
      where: { standard_id: Number(id) },
      include: [{ model: InspectionStandardItem, as: 'items', order: [['sort_order', 'ASC'], ['item_id', 'ASC']] }],
    })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    // 生成新标准号（与 generateNo 逻辑相同）
    const year = new Date().getFullYear()
    const typePrefix = STANDARD_TYPE_PREFIX[(record as any).standard_type] || 'QT'
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
      standard_name: (record as any).standard_name,
      standard_type: (record as any).standard_type,
      inspection_type: '',
      inspection_plan: (record as any).inspection_plan,
      customer_code: (record as any).customer_code,
      material_id: (record as any).material_id,
      material_name: (record as any).material_name,
      version_no: 'V1',
      effective_date: null,
      status: '开立',
      created_by: username || null,
      description: (record as any).description,
    } as any)

    const items = (record as any).items || []
    if (items.length > 0) {
      const itemRecords = buildStandardItemRecords(items, (newRecord as any).standard_id)
      await InspectionStandardItem.bulkCreate(itemRecords)
    }

    return newRecord
  },

  /** 改版（同标准号 + version_no+1 + status=开立） */
  async revise(id: number | string, username?: string | null) {
    const record = await InspectionStandard.findOne({
      where: { standard_id: Number(id) },
      include: [{ model: InspectionStandardItem, as: 'items', order: [['sort_order', 'ASC'], ['item_id', 'ASC']] }],
    })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    // 计算新版本号
    const allVersions = await InspectionStandard.findAll({
      where: { standard_no: (record as any).standard_no },
      order: [['version_no', 'DESC']],
    })
    let maxVersion = 0
    allVersions.forEach((r: any) => {
      const match = String(r.version_no || '').match(/^V(\d+)$/i)
      if (match) maxVersion = Math.max(maxVersion, parseInt(match[1], 10))
    })
    const newVersionNo = `V${maxVersion + 1}`

    const newRecord = await InspectionStandard.create({
      standard_no: (record as any).standard_no,
      standard_name: (record as any).standard_name,
      standard_type: (record as any).standard_type,
      inspection_type: '',
      inspection_plan: (record as any).inspection_plan,
      customer_code: (record as any).customer_code,
      material_id: (record as any).material_id,
      material_name: (record as any).material_name,
      version_no: newVersionNo,
      effective_date: null,
      status: '开立',
      created_by: username || null,
      description: (record as any).description,
    } as any)

    const items = (record as any).items || []
    if (items.length > 0) {
      const itemRecords = buildStandardItemRecords(items, (newRecord as any).standard_id)
      await InspectionStandardItem.bulkCreate(itemRecords)
    }

    return newRecord
  },

  /** 列出标准下的所有 items */
  async listItems(standardId: number | string) {
    return await InspectionStandardItem.findAll({
      where: { standard_id: Number(standardId) },
      order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
    })
  },
}

export default InspectionStandardService
