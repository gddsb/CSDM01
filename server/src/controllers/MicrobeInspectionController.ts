import { Op } from 'sequelize'
import {
  MicrobeInspection,
  MicrobeInspectionItem,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

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
  return MicrobeInspection.findOne({
    where: { inspection_id: id },
    include: [
      {
        model: MicrobeInspectionItem,
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
        object_type,
        result,
        status,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (inspection_no) where.inspection_no = { [Op.like]: `%${inspection_no}%` }
      if (inspection_type) where.inspection_type = inspection_type
      if (object_type) where.object_type = object_type
      if (result) where.result = result

      const statusArr = parseStatusParam(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
        if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await MicrobeInspection.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      const allRows = await MicrobeInspection.findAll({ where, attributes: ['result', 'status', 'inspection_type', 'object_type'], raw: true })
      const stats = {
        total: count,
        pending: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 0 }).length,
        inspecting: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 1 }).length,
        reviewing: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 2 }).length,
        pass: allRows.filter(r => r.result === '合格').length,
        fail: allRows.filter(r => r.result === '不合格').length,
        normal: allRows.filter(r => r.inspection_type === '正常').length,
        strict: allRows.filter(r => r.inspection_type === '加严').length,
        recheck: allRows.filter(r => r.inspection_type === '复检').length,
        finished: allRows.filter(r => r.object_type === '成品检验').length,
        incoming: allRows.filter(r => r.object_type === '来料检验').length,
      }

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize, stats })
    } catch (err: any) {
      logger.error('[MicrobeInspection] list error:', err)
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
      success(res, record)
    } catch (err: any) {
      logger.error('[MicrobeInspection] detail error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async create(req: any, res: any) {
    const t = await MicrobeInspection.sequelize.transaction()
    try {
      const {
        inspection_type,
        object_type,
        report_order_id,
        incoming_id,
        order_id,
        standard_id,
        standard_name,
        trigger_type,
        remarks,
        items = [],
      } = req.body

      if (!object_type) return fail(res, '检验对象不能为空', ErrorCode.PARAM_INVALID)

      const record = await MicrobeInspection.create({
        inspection_no: 'MB' + Date.now(),
        inspection_type: inspection_type || '正常',
        object_type,
        report_order_id: report_order_id || null,
        incoming_id: incoming_id || null,
        order_id: order_id || null,
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
          standard_value: item.standard_value || '',
          actual_value: item.actual_value || '',
          unit: item.unit || '',
          result: convertItemResult(item.result),
          inspector_id: item.inspector_id || null,
          inspector_name: item.inspector_name || '',
          inspection_time: item.inspection_time ? new Date(item.inspection_time) : null,
          sort_order: item.sort_order !== undefined ? item.sort_order : idx,
          remarks: item.remarks || '',
        }))
        await MicrobeInspectionItem.bulkCreate(itemData, { transaction: t })
      }

      await t.commit()
      const detail = await getDetail(record.inspection_id)
      success(res, detail, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[MicrobeInspection] create error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async update(req: any, res: any) {
    const t = await MicrobeInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const {
        inspection_type,
        object_type,
        result,
        remarks,
        items,
      } = req.body

      const record = await MicrobeInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const updateData: any = {}
      if (inspection_type !== undefined) updateData.inspection_type = inspection_type
      if (object_type !== undefined) updateData.object_type = object_type
      if (result !== undefined) updateData.result = result
      if (remarks !== undefined) updateData.remarks = remarks

      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }

      if (items !== undefined) {
        await MicrobeInspectionItem.destroy({ where: { inspection_id: id }, transaction: t })
        if (items.length > 0) {
          const itemData = items.map((item: any, idx: number) => ({
            inspection_id: Number(id),
            item_name: item.item_name,
            standard_value: item.standard_value || '',
            actual_value: item.actual_value || '',
            unit: item.unit || '',
            result: convertItemResult(item.result),
            sort_order: item.sort_order !== undefined ? item.sort_order : idx,
            remarks: item.remarks || '',
          }))
          await MicrobeInspectionItem.bulkCreate(itemData, { transaction: t })
        }
      }

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[MicrobeInspection] update error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async delete(req: any, res: any) {
    const t = await MicrobeInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await MicrobeInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      await MicrobeInspectionItem.destroy({ where: { inspection_id: id }, transaction: t })
      await record.destroy({ transaction: t })
      await t.commit()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[MicrobeInspection] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
