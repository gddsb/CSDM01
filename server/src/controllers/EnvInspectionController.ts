import { Op } from 'sequelize'
import {
  QualityEnvArea,
  QualityEnvTemplate,
  QualityEnvInspection,
  QualityEnvInspectionItem,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE } from '../models/QualityEnvInspection.js'

const parseStatusParam = (status: any): number | null => {
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
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const dateStr = `${y}${m}${d}`
  const existed = await QualityEnvInspection.findAll({
    where: { inspection_no: { [Op.like]: `${prefix}${dateStr}%` } },
    attributes: ['inspection_no'],
    raw: true,
  })
  const maxSeq = existed.reduce((max: number, r: any) => {
    const m2 = /^HJ\d{8}(\d+)$/.exec(r.inspection_no || '')
    if (m2) return Math.max(max, parseInt(m2[1], 10))
    return max
  }, 0)
  const next = String(maxSeq + 1).padStart(3, '0')
  return `${prefix}${dateStr}${next}`
}

function buildAreaTree(areas: any[]): any[] {
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

export default {
  // ============ 检验记录 ============

  async list(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        inspection_no,
        area_id,
        result,
        status,
        start_date,
        end_date,
      } = req.query

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

      const { count, rows } = await QualityEnvInspection.findAndCountAll({
        where,
        include: [
          { model: QualityEnvArea, as: 'area', attributes: ['area_id', 'area_name'] },
        ],
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[EnvInspection] list error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await QualityEnvInspection.findByPk(Number(id), {
        include: [
          { model: QualityEnvArea, as: 'area', attributes: ['area_id', 'area_name', 'area_code'] },
          {
            model: QualityEnvInspectionItem,
            as: 'items',
            required: false,
            order: [['item_id', 'ASC']],
          },
        ],
      })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      success(res, record)
    } catch (err: any) {
      logger.error('[EnvInspection] detail error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async create(req: any, res: any) {
    const t = await QualityEnvInspection.sequelize.transaction()
    try {
      const {
        area_id,
        trigger_type,
        inspection_date,
        inspector_id,
        inspector_name,
        remarks,
      } = req.body

      if (!area_id) return fail(res, '区域ID不能为空', ErrorCode.PARAM_INVALID)

      const area = await QualityEnvArea.findByPk(Number(area_id))
      if (!area) return fail(res, '区域不存在', ErrorCode.RECORD_NOT_FOUND)

      const templates = await QualityEnvTemplate.findAll({
        where: { area_id, status: 1 },
        order: [['sort_order', 'ASC'], ['template_id', 'ASC']],
      })

      const inspectionNo = await generateInspectionNo()

      const record = await QualityEnvInspection.create({
        inspection_no: inspectionNo,
        area_id,
        area_name: area.area_name,
        trigger_type: trigger_type || '手工',
        status: 0,
        inspection_date: inspection_date || new Date(),
        inspector_id: inspector_id || null,
        inspector_name: inspector_name || '',
        remarks: remarks || '',
      }, { transaction: t })

      if (templates.length > 0) {
        const items = templates.map((tpl: any) => ({
          inspection_id: record.inspection_id,
          item_name: tpl.item_name,
          standard_value: tpl.standard_value,
          unit: tpl.unit,
          actual_value: '',
          judge: '',
          remark: '',
        }))
        await QualityEnvInspectionItem.bulkCreate(items, { transaction: t })
      }

      await t.commit()
      const detail = await QualityEnvInspection.findByPk(record.inspection_id, {
        include: [
          { model: QualityEnvArea, as: 'area', attributes: ['area_id', 'area_name', 'area_code'] },
          { model: QualityEnvInspectionItem, as: 'items', required: false, order: [['item_id', 'ASC']] },
        ],
      })
      success(res, detail, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[EnvInspection] create error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async update(req: any, res: any) {
    const t = await QualityEnvInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const {
        area_id,
        trigger_type,
        result,
        status,
        correction_action,
        recheck_date,
        recheck_result,
        inspector_id,
        inspector_name,
        inspection_date,
        remarks,
        items,
      } = req.body

      const record = await QualityEnvInspection.findByPk(Number(id))
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const updateData: any = {}
      if (area_id !== undefined) {
        updateData.area_id = area_id
        const area = await QualityEnvArea.findByPk(Number(area_id))
        if (area) updateData.area_name = area.area_name
      }
      if (trigger_type !== undefined) updateData.trigger_type = trigger_type
      if (result !== undefined) updateData.result = result
      if (status !== undefined) updateData.status = status
      if (correction_action !== undefined) updateData.correction_action = correction_action
      if (recheck_date !== undefined) updateData.recheck_date = recheck_date
      if (recheck_result !== undefined) updateData.recheck_result = recheck_result
      if (inspector_id !== undefined) updateData.inspector_id = inspector_id
      if (inspector_name !== undefined) updateData.inspector_name = inspector_name
      if (inspection_date !== undefined) updateData.inspection_date = inspection_date
      if (remarks !== undefined) updateData.remarks = remarks

      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }

      if (Array.isArray(items)) {
        // 先删除旧子项，再重建
        await QualityEnvInspectionItem.destroy({
          where: { inspection_id: Number(id) },
          transaction: t,
        })
        if (items.length > 0) {
          const bulk = items.map(it => ({
            inspection_id: Number(id),
            item_name: it.item_name || '',
            standard_value: it.standard_value || '',
            actual_value: it.actual_value || '',
            unit: it.unit || '',
            judge: it.judge || '',
            remark: it.remark || '',
          }))
          await QualityEnvInspectionItem.bulkCreate(bulk, { transaction: t })
        }
      }

      // 若所有子项都已判定，自动汇总总结果
      if (Array.isArray(items) && result === undefined) {
        const allJudge = items.map((it: any) => it.judge).filter(Boolean)
        if (allJudge.length > 0 && allJudge.length === items.filter((it: any) => it.judge).length) {
          const hasFail = allJudge.some((j: string) => j === '不合格')
          await record.update({ result: hasFail ? '不合格' : '合格' }, { transaction: t })
        }
      }

      await t.commit()
      const detail = await QualityEnvInspection.findByPk(Number(id), {
        include: [
          { model: QualityEnvArea, as: 'area', attributes: ['area_id', 'area_name', 'area_code'] },
          { model: QualityEnvInspectionItem, as: 'items', required: false, order: [['item_id', 'ASC']] },
        ],
      })
      success(res, detail, '更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[EnvInspection] update error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async delete(req: any, res: any) {
    const t = await QualityEnvInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await QualityEnvInspection.findByPk(Number(id))
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      // 先删子项
      await QualityEnvInspectionItem.destroy({
        where: { inspection_id: Number(id) },
        transaction: t,
      })
      await record.destroy({ transaction: t })
      await t.commit()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[EnvInspection] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ============ 区域 ============

  async listAreas(req: any, res: any) {
    try {
      const { tree = 0, status } = req.query
      const where: any = {}
      if (status !== undefined && status !== '') where.status = Number(status)

      const areas = await QualityEnvArea.findAll({
        where,
        order: [['sort_order', 'ASC'], ['area_id', 'ASC']],
      })

      if (String(tree) === '1') {
        const treeData = buildAreaTree(areas.map(a => a.toJSON()))
        return success(res, treeData)
      }
      success(res, areas)
    } catch (err: any) {
      logger.error('[EnvInspection] listAreas error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async createArea(req: any, res: any) {
    try {
      const { area_code, area_name, area_type, parent_id, sort_order, status, remarks } = req.body
      if (!area_name) return fail(res, '区域名称不能为空', ErrorCode.PARAM_INVALID)

      if (area_code) {
        const existed = await QualityEnvArea.findOne({ where: { area_code } })
        if (existed) return fail(res, '区域编码已存在', ErrorCode.RECORD_EXISTS)
      }

      if (parent_id) {
        const parent = await QualityEnvArea.findByPk(Number(parent_id))
        if (!parent) return fail(res, '父级区域不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const area = await QualityEnvArea.create({
        area_code: area_code || '',
        area_name,
        area_type: area_type || '',
        parent_id: parent_id || null,
        sort_order: sort_order || 0,
        status: status !== undefined ? status : 1,
        remarks: remarks || '',
      })
      success(res, area, '创建成功')
    } catch (err: any) {
      logger.error('[EnvInspection] createArea error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async updateArea(req: any, res: any) {
    try {
      const { id } = req.params
      const area = await QualityEnvArea.findByPk(Number(id))
      if (!area) return fail(res, '区域不存在', ErrorCode.RECORD_NOT_FOUND)

      const { area_code, area_name, area_type, parent_id, sort_order, status, remarks } = req.body
      const updateData: any = {}
      if (area_code !== undefined) {
        const existed = await QualityEnvArea.findOne({ where: { area_code, area_id: { [Op.ne]: Number(id) } } })
        if (existed) return fail(res, '区域编码已存在', ErrorCode.RECORD_EXISTS)
        updateData.area_code = area_code
      }
      if (area_name !== undefined) updateData.area_name = area_name
      if (area_type !== undefined) updateData.area_type = area_type
      if (parent_id !== undefined) {
        if (parent_id && Number(parent_id) === Number(id)) {
          return fail(res, '父级不能是自身', ErrorCode.PARAM_INVALID)
        }
        updateData.parent_id = parent_id || null
      }
      if (sort_order !== undefined) updateData.sort_order = sort_order
      if (status !== undefined) updateData.status = status
      if (remarks !== undefined) updateData.remarks = remarks

      await area.update(updateData)
      success(res, area, '更新成功')
    } catch (err: any) {
      logger.error('[EnvInspection] updateArea error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async deleteArea(req: any, res: any) {
    try {
      const { id } = req.params
      const area = await QualityEnvArea.findByPk(Number(id))
      if (!area) return fail(res, '区域不存在', ErrorCode.RECORD_NOT_FOUND)

      // 检查是否有子区域
      const children = await QualityEnvArea.findAll({ where: { parent_id: Number(id) } })
      if (children.length > 0) {
        return fail(res, '存在子区域，无法删除', ErrorCode.PARAM_INVALID)
      }
      // 检查是否有模板
      const templates = await QualityEnvTemplate.findAll({ where: { area_id: Number(id) } })
      if (templates.length > 0) {
        return fail(res, '区域下存在模板，无法删除', ErrorCode.PARAM_INVALID)
      }

      await area.destroy()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      logger.error('[EnvInspection] deleteArea error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ============ 模板 ============

  async listTemplates(req: any, res: any) {
    try {
      const { area_id, template_name, status } = req.query
      const where: any = {}
      if (area_id) where.area_id = area_id
      if (template_name) where.template_name = { [Op.like]: `%${template_name}%` }
      if (status !== undefined && status !== '') where.status = Number(status)

      const templates = await QualityEnvTemplate.findAll({
        where,
        include: [
          { model: QualityEnvArea, as: 'area', attributes: ['area_id', 'area_name'] },
        ],
        order: [['area_id', 'ASC'], ['sort_order', 'ASC'], ['template_id', 'ASC']],
      })
      success(res, templates)
    } catch (err: any) {
      logger.error('[EnvInspection] listTemplates error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async createTemplate(req: any, res: any) {
    try {
      const { template_name, area_id, item_name, standard_value, unit, test_method, sort_order, status } = req.body
      if (!template_name) return fail(res, '模板名称不能为空', ErrorCode.PARAM_INVALID)
      if (!item_name) return fail(res, '检验项目不能为空', ErrorCode.PARAM_INVALID)

      if (area_id) {
        const area = await QualityEnvArea.findByPk(Number(area_id))
        if (!area) return fail(res, '区域不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const tpl = await QualityEnvTemplate.create({
        template_name,
        area_id: area_id || null,
        item_name,
        standard_value: standard_value || '',
        unit: unit || '',
        test_method: test_method || '',
        sort_order: sort_order || 0,
        status: status !== undefined ? status : 1,
      })
      success(res, tpl, '创建成功')
    } catch (err: any) {
      logger.error('[EnvInspection] createTemplate error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async updateTemplate(req: any, res: any) {
    try {
      const { id } = req.params
      const tpl = await QualityEnvTemplate.findByPk(Number(id))
      if (!tpl) return fail(res, '模板不存在', ErrorCode.RECORD_NOT_FOUND)

      const { template_name, area_id, item_name, standard_value, unit, test_method, sort_order, status } = req.body
      const updateData: any = {}
      if (template_name !== undefined) updateData.template_name = template_name
      if (area_id !== undefined) {
        if (area_id) {
          const area = await QualityEnvArea.findByPk(Number(area_id))
          if (!area) return fail(res, '区域不存在', ErrorCode.RECORD_NOT_FOUND)
        }
        updateData.area_id = area_id || null
      }
      if (item_name !== undefined) updateData.item_name = item_name
      if (standard_value !== undefined) updateData.standard_value = standard_value
      if (unit !== undefined) updateData.unit = unit
      if (test_method !== undefined) updateData.test_method = test_method
      if (sort_order !== undefined) updateData.sort_order = sort_order
      if (status !== undefined) updateData.status = status

      await tpl.update(updateData)
      success(res, tpl, '更新成功')
    } catch (err: any) {
      logger.error('[EnvInspection] updateTemplate error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async deleteTemplate(req: any, res: any) {
    try {
      const { id } = req.params
      const tpl = await QualityEnvTemplate.findByPk(Number(id))
      if (!tpl) return fail(res, '模板不存在', ErrorCode.RECORD_NOT_FOUND)
      await tpl.destroy()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      logger.error('[EnvInspection] deleteTemplate error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async getTemplatesByArea(req: any, res: any) {
    try {
      const { areaId } = req.params
      const templates = await QualityEnvTemplate.findAll({
        where: { area_id: Number(areaId), status: 1 },
        order: [['sort_order', 'ASC'], ['template_id', 'ASC']],
      })
      success(res, templates)
    } catch (err: any) {
      logger.error('[EnvInspection] getTemplatesByArea error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
