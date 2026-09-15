/**
 * 来料检验业务 Service
 *
 * 状态流转委托 InspectionWorkflowService；
 * 检验子表写入委托 QcItemCompatHelper；
 * 同步外部系统（U9 采购收货）作为独立方法。
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import {
  IncomingInspection,
  Material,
  Supplier,
  InspectionStandardItem,
  QcInspectionItem,
  QcInspectionSampleValue,
  U9PurchaseReceipt,
} from '../models/index.js'
import { generateIncomingNo } from '../utils/sequence.js'
import { parseDateTime } from '../utils/date.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import {
  mapQcItemsToFrontend,
  replaceQcItems,
  deleteQcItemsForSource,
} from './QcItemCompatHelper.js'
import { recalcItemSampleCounts } from './SampleCountCalcService.js'
import { InspectionWorkflowService, INSPECTION_STATUS, toStatusNum } from './InspectionWorkflowService.js'
import { exportPurchaseReceipts } from './u9Exporter.js'
import logger from '../utils/logger.js'

export const INCOMING_STATUS_REVERSE: Record<string, number> = {
  '待检': 0, '检验中': 1, '审核中': 2, '已完成': 3, '已关闭': 4,
}

// ---------- 纯函数 ----------

export function parseIncomingStatusParam(status: any): number[] | null {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  for (const s of arr) {
    const parts = typeof s === 'string' && s.includes(',') ? s.split(',') : [s]
    for (const p of parts) {
      const n = INCOMING_STATUS_REVERSE[p as string] !== undefined
        ? INCOMING_STATUS_REVERSE[p as string]
        : Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

export function buildIncomingWhere(query: any): any {
  const where: any = {}
  const { inspection_no, supplier_id, supplier_name, material_code, material_name, result, status, start_date, end_date } = query

  if (inspection_no) where.inspection_no = { [Op.like]: `%${inspection_no}%` }
  if (supplier_id) where.supplier_id = supplier_id
  if (supplier_name) where.supplier_name = { [Op.like]: `%${supplier_name}%` }
  if (material_code) where.material_code = { [Op.like]: `%${material_code}%` }
  if (material_name) where.material_name = { [Op.like]: `%${material_name}%` }
  if (result) where.result = result

  const statusArr = parseIncomingStatusParam(status)
  if (statusArr) where.status = { [Op.in]: statusArr }

  if (start_date || end_date) {
    where.created_at = {}
    if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
    if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
  }

  return where
}

/** 从 InspectionStandardItem 构建检验项兜底数据（list/describe），纯函数 */
export function buildStandardFallbackItems(standardItems: any[], inspectionId: number, quantity: number): any[] {
  const items = standardItems.map((si: any, idx: number) => ({
    item_id: null,
    inspection_id: inspectionId,
    item_cfg_id: si.item_id,
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
    item_type: si.item_type ?? null,
    need_sample_count: si.need_sample_count ?? null,
    upper_limit: si.upper_limit ?? null,
    lower_limit: si.lower_limit ?? null,
    sampling_plan: si.sampling_plan ?? 'AQL抽样',
    sampling_detail: si.sampling_detail ?? null,
    accept_number: si.accept_number ?? null,
    reject_number: si.reject_number ?? null,
  }))
  return recalcItemSampleCounts(items, quantity)
}

// ---------- DB helper ----------

async function getIncomingDetail(id: number) {
  const record = await IncomingInspection.findOne({
    where: { inspection_id: id },
    include: [{
      model: QcInspectionItem,
      as: 'qc_items',
      required: false,
      separate: true,
      order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
      include: [{
        model: QcInspectionSampleValue,
        as: 'sample_values',
        required: false,
        separate: true,
      }],
    }],
  })
  if (!record) return null
  const json: any = (record as any).toJSON()
  json.items = mapQcItemsToFrontend(json.qc_items || [])
  delete json.qc_items
  return json
}

// ---------- Service ----------

