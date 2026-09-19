/**
 * 工序不良 Service（ProcessDefectController 下沉）
 *
 * 业务规则：
 * - batchSave 先删旧后批量创建 + 总不良数量不能超过报工产出
 * - validateProcessBelongsToReportOrder 工序必须属于报工单
 * - 有 scrap（报废）子模块
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import { ProcessDefect, DefectType, ReportProcess, ReportOrder } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

// ---------- 纯函数 ----------

/** 构建不良列表 where（纯函数） */
export function buildDefectWhere(query: any): any {
  const where: any = {}
  const { report_order_id, process_id, defect_type_id } = query
  if (report_order_id) where.report_order_id = report_order_id
  if (process_id) where.process_id = process_id
  if (defect_type_id) where.defect_type_id = defect_type_id
  return where
}

// ---------- DB helper ----------

export async function validateProcessBelongsToReportOrder(reportOrderId: number, processId: number): Promise<void> {
  const exists = await ReportProcess.findOne({
    where: { report_order_id: reportOrderId, process_id: processId },
  })
  if (!exists) throw new AppError('该工序不属于当前报工单', 10001, 400)
}

export async function getReportOutputQty(reportOrderId: number): Promise<number> {
  const order = await ReportOrder.findOne({
    where: { report_order_id: reportOrderId },
    attributes: ['report_qty'],
  })
  return Number(order?.getDataValue('report_qty') || 0)
}

export async function sumDefectQty(reportOrderId: number, processId: number, excludeDefectId?: number): Promise<number> {
  const where: any = { report_order_id: reportOrderId, process_id: processId }
  if (excludeDefectId !== undefined) where.defect_id = { [Op.ne]: excludeDefectId }
  const rows = await ProcessDefect.findAll({
    where,
    attributes: [[sequelize.fn('SUM', sequelize.col('quantity')), 'total_qty']],
    raw: true,
  })
  return Number(rows[0]?.total_qty || 0)
}

// ---------- Service ----------

