import { Op } from 'sequelize'
import {
  ProductInspection,
  ProductInspectionItem,
  ReportOrder,
  InspectionStandard,
  InspectionStandardItem,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateProductInspectionNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'
import { nowBeijingDate, parseDateTime } from '../utils/date.js'
// 检验数据统一存储改造（阶段1.7）：双写统一子表
import { syncQcItems, deleteQcItems } from '../services/QcInspectionItemSync.js'

const STATUS_REVERSE: Record<string, number> = { '待检': 0, '检验中': 1, '审核中': 2, '已完成': 3, '已关闭': 4 }

const parseStatusParam = (status: any): number[] | null => {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach((s: any) => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach((p: string) => {
        const n = STATUS_REVERSE[p] !== undefined ? STATUS_REVERSE[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = STATUS_REVERSE[s] !== undefined ? STATUS_REVERSE[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

async function getDetail(id: number) {
  return ProductInspection.findOne({
    where: { inspection_id: id },
    include: [
      {
        model: ProductInspectionItem,
        as: 'items',
        order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
      },
    ],
  })
}

const convertItemResult = (v: any) => {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v === '合格' ? 1 : 0
  return v
}

export default {
  async list(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        inspection_no,
        inspection_type,
        report_order_id,
        result,
        status,
        trigger_type,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (inspection_no) where.inspection_no = { [Op.like]: `%${inspection_no}%` }
      if (inspection_type) where.inspection_type = inspection_type
      if (report_order_id) where.report_order_id = report_order_id
      if (result) where.result = result
      if (trigger_type) where.trigger_type = trigger_type

      const statusArr = parseStatusParam(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
        if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await ProductInspection.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      const allRows = await ProductInspection.findAll({ where, attributes: ['result', 'status', 'inspection_type'], raw: true })
      const stats = {
        total: count,
        pending: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 0 }).length,
        inspecting: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 1 }).length,
        reviewing: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 2 }).length,
        pass: allRows.filter(r => r.result === '合格').length,
        fail: allRows.filter(r => r.result === '不合格').length,
        first: allRows.filter(r => r.inspection_type === '首件').length,
        process: allRows.filter(r => r.inspection_type === '制程').length,
        finished: allRows.filter(r => r.inspection_type === '成品').length,
      }

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize, stats })
    } catch (err: any) {
      logger.error('[ProductInspection] list error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await getDetail(Number(id))
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const result: any = record.toJSON ? record.toJSON() : record
      if ((!result.items || result.items.length === 0) && result.standard_id) {
        const standardItems = await InspectionStandardItem.findAll({
          where: { standard_id: result.standard_id },
          order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
        })
        result.items = standardItems.map((si: any, idx: number) => ({
          item_id: null,
          inspection_id: result.inspection_id,
          item_name: si.item_name,
          standard_value: si.standard_value || '',
          actual_value: '',
          result: null,
          inspector_id: null,
          inspector_name: '',
          inspection_time: null,
          sort_order: si.sort_order !== undefined ? si.sort_order : idx,
          remarks: '',
          category: si.category,
          unit: si.unit,
        }))
      }
      success(res, result)
    } catch (err: any) {
      logger.error('[ProductInspection] detail error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async create(req: any, res: any) {
    const t = await ProductInspection.sequelize.transaction()
    try {
      const {
        inspection_type,
        report_order_id,
        standard_id,
        standard_name,
        trigger_type,
        remarks,
        items = [],
      } = req.body

      if (!inspection_type) return fail(res, '检验类型不能为空', ErrorCode.PARAM_INVALID)
      if (!report_order_id) return fail(res, '关联报工单不能为空', ErrorCode.PARAM_INVALID)

      const reportOrder = await ReportOrder.findOne({ where: { report_order_id: report_order_id } })
      if (!reportOrder) return fail(res, '报工单不存在', ErrorCode.PARAM_INVALID)

      const inspection_no = await generateProductInspectionNo(inspection_type)

      const record = await ProductInspection.create({
        inspection_no,
        inspection_type,
        report_order_id,
        report_order_no: reportOrder.report_no,
        material_id: reportOrder.material_id,
        material_code: reportOrder.material_code,
        material_name: reportOrder.material_name,
        specification: reportOrder.specification,
        standard_id: standard_id || null,
        standard_name: standard_name || '',
        trigger_type: trigger_type || '手工',
        status: 0,
        remarks,
      }, { transaction: t })

      if (items && items.length > 0) {
        const itemData = items.map((item: any, idx: number) => ({
          inspection_id: record.inspection_id,
          item_name: item.item_name,
          category: item.category || '',
          standard_value: item.standard_value || '',
          actual_value: item.actual_value || '',
          result: convertItemResult(item.result),
          inspector_id: item.inspector_id || null,
          inspector_name: item.inspector_name || '',
          inspection_time: item.inspection_time ? new Date(item.inspection_time) : null,
          sort_order: item.sort_order !== undefined ? item.sort_order : idx,
          remarks: item.remarks || '',
        }))
        await ProductInspectionItem.bulkCreate(itemData, { transaction: t })
        // 检验数据统一存储改造（阶段1.7）：双写统一子表
        await syncQcItems('产品', record.inspection_id, itemData, t)
      }

      await t.commit()

      const detail = await getDetail(record.inspection_id)
      success(res, detail, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[ProductInspection] create error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async update(req: any, res: any) {
    const t = await ProductInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const {
        inspection_type,
        report_order_id,
        standard_id,
        standard_name,
        trigger_type,
        remarks,
        result,
        items,
      } = req.body

      const record = await ProductInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal >= 2) {
        return fail(res, '审核中及以后的状态不可修改', ErrorCode.PARAM_INVALID)
      }

      const updateData: any = {}
      if (inspection_type !== undefined) updateData.inspection_type = inspection_type
      if (report_order_id !== undefined) {
        const reportOrder = await ReportOrder.findOne({ where: { report_order_id: report_order_id } })
        if (!reportOrder) return fail(res, '报工单不存在', ErrorCode.PARAM_INVALID)
        updateData.report_order_id = report_order_id
        updateData.report_order_no = reportOrder.report_no
        updateData.material_id = reportOrder.material_id
        updateData.material_code = reportOrder.material_code
        updateData.material_name = reportOrder.material_name
        updateData.specification = reportOrder.specification
      }
      if (standard_id !== undefined) updateData.standard_id = standard_id
      if (standard_name !== undefined) updateData.standard_name = standard_name
      if (trigger_type !== undefined) updateData.trigger_type = trigger_type
      if (remarks !== undefined) updateData.remarks = remarks
      if (result !== undefined) updateData.result = result

      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }

      if (items !== undefined) {
        await ProductInspectionItem.destroy({ where: { inspection_id: id }, transaction: t })
        // 检验数据统一存储改造（阶段1.7）：同步清理旧 qc_items
        await deleteQcItems('产品', Number(id), t)
        if (items.length > 0) {
          const user: any = req.user || {}
          const now = nowBeijingDate()
          const itemData = items.map((item: any, idx: number) => ({
            inspection_id: Number(id),
            item_name: item.item_name,
            category: item.category || '',
            standard_value: item.standard_value || '',
            actual_value: item.actual_value || '',
            result: convertItemResult(item.result),
            inspector_id: user.userId || null,
            inspector_name: user.realName || user.username || '',
            inspection_time: now,
            sort_order: item.sort_order !== undefined ? item.sort_order : idx,
            remarks: item.remarks || '',
          }))
          await ProductInspectionItem.bulkCreate(itemData, { transaction: t })
          // 检验数据统一存储改造（阶段1.7）：双写统一子表
          await syncQcItems('产品', Number(id), itemData, t)
        }
      }

      await t.commit()

      const detail = await getDetail(Number(id))
      success(res, detail, '更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[ProductInspection] update error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async start(req: any, res: any) {
    try {
      const { id } = req.params
      const user: any = req.user || {}
      const record = await ProductInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 0) {
        return fail(res, '只有待检状态可以开检', ErrorCode.PARAM_INVALID)
      }

      const now = nowBeijingDate()
      await record.update({
        status: 1,
        inspector_id: user.userId || null,
        inspector_name: user.realName || user.username || '',
        inspection_time: now,
      })
      const detail = await getDetail(Number(id))
      success(res, detail, '开检成功')
    } catch (err: any) {
      logger.error('[ProductInspection] start error:', err)
      fail(res, err.message || '开检失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async submit(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await ProductInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 1) {
        return fail(res, '只有检验中状态可以报审', ErrorCode.PARAM_INVALID)
      }

      await record.update({ status: 2 })
      success(res, { message: '报审成功' }, '报审成功')
    } catch (err: any) {
      logger.error('[ProductInspection] submit error:', err)
      fail(res, err.message || '报审失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async review(req: any, res: any) {
    try {
      const { id } = req.params
      const { result, remarks } = req.body
      const user: any = req.user || {}

      if (result !== '合格' && result !== '不合格') {
        return fail(res, '审核结果必须为合格或不合格', ErrorCode.PARAM_INVALID)
      }

      const record = await ProductInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 2) {
        return fail(res, '只有审核中状态可以审核', ErrorCode.PARAM_INVALID)
      }

      const now = nowBeijingDate()
      const targetStatus = result === '合格' ? 3 : 1
      await record.update({
        status: targetStatus,
        result,
        reviewer_id: user.userId || null,
        reviewer_name: user.realName || user.username || '',
        review_time: now,
        remarks: remarks !== undefined ? remarks : record.remarks,
      })

      const detail = await getDetail(Number(id))
      success(res, detail, '审核成功')
    } catch (err: any) {
      logger.error('[ProductInspection] review error:', err)
      fail(res, err.message || '审核失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async delete(req: any, res: any) {
    const t = await ProductInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await ProductInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 0) {
        return fail(res, '只有待检状态可以删除', ErrorCode.PARAM_INVALID)
      }

      if (record.trigger_type !== '手工') {
        return fail(res, '只有手工触发的记录可以删除', ErrorCode.PARAM_INVALID)
      }

      await ProductInspectionItem.destroy({ where: { inspection_id: id }, transaction: t })
      // 检验数据统一存储改造（阶段1.7）：同步清理 qc_items + sample_values
      await deleteQcItems('产品', Number(id), t)
      await record.destroy({ transaction: t })
      await t.commit()

      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[ProductInspection] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