export const IncomingInspectionService = {
  /** 列表 + 统计（带供应商短名二次查询 + 全量统计聚合） */
  async list(query: any) {
    const where = buildIncomingWhere(query)
    const pageNum = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.page_size) || 20))

    const { count, rows } = await IncomingInspection.findAndCountAll({
      where,
      order: [['arrival_date', 'DESC'], ['inspection_id', 'DESC']],
      limit: pageSize,
      offset: (pageNum - 1) * pageSize,
    })

    // 供应商短名填充
    const supplierIds = rows.map((r: any) => r.supplier_id).filter((id: any) => id != null)
    const supplierMap: Record<number, string> = {}
    if (supplierIds.length > 0) {
      const suppliers = await Supplier.findAll({
        where: { supplier_id: supplierIds },
        attributes: ['supplier_id', 'short_name'],
        raw: true,
      })
      suppliers.forEach((s: any) => { if (s.short_name) supplierMap[s.supplier_id] = s.short_name })
    }
    const list = rows.map((r: any) => {
      const obj = (r as any).toJSON ? (r as any).toJSON() : r
      if (supplierMap[obj.supplier_id]) obj.supplier_short_name = supplierMap[obj.supplier_id]
      return obj
    })

    // 统计
    const allRows = await IncomingInspection.findAll({
      where,
      attributes: ['result', 'status'],
      raw: true,
    })
    const stats = {
      total: count,
      pending: allRows.filter(r => toStatusNum(r) === INSPECTION_STATUS.PENDING).length,
      inspecting: allRows.filter(r => toStatusNum(r) === INSPECTION_STATUS.INSPECTING).length,
      reviewing: allRows.filter(r => toStatusNum(r) === INSPECTION_STATUS.REVIEWING).length,
      pass: allRows.filter((r: any) => r.result === '合格').length,
      fail: allRows.filter((r: any) => r.result === '不合格').length,
    }

    return { list, total: count, page: pageNum, page_size: pageSize, stats }
  },

  /** 详情（含检验标准兜底拉取 + 样本量重算） */
  async detail(id: number | string) {
    const result = await getIncomingDetail(Number(id))
    if (!result) throw new AppError('记录不存在', 10002, 404)

    if ((!result.items || result.items.length === 0) && result.standard_id) {
      const standardItems = await InspectionStandardItem.findAll({
        where: { standard_id: result.standard_id },
        order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
      })
      result.items = buildStandardFallbackItems(standardItems, result.inspection_id, result.quantity)
    }

    return result
  },

  /** 创建来料检验（事务 + 子表写入 + 自动编号） */
  async create(body: any) {
    if (!body.supplier_id) throw new AppError('供应商不能为空', 10001, 400)
    if (!body.material_id) throw new AppError('料品不能为空', 10001, 400)

    const material = await Material.findOne({ where: { material_id: body.material_id } })
    if (!material) throw new AppError('料品不存在', 10001, 400)

    const inspection_no = await generateIncomingNo()
    const t = await sequelize.transaction()
    try {
      const record = await IncomingInspection.create({
        inspection_no,
        supplier_id: body.supplier_id,
        supplier_name: body.supplier_name || '',
        supplier_code: body.supplier_code || '',
        material_id: body.material_id,
        material_code: (material as any).material_code || '',
        material_name: (material as any).material_name || '',
        specification: (material as any).specification || '',
        supplier_batch_no: body.supplier_batch_no || '',
        internal_batch_no: body.internal_batch_no || '',
        quantity: body.quantity || 0,
        arrival_date: body.arrival_date ? new Date(body.arrival_date) : null,
        standard_id: body.standard_id || null,
        standard_name: body.standard_name || '',
        handle_type: body.handle_type || '',
        handle_reason: body.handle_reason || '',
        trigger_type: body.trigger_type || '手工',
        status: INSPECTION_STATUS.PENDING,
        remarks: body.remarks,
      } as any, { transaction: t })

      if (body.items && body.items.length > 0) {
        await replaceQcItems('来料', (record as any).inspection_id, body.items, t)
      }

      await t.commit()
      return await getIncomingDetail(Number((record as any).inspection_id))
    } catch (err) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      throw err
    }
  },

  /** 修改来料检验（事务 + 状态校验） */
  async update(id: number | string, body: any) {
    const record = await IncomingInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    InspectionWorkflowService.assertCanEdit(record)

    const updateData: any = {}
    if (body.supplier_id !== undefined) updateData.supplier_id = body.supplier_id
    if (body.supplier_name !== undefined) updateData.supplier_name = body.supplier_name
    if (body.supplier_code !== undefined) updateData.supplier_code = body.supplier_code
    if (body.material_id !== undefined) {
      const material = await Material.findOne({ where: { material_id: body.material_id } })
      if (!material) throw new AppError('料品不存在', 10001, 400)
      updateData.material_id = body.material_id
      updateData.material_code = (material as any).material_code || ''
      updateData.material_name = (material as any).material_name || ''
      updateData.specification = (material as any).specification || ''
    }
    if (body.supplier_batch_no !== undefined) updateData.supplier_batch_no = body.supplier_batch_no
    if (body.internal_batch_no !== undefined) updateData.internal_batch_no = body.internal_batch_no
    if (body.quantity !== undefined) updateData.quantity = body.quantity
    if (body.arrival_date !== undefined) updateData.arrival_date = body.arrival_date ? new Date(body.arrival_date) : null
    if (body.standard_id !== undefined) updateData.standard_id = body.standard_id
    if (body.standard_name !== undefined) updateData.standard_name = body.standard_name
    if (body.handle_type !== undefined) updateData.handle_type = body.handle_type
    if (body.handle_reason !== undefined) updateData.handle_reason = body.handle_reason
    if (body.trigger_type !== undefined) updateData.trigger_type = body.trigger_type
    if (body.remarks !== undefined) updateData.remarks = body.remarks
    if (body.result !== undefined) updateData.result = body.result

    const t = await sequelize.transaction()
    try {
      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }
      if (body.items !== undefined) {
        await replaceQcItems('来料', Number(id), body.items || [], t)
      }
      await t.commit()
      return await getIncomingDetail(Number(id))
    } catch (err) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      throw err
    }
  },

  /** 开检（状态流转） */
  async start(id: number | string, actor?: any) {
    const record = await IncomingInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)
    InspectionWorkflowService.assertCanStart(record)

    await record.update(InspectionWorkflowService.buildStartPayload(actor))
    return await getIncomingDetail(Number(id))
  },

  /** 报审（状态流转） */
  async submit(id: number | string) {
    const record = await IncomingInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)
    InspectionWorkflowService.assertCanSubmit(record)

    await record.update({ status: INSPECTION_STATUS.REVIEWING })
    return true
  },

  /** 审核（状态流转 + 结果判定） */
  async review(id: number | string, result: string, remarks?: string, actor?: any) {
    const record = await IncomingInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    InspectionWorkflowService.assertCanReview(record)
    InspectionWorkflowService.assertValidReviewResult(result)

    await record.update(
      InspectionWorkflowService.buildReviewPayload(record, result, remarks, actor)
    )
    return await getIncomingDetail(Number(id))
  },

  /** 删除来料检验（事务 + 状态校验 + 子表清理） */
  async delete(id: number | string) {
    const record = await IncomingInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    InspectionWorkflowService.assertCanDelete(record)
    if ((record as any).trigger_type !== '手工') {
      throw new AppError('只有手工触发的记录可以删除', 10001, 400)
    }

    const t = await sequelize.transaction()
    try {
      await deleteQcItemsForSource('来料', Number(id), t)
      await record.destroy({ transaction: t })
      await t.commit()
      return true
    } catch (err) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      throw err
    }
  },

  /** U9 采购收货同步 → upsert 来料检验主表 */
  async syncFromPurchaseReceipts(): Promise<{ totalReceipts: number; created: number; updated: number }> {
    logger.info('[IncomingInspection] 开始采购入库同步...')
    await exportPurchaseReceipts('incoming-sync', (msg, pct) => {
      logger.info(`[IncomingInspection] 同步进度: ${msg} (${pct}%)`)
    })

    const receipts = await U9PurchaseReceipt.findAll({ raw: true }) as any[]

    const existingMap = new Map<string, any>()
    const existing = await IncomingInspection.findAll({
      where: {
        receipt_no: { [Op.ne]: null },
        [Op.and]: [{ receipt_no: { [Op.ne]: '' } }],
      },
      raw: true,
    })
    ;(existing as any[]).forEach((r: any) => {
      const key = `${r.receipt_no}|${r.line_no || ''}`
      existingMap.set(key, r)
    })

    let created = 0
    let updated = 0
    const t = await sequelize.transaction()
    try {
      for (const rc of receipts) {
        const key = `${rc.receipt_no}|${rc.line_no || ''}`
        const existingRecord = existingMap.get(key)
        const mappedData: any = {
          supplier_name: rc.supplier_name || '',
          supplier_code: rc.supplier_code || '',
          material_code: rc.material_code || '',
          material_name: rc.material_name || '',
          specification: rc.specification || '',
          supplier_batch_no: rc.supplier_lot_no || '',
          internal_batch_no: rc.receive_lot_no || '',
          quantity: rc.received_qty ? Number(rc.received_qty) : 0,
          arrival_date: rc.receipt_date ? parseDateTime(rc.receipt_date) : null,
          receipt_no: rc.receipt_no || '',
          line_no: rc.line_no || '',
          receipt_status: rc.status || '',
        }

        if (existingRecord) {
          await IncomingInspection.update(mappedData, {
            where: { inspection_id: existingRecord.inspection_id },
            transaction: t,
          })
          updated++
        } else {
          const inspection_no = await generateIncomingNo()
          await IncomingInspection.create({
            inspection_no,
            ...mappedData,
            trigger_type: '自动',
            status: INSPECTION_STATUS.PENDING,
          } as any, { transaction: t })
          created++
        }
      }
      await t.commit()
    } catch (err) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      throw err
    }

    logger.info(`[IncomingInspection] 采购入库同步完成：${receipts.length}条，新建${created}，更新${updated}`)
    return { totalReceipts: receipts.length, created, updated }
  },
}

export default IncomingInspectionService