export const ProcessDefectService = {
  /** 不良记录列表 */
  async list(query: any) {
    const where = buildDefectWhere(query)
    return await ProcessDefect.findAll({
      where,
      include: [{ model: DefectType, as: 'defect_type', required: false }],
      order: [['process_id', 'ASC']],
    })
  },

  /** 报废列表（quantity 汇总 + 按 defect_type 分组） */
  async scrapList(reportOrderId: number) {
    const rows = await ProcessDefect.findAll({
      where: { report_order_id: reportOrderId },
      include: [{ model: DefectType, as: 'defect_type', required: false }],
    })
    return rows
  },

  /** 创建不良记录（process_id 必填） */
  async create(body: any) {
    if (!body.report_order_id) throw new AppError('报工单 ID 不能为空', 10001, 400)
    if (!body.process_id) throw new AppError('工序 ID 不能为空', 10001, 400)
    if (!body.defect_type_id) throw new AppError('不良类型不能为空', 10001, 400)
    const processId = Number(body.process_id)
    const qty = Number(body.quantity)
    if (!Number.isInteger(qty) || qty <= 0) throw new AppError('不良数量必须为正整数', 10001, 400)

    await validateProcessBelongsToReportOrder(Number(body.report_order_id), processId)

    const currentSum = await sumDefectQty(Number(body.report_order_id), processId)
    const outputQty = await getReportOutputQty(Number(body.report_order_id))
    if (outputQty > 0 && currentSum + qty > outputQty) {
      throw new AppError(
        `不良数量超出该工序报工产出（已报${currentSum}，新增${qty}，报工产出${outputQty}）`,
        20001, 409
      )
    }

    const defectType = await DefectType.findOne({ where: { defect_id: body.defect_type_id } })
    return await ProcessDefect.create({
      report_order_id: Number(body.report_order_id),
      process_id: processId,
      defect_type_id: body.defect_type_id,
      quantity: qty,
      unit: body.unit || defectType?.getDataValue('defect_unit') || '',
      defect_images: body.defect_images ? JSON.stringify(body.defect_images) : null,
    } as any)
  },

  /** 修改不良记录 */
  async update(id: number | string, body: any) {
    const defect = await ProcessDefect.findOne({ where: { defect_id: Number(id) } })
    if (!defect) throw new AppError('记录不存在', 10002, 404)

    const qty = body.defect_qty !== undefined ? body.defect_qty : body.quantity
    if (qty !== undefined) {
      const n = Number(qty)
      if (!Number.isInteger(n) || n < 0) throw new AppError('不良数量必须为非负整数', 10001, 400)

      // 修改后不能超报工产出
      const { report_order_id, process_id } = (defect as any)
      const currentSumExcl = await sumDefectQty(report_order_id, process_id, Number(id))
      const outputQty = await getReportOutputQty(report_order_id)
      if (outputQty > 0 && currentSumExcl + n > outputQty) {
        throw new AppError(
          `不良数量超出该工序报工产出（其他${currentSumExcl}，修改后${n}，报工产出${outputQty}）`,
          20001, 409
        )
      }
    }

    const updateData: any = {}
    if (body.defect_type_id !== undefined) {
      updateData.defect_type_id = body.defect_type_id
      const defectType = await DefectType.findOne({ where: { defect_id: body.defect_type_id } })
      const u = body.defect_unit !== undefined ? body.defect_unit : body.unit
      if (u !== undefined) updateData.unit = u || defectType?.getDataValue('defect_unit') || (defect as any).unit
    }
    if (qty !== undefined) updateData.quantity = Number(qty)
    if (body.defect_unit !== undefined) updateData.unit = body.defect_unit
    if (body.unit !== undefined) updateData.unit = body.unit
    if (body.defect_images !== undefined) updateData.defect_images = JSON.stringify(body.defect_images || [])

    await defect.update(updateData)
    return {
      ...(defect as any).toJSON(),
      defect_qty: (defect as any).quantity,
      defect_unit: (defect as any).unit,
      images: (defect as any).defect_images ? JSON.parse((defect as any).defect_images) : [],
    }
  },

  /** 删除不良记录 */
  async remove(id: number | string) {
    const defect = await ProcessDefect.findOne({ where: { defect_id: Number(id) } })
    if (!defect) throw new AppError('记录不存在', 10002, 404)
    await defect.destroy()
    return true
  },

  /** 批量保存（先删旧后批量创建，process_id 必填） */
  async batchSave(body: any) {
    if (!body.report_order_id) throw new AppError('报工单 ID 不能为空', 10001, 400)
    if (!body.process_id) throw new AppError('工序 ID 不能为空', 10001, 400)
    if (!Array.isArray(body.items)) throw new AppError('不良项目数据格式错误', 10001, 400)
    const processId = Number(body.process_id)

    await validateProcessBelongsToReportOrder(Number(body.report_order_id), processId)

    const validItems = body.items.filter((item: any) => item.defect_type_id && Number(item.quantity) > 0)

    const outputQty = await getReportOutputQty(Number(body.report_order_id))
    if (outputQty > 0) {
      const newTotalDefectQty = validItems.reduce((sum: number, item: any) => sum + Number(item.quantity), 0)
      if (newTotalDefectQty > outputQty) {
        throw new AppError(`不良数量超出该工序报工产出（合计${newTotalDefectQty}，报工产出${outputQty}）`, 20001, 409)
      }
    }

    const t = await sequelize.transaction()
    try {
      // 按 report_order_id + process_id 删旧
      const destroyWhere = { report_order_id: Number(body.report_order_id), process_id: processId }
      await ProcessDefect.destroy({ where: destroyWhere, transaction: t })

      const created: any[] = []
      for (const item of validItems) {
        const defectType = await DefectType.findOne({ where: { defect_id: item.defect_type_id } })
        const defect = await ProcessDefect.create({
          report_order_id: Number(body.report_order_id),
          process_id: processId,
          defect_type_id: item.defect_type_id,
          quantity: Number(item.quantity),
          unit: item.unit || (defectType?.getDataValue('defect_unit') || ''),
          defect_images: item.defect_images ? JSON.stringify(item.defect_images) : null,
        } as any, { transaction: t })
        created.push(defect)
      }

      await t.commit()
      return { count: created.length, items: created }
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  /** 报废创建（同 batchSave 语义，只数量更大） */
  async scrapCreate(body: any) {
    return await this.batchSave(body)
  },

  /** 报废更新（同 batchSave 覆盖语义） */
  async scrapUpdate(body: any) {
    return await this.batchSave(body)
  },
}

export default ProcessDefectService
