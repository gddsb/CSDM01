/**
 * 产品检验业务 Service
 *
 * 与 IncomingInspectionService 共用 InspectionWorkflowService，
 * 差异点：数据源 Model 是 ProductInspection，关联 ReportOrder 而非 Material/Supplier。
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import {
  ProductInspection,
  ReportOrder,
  InspectionStandardItem,
  QcInspectionItem,
  QcInspectionSampleValue,
} from '../models/index.js'
import { generateProductInspectionNo } from '../utils/sequence.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import {
  mapQcItemsToFrontend,
  replaceQcItems,
  deleteQcItemsForSource,
} from './QcItemCompatHelper.js'
import { recalcItemSampleCounts } from './SampleCountCalcService.js'
import { InspectionWorkflowService, INSPECTION_STATUS } from './InspectionWorkflowService.js'
import { buildStandardFallbackItems, parseIncomingStatusParam } from './IncomingInspectionService.js'
import logger from '../utils/logger.js'

export const PRODUCT_STATUS_REVERSE: Record<string, number> = {
  '待检': 0, '检验中': 1, '审核中': 2, '已完成': 3, '已关闭': 4,
}

// ---------- 纯函数 ----------

export function parseProductStatusParam(status: any): number[] | null {
  // 与来料检验状态映射相同，直接复用
  return parseIncomingStatusParam(status)
}

export function buildProductWhere(query: any): any {
  const where: any = {}
  const { inspection_no, inspection_type, report_order_id, result, status, trigger_type, start_date, end_date } = query

  if (inspection_no) where.inspection_no = { [Op.like]: `%${inspection_no}%` }
  if (inspection_type) where.inspection_type = inspection_type
  if (report_order_id) where.report_order_id = report_order_id
  if (result) where.result = result
  if (trigger_type) where.trigger_type = trigger_type

  const statusArr = parseProductStatusParam(status)
  if (statusArr) where.status = { [Op.in]: statusArr }

  if (start_date || end_date) {
    where.created_at = {}
    if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
    if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
  }

  return where
}

// ---------- DB helper ----------

async function getProductDetail(id: number) {
  const record = await ProductInspection.findOne({
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

export const ProductInspectionService = {
  /** 列表 + 统计 */
  async list(query: any) {
    const where = buildProductWhere(query)
    const pageNum = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.page_size) || 20))

    const { count, rows } = await ProductInspection.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (pageNum - 1) * pageSize,
    })

    // 统计（比来料检验多 inspection_type 维度）
    const allRows = await ProductInspection.findAll({
      where,
      attributes: ['result', 'status', 'inspection_type'],
      raw: true,
    }) as any[]
    const stats = {
      total: count,
      pending: allRows.filter(r => PRODUCT_STATUS_REVERSE[String(r.status)] === INSPECTION_STATUS.PENDING).length,
      inspecting: allRows.filter(r => PRODUCT_STATUS_REVERSE[String(r.status)] === INSPECTION_STATUS.INSPECTING).length,
      reviewing: allRows.filter(r => PRODUCT_STATUS_REVERSE[String(r.status)] === INSPECTION_STATUS.REVIEWING).length,
      pass: allRows.filter(r => r.result === '合格').length,
      fail: allRows.filter(r => r.result === '不合格').length,
      first: allRows.filter(r => r.inspection_type === '首件').length,
      process: allRows.filter(r => r.inspection_type === '制程').length,
      finished: allRows.filter(r => r.inspection_type === '成品').length,
    }

    return { list: rows, total: count, page: pageNum, page_size: pageSize, stats }
  },

  /** 详情（含检验标准兜底 + 样本量重算） */
  async detail(id: number | string) {
    const result = await getProductDetail(Number(id))
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

  /** 创建产品检验（事务 + 关联报工单冗余字段） */
  async create(body: any) {
    if (!body.inspection_type) throw new AppError('检验类型不能为空', 10001, 400)
    if (!body.report_order_id) throw new AppError('关联报工单不能为空', 10001, 400)

    const reportOrder = await ReportOrder.findOne({ where: { report_order_id: body.report_order_id } })
    if (!reportOrder) throw new AppError('报工单不存在', 10001, 400)

    const inspection_no = await generateProductInspectionNo(body.inspection_type)
    const t = await sequelize.transaction()
    try {
      const record = await ProductInspection.create({
        inspection_no,
        inspection_type: body.inspection_type,
        report_order_id: body.report_order_id,
        report_order_no: (reportOrder as any).report_no,
        material_id: (reportOrder as any).material_id,
        material_code: (reportOrder as any).material_code,
        material_name: (reportOrder as any).material_name,
        specification: (reportOrder as any).specification,
        standard_id: body.standard_id || null,
        standard_name: body.standard_name || '',
        trigger_type: body.trigger_type || '手工',
        status: INSPECTION_STATUS.PENDING,
        remarks: body.remarks,
      } as any, { transaction: t })

      if (body.items && body.items.length > 0) {
        await replaceQcItems('产品', (record as any).inspection_id, body.items, t)
      }

      await t.commit()
      return await getProductDetail(Number((record as any).inspection_id))
    } catch (err) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      throw err
    }
  },

  /** 修改产品检验（事务 + 状态校验 + 关联报工单更换） */
  async update(id: number | string, body: any) {
    const record = await ProductInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    InspectionWorkflowService.assertCanEdit(record)

    const updateData: any = {}
    if (body.inspection_type !== undefined) updateData.inspection_type = body.inspection_type
    if (body.report_order_id !== undefined) {
      const reportOrder = await ReportOrder.findOne({ where: { report_order_id: body.report_order_id } })
      if (!reportOrder) throw new AppError('报工单不存在', 10001, 400)
      updateData.report_order_id = body.report_order_id
      updateData.report_order_no = (reportOrder as any).report_no
      updateData.material_id = (reportOrder as any).material_id
      updateData.material_code = (reportOrder as any).material_code
      updateData.material_name = (reportOrder as any).material_name
      updateData.specification = (reportOrder as any).specification
    }
    if (body.standard_id !== undefined) updateData.standard_id = body.standard_id
    if (body.standard_name !== undefined) updateData.standard_name = body.standard_name
    if (body.trigger_type !== undefined) updateData.trigger_type = body.trigger_type
    if (body.remarks !== undefined) updateData.remarks = body.remarks
    if (body.result !== undefined) updateData.result = body.result

    const t = await sequelize.transaction()
    try {
      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }
      if (body.items !== undefined) {
        await replaceQcItems('产品', Number(id), body.items || [], t)
      }
      await t.commit()
      return await getProductDetail(Number(id))
    } catch (err) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      throw err
    }
  },

  /** 开检 */
  async start(id: number | string, actor?: any) {
    const record = await ProductInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)
    InspectionWorkflowService.assertCanStart(record)

    await record.update(InspectionWorkflowService.buildStartPayload(actor))
    return await getProductDetail(Number(id))
  },

  /** 报审 */
  async submit(id: number | string) {
    const record = await ProductInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)
    InspectionWorkflowService.assertCanSubmit(record)

    await record.update({ status: INSPECTION_STATUS.REVIEWING })
    return true
  },

  /** 审核 */
  async review(id: number | string, result: string, remarks?: string, actor?: any) {
    const record = await ProductInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    InspectionWorkflowService.assertCanReview(record)
    InspectionWorkflowService.assertValidReviewResult(result)

    await record.update(
      InspectionWorkflowService.buildReviewPayload(record, result, remarks, actor)
    )
    return await getProductDetail(Number(id))
  },

  /** 删除（事务 + 状态校验 + 子表清理） */
  async delete(id: number | string) {
    const record = await ProductInspection.findOne({ where: { inspection_id: Number(id) } })
    if (!record) throw new AppError('记录不存在', 10002, 404)

    InspectionWorkflowService.assertCanDelete(record)
    if ((record as any).trigger_type !== '手工') {
      throw new AppError('只有手工触发的记录可以删除', 10001, 400)
    }

    const t = await sequelize.transaction()
    try {
      await deleteQcItemsForSource('产品', Number(id), t)
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
}

export default ProductInspectionService
