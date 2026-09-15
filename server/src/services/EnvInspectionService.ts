/**
 * 环境检验 Service（EnvInspectionController 下沉）
 *
 * 三大业务域：
 *   1. 检验记录 — 事务化 create/update/delete，自动汇总子项 judge→总结果
 *   2. 区域 — CRUD + buildAreaTree 建树 + 子节点/模板保护
 *   3. 模板 — CRUD + area_id 校验
 *
 * generateInspectionNo: HJ + YYYYMMDD + 3位流水号（同日内并发递增）
 * parseStatusParam: 支持 STATUS_REVERSE dict + 数字
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import { QualityEnvArea, QualityEnvTemplate, QualityEnvInspection, QualityEnvInspectionItem } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE } from '../models/QualityEnvInspection.js'

function parseStatusParam(status: any): number | null {
  if (status === undefined || status === '' || status === null) return null
  if (typeof status === 'string') {
    if (STATUS_REVERSE[status] !== undefined) return STATUS_REVERSE[status]
    const n = Number(status)
    if (!Number.isNaN(n)) return n
    return null
  }
  if (typeof status === 'number') return status
  return null
}

async function generateInspectionNo(): Promise<string> {
  const prefix = 'HJ'
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const existed: any[] = await QualityEnvInspection.findAll({
    where: { inspection_no: { [Op.like]: `${prefix}${dateStr}%` } },
    attributes: ['inspection_no'],
    raw: true,
  })
  const maxSeq = existed.reduce((max, r) => {
    const m = /^HJ\d{8}(\d+)$/.exec(r.inspection_no || '')
    if (m) return Math.max(max, parseInt(m[1], 10))
    return max
  }, 0)
  return `${prefix}${dateStr}${String(maxSeq + 1).padStart(3, '0')}`
}

export function buildAreaTree(areas: any[]): any[] {
  const map = new Map<number, any>()
  areas.forEach(a => map.set(a.area_id, { ...a, children: [] }))
  const roots: any[] = []
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortTree = (nodes: any[]) => {
    nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    nodes.forEach(n => { if (n.children && n.children.length) sortTree(n.children) })
  }
  sortTree(roots)
  return roots
}

// ============================================================
// 检验记录
// ============================================================
const InspectionService = {
  async list(query: any) {
    const { page = 1, page_size = 20, inspection_no, area_id, result, status, start_date, end_date } = query
    const where: any = {}
    if (inspection_no) where.inspection_no = { [Op.like]: `%${inspection_no}%` }
    if (area_id) where.area_id = area_id
    if (result) where.result = result
    const statusNum = parseStatusParam(status)
    if (statusNum !== null) where.status = statusNum
    if (start_date || end_date) {
      where.inspection_date = {}
      if (start_date) where.inspection_date[Op.gte] = new Date(String(start_date))
      if (end_date) where.inspection_date[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
    }
    const pageNum = Math.max(1, Number(page) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))
    return await QualityEnvInspection.findAndCountAll({
      where,
      include: [{ model: QualityEnvArea, as: 'area', attributes: ['area_id', 'area_name'] }],
      order: [['created_at', 'DESC']],
      limit: pageSize, offset: (pageNum - 1) * pageSize,
    })
  },

  async detail(id: number | string) {
    const record = await QualityEnvInspection.findByPk(Number(id), {
      include: [
        { model: QualityEnvArea, as: 'area', attributes: ['area_id', 'area_name', 'area_code'] },
        { model: QualityEnvInspectionItem, as: 'items', required: false, order: [['item_id', 'ASC']] },
      ],
    })
    if (!record) throw new AppError('记录不存在', 10002, 404)
    return record
  },

  async create(body: any) {
    const t = await sequelize.transaction()
    try {
      const { area_id, trigger_type, inspection_date, inspector_id, inspector_name, remarks } = body
      if (!area_id) throw new AppError('区域ID不能为空', 10001, 400)
      const area = await QualityEnvArea.findByPk(Number(area_id))
      if (!area) throw new AppError('区域不存在', 10002, 404)
      const templates = await QualityEnvTemplate.findAll({
        where: { area_id, status: 1 }, order: [['sort_order', 'ASC'], ['template_id', 'ASC']],
      })
      const record = await QualityEnvInspection.create({
        inspection_no: await generateInspectionNo(),
        area_id, area_name: (area as any).area_name, trigger_type: trigger_type || '手工',
        status: 0, inspection_date: inspection_date || new Date(),
        inspector_id: inspector_id || null, inspector_name: inspector_name || '', remarks: remarks || '',
      } as any, { transaction: t })
      if (templates.length > 0) {
        const items = templates.map((tpl: any) => ({
          inspection_id: record.inspection_id,
          item_name: (tpl as any).item_name, standard_value: (tpl as any).standard_value,
          unit: (tpl as any).unit, actual_value: '', judge: '', remark: '',
        }))
        await QualityEnvInspectionItem.bulkCreate(items, { transaction: t })
      }
      await t.commit()
      return await this.detail(record.inspection_id)
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) {} }
      throw err
    }
  },

  async update(id: number | string, body: any) {
    const t = await sequelize.transaction()
    try {
      const record = await QualityEnvInspection.findByPk(Number(id))
      if (!record) throw new AppError('记录不存在', 10002, 404)

      const updateData: any = {}
      if (body.area_id !== undefined) {
        updateData.area_id = body.area_id
        const area = await QualityEnvArea.findByPk(Number(body.area_id))
        if (area) updateData.area_name = (area as any).area_name
      }
      for (const key of ['trigger_type', 'result', 'status', 'correction_action', 'recheck_date', 'recheck_result', 'inspector_id', 'inspector_name', 'inspection_date', 'remarks']) {
        if (body[key] !== undefined) updateData[key] = body[key]
      }
      if (Object.keys(updateData).length > 0) await record.update(updateData, { transaction: t })

      if (Array.isArray(body.items)) {
        await QualityEnvInspectionItem.destroy({ where: { inspection_id: Number(id) }, transaction: t })
        if (body.items.length > 0) {
          const bulk = body.items.map((it: any) => ({
            inspection_id: Number(id), item_name: it.item_name || '', standard_value: it.standard_value || '',
            actual_value: it.actual_value || '', unit: it.unit || '', judge: it.judge || '', remark: it.remark || '',
          }))
          await QualityEnvInspectionItem.bulkCreate(bulk, { transaction: t })
        }
        // 自动汇总总结果
        if (body.result === undefined) {
          const allJudge = body.items.map((it: any) => it.judge).filter(Boolean)
          const hasFail = allJudge.some((j: string) => j === '不合格')
          await record.update({ result: hasFail ? '不合格' : '合格' }, { transaction: t })
        }
      }
      await t.commit()
      return await this.detail(Number(id))
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) {} }
      throw err
    }
  },

  async delete(id: number | string) {
    const t = await sequelize.transaction()
    try {
      const record = await QualityEnvInspection.findByPk(Number(id))
      if (!record) throw new AppError('记录不存在', 10002, 404)
      await QualityEnvInspectionItem.destroy({ where: { inspection_id: Number(id) }, transaction: t })
      await record.destroy({ transaction: t })
      await t.commit()
      return true
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) {} }
      throw err
    }
  },
}

// ============================================================
// 区域
// ============================================================
const AreaService = {
  async list(query: any) {
    const { tree = 0, status } = query
    const where: any = {}
    if (status !== undefined && status !== '') where.status = Number(status)
    const areas = await QualityEnvArea.findAll({
      where, order: [['sort_order', 'ASC'], ['area_id', 'ASC']],
    })
    if (String(tree) === '1') return buildAreaTree(areas.map((a: any) => a.toJSON()))
    return areas
  },

  async create(body: any) {
    const { area_code, area_name, parent_id } = body
    if (!area_name) throw new AppError('区域名称不能为空', 10001, 400)
    if (area_code) {
      const existed = await QualityEnvArea.findOne({ where: { area_code } })
      if (existed) throw new AppError('区域编码已存在', 20001, 409)
    }
    if (parent_id) {
      const parent = await QualityEnvArea.findByPk(Number(parent_id))
      if (!parent) throw new AppError('父级区域不存在', 10002, 404)
    }
    return await QualityEnvArea.create({
      area_code: area_code || '', area_name, area_type: body.area_type || '',
      parent_id: parent_id || null, sort_order: body.sort_order || 0,
      status: body.status !== undefined ? body.status : 1, remarks: body.remarks || '',
    } as any)
  },

  async update(id: number | string, body: any) {
    const area = await QualityEnvArea.findByPk(Number(id))
    if (!area) throw new AppError('区域不存在', 10002, 404)
    const updateData: any = {}
    if (body.area_code !== undefined) {
      const existed = await QualityEnvArea.findOne({ where: { area_code: body.area_code, area_id: { [Op.ne]: Number(id) } } })
      if (existed) throw new AppError('区域编码已存在', 20001, 409)
      updateData.area_code = body.area_code
    }
    if (body.area_name !== undefined) updateData.area_name = body.area_name
    if (body.area_type !== undefined) updateData.area_type = body.area_type
    if (body.parent_id !== undefined) {
      if (body.parent_id && Number(body.parent_id) === Number(id)) throw new AppError('父级不能是自身', 10001, 400)
      updateData.parent_id = body.parent_id || null
    }
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
    if (body.status !== undefined) updateData.status = body.status
    if (body.remarks !== undefined) updateData.remarks = body.remarks
    await area.update(updateData)
    return area
  },

  async remove(id: number | string) {
    const area = await QualityEnvArea.findByPk(Number(id))
    if (!area) throw new AppError('区域不存在', 10002, 404)
    const children = await QualityEnvArea.findAll({ where: { parent_id: Number(id) } })
    if (children.length > 0) throw new AppError('存在子区域，无法删除', 20001, 409)
    const templates = await QualityEnvTemplate.findAll({ where: { area_id: Number(id) } })
    if (templates.length > 0) throw new AppError('区域下存在模板，无法删除', 20001, 409)
    await area.destroy()
    return true
  },
}

// ============================================================
// 模板
// ============================================================
const TemplateService = {
  async list(query: any) {
    const { area_id, template_name, status } = query
    const where: any = {}
    if (area_id) where.area_id = area_id
    if (template_name) where.template_name = { [Op.like]: `%${template_name}%` }
    if (status !== undefined && status !== '') where.status = Number(status)
    return await QualityEnvTemplate.findAll({
      where, include: [{ model: QualityEnvArea, as: 'area', attributes: ['area_id', 'area_name'] }],
      order: [['area_id', 'ASC'], ['sort_order', 'ASC'], ['template_id', 'ASC']],
    })
  },

  async listByArea(areaId: number | string) {
    return await QualityEnvTemplate.findAll({
      where: { area_id: Number(areaId), status: 1 },
      order: [['sort_order', 'ASC'], ['template_id', 'ASC']],
    })
  },

  async create(body: any) {
    const { template_name, area_id, item_name } = body
    if (!template_name) throw new AppError('模板名称不能为空', 10001, 400)
    if (!item_name) throw new AppError('检验项目不能为空', 10001, 400)
    if (area_id) {
      const area = await QualityEnvArea.findByPk(Number(area_id))
      if (!area) throw new AppError('区域不存在', 10002, 404)
    }
    return await QualityEnvTemplate.create({
      template_name, area_id: area_id || null, item_name,
      standard_value: body.standard_value || '', unit: body.unit || '', test_method: body.test_method || '',
      sort_order: body.sort_order || 0, status: body.status !== undefined ? body.status : 1,
    } as any)
  },

  async update(id: number | string, body: any) {
    const tpl = await QualityEnvTemplate.findByPk(Number(id))
    if (!tpl) throw new AppError('模板不存在', 10002, 404)
    const updateData: any = {}
    for (const key of ['template_name', 'item_name', 'standard_value', 'unit', 'test_method', 'sort_order', 'status']) {
      if (body[key] !== undefined) updateData[key] = body[key]
    }
    if (body.area_id !== undefined) {
      if (body.area_id) {
        const area = await QualityEnvArea.findByPk(Number(body.area_id))
        if (!area) throw new AppError('区域不存在', 10002, 404)
      }
      updateData.area_id = body.area_id || null
    }
    await tpl.update(updateData)
    return tpl
  },

  async remove(id: number | string) {
    const tpl = await QualityEnvTemplate.findByPk(Number(id))
    if (!tpl) throw new AppError('模板不存在', 10002, 404)
    await tpl.destroy()
    return true
  },
}

export const EnvInspectionService = {
  inspection: InspectionService,
  area: AreaService,
  template: TemplateService,
}

export default EnvInspectionService
