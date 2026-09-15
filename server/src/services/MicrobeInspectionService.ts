/**
 * 微生物检验 Service（MicrobeInspectionController 下沉）
 *
 * 带事务 + QcItemCompatHelper 集成（阶段 3.6 停双写，直接写新统一子表）
 * STATUS_REVERSE 解析：'待检'/0, '检验中'/1, '审核中'/2, '已完成'/3, '已关闭'/4
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import { MicrobeInspection, QcInspectionItem, QcInspectionSampleValue } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import { mapQcItemsToFrontend, replaceQcItems, deleteQcItemsForSource } from './QcItemCompatHelper.js'

const STATUS_REVERSE: Record<string, number> = { '待检': 0, '检验中': 1, '审核中': 2, '已完成': 3, '已关闭': 4 }

function parseStatusParam(status: any): number[] | null {
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
  const record = await MicrobeInspection.findOne({
    where: { inspection_id: id },
    include: [{
      model: QcInspectionItem, as: 'qc_items', required: false, separate: true,
      order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
      include: [{ model: QcInspectionSampleValue, as: 'sample_values', required: false, separate: true }],
    }],
  })
  if (!record) return null
  const json: any = record.toJSON()
  json.items = mapQcItemsToFrontend(json.qc_items || [])
  delete json.qc_items
  return json
}

export const MicrobeInspectionService = {
  async list(query: any) {
    const {
      page = 1, page_size = 20, inspection_no, inspection_type, object_type, result, status, start_date, end_date,
    } = query

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
      where, order: [['created_at', 'DESC']], limit: pageSize, offset: (pageNum - 1) * pageSize,
    })

    // 统计（同步查一次全量状态列，避免对 N 个 category 各做一次查询）
    const allRows = await MicrobeInspection.findAll({ where, attributes: ['result', 'status', 'inspection_type', 'object_type'], raw: true })
    const toStatusNum = (r: any) => typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status
    const stats = {
      total: count,
      pending: allRows.filter(r => toStatusNum(r) === 0).length,
      inspecting: allRows.filter(r => toStatusNum(r) === 1).length,
      reviewing: allRows.filter(r => toStatusNum(r) === 2).length,
      pass: allRows.filter(r => r.result === '合格').length,
      fail: allRows.filter(r => r.result === '不合格').length,
      normal: allRows.filter(r => r.inspection_type === '正常').length,
      strict: allRows.filter(r => r.inspection_type === '加严').length,
      recheck: allRows.filter(r => r.inspection_type === '复检').length,
      finished: allRows.filter(r => r.object_type === '成品检验').length,
      incoming: allRows.filter(r => r.object_type === '来料检验').length,
    }
    return { list: rows, total: count, page: pageNum, page_size: pageSize, stats }
  },

  async detail(id: number | string) {
    const record = await getDetail(Number(id))
    if (!record) throw new AppError('记录不存在', 10002, 404)
    return record
  },

  async create(body: any) {
    const t = await sequelize.transaction()
    try {
      const { inspection_type, object_type, report_order_id, incoming_id, order_id, standard_id, standard_name, trigger_type, remarks, items = [] } = body
      if (!object_type) throw new AppError('检验对象不能为空', 10001, 400)

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
      } as any, { transaction: t })

      if (items && items.length > 0) {
        await replaceQcItems('微生物', record.inspection_id, items, t)
      }
      await t.commit()
      return await getDetail(record.inspection_id)
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  async update(id: number | string, body: any) {
    const t = await sequelize.transaction()
    try {
      const record = await MicrobeInspection.findOne({ where: { inspection_id: Number(id) } })
      if (!record) throw new AppError('记录不存在', 10002, 404)

      const updateData: any = {}
      for (const key of ['inspection_type', 'object_type', 'result', 'remarks']) {
        if (body[key] !== undefined) updateData[key] = body[key]
      }
      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }
      if (body.items !== undefined) {
        await replaceQcItems('微生物', Number(id), body.items || [], t)
      }
      await t.commit()
      return await getDetail(Number(id))
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  async delete(id: number | string) {
    const t = await sequelize.transaction()
    try {
      const record = await MicrobeInspection.findOne({ where: { inspection_id: Number(id) } })
      if (!record) throw new AppError('记录不存在', 10002, 404)
      await deleteQcItemsForSource('微生物', Number(id), t)
      await record.destroy({ transaction: t })
      await t.commit()
      return true
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },
}

export default MicrobeInspectionService
