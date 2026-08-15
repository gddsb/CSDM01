import { Transaction } from 'sequelize'
import { Order, ReportOrder, ReportProcess, ProcessDefect, ProcessException, ProcessMaterial, ManpowerRecord, DefectType } from '../models/index.js'
import sequelize from '../config/database.js'
import { ErrorCode } from '../utils/response.js'
import { nowBeijingDate } from '../utils/date.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'

interface Actor {
  userId?: number | string
  username?: string
}

export class WorkflowError extends Error {
  code: number
  statusCode: number
  constructor(message: string, code = ErrorCode.BUSINESS_ERROR, statusCode = 400) {
    super(message)
    this.code = code
    this.statusCode = statusCode
  }
}

export class OrderWorkflowService {
  static async release(orderId: string | number, actor?: Actor) {
    const order = await Order.findOne({ where: { order_id: orderId } })
    if (!order) throw new WorkflowError('订单不存在', ErrorCode.RECORD_NOT_FOUND, 404)
    const statusVal = order.getDataValue('status') as number
    const releaseTime = order.getDataValue('release_time') as Date | null
    if (statusVal >= 1 && releaseTime) {
      logger.warn('[OrderWorkflowService.release] 幂等命中', { order_id: orderId, actor: actor?.username })
      return order
    }
    if (statusVal !== 0) throw new WorkflowError('只有开立状态的订单可以下发')
    await order.update({ status: 1, release_time: nowBeijingDate() })
    logger.info('[OrderWorkflowService.release] 订单下发成功', { order_id: orderId, order_no: order.getDataValue('order_no'), actor: actor?.username })
    return order
  }

  static async close(orderId: string | number, actor?: Actor) {
    const order = await Order.findOne({ where: { order_id: orderId } })
    if (!order) throw new WorkflowError('订单不存在', ErrorCode.RECORD_NOT_FOUND, 404)
    const statusVal = order.getDataValue('status') as number
    if (statusVal === 0) throw new WorkflowError('开立状态的订单请直接下发或删除，不能关闭')
    if (statusVal === 2) throw new WorkflowError('开工状态的订单不能关闭，请先完工')
    if (statusVal === 4) throw new WorkflowError('订单已关闭')
    await order.update({ status: 4, close_time: nowBeijingDate() })
    logger.info('[OrderWorkflowService.close] 订单关闭成功', { order_id: orderId, order_no: order.getDataValue('order_no'), actor: actor?.username })
    return order
  }

  static async finish(orderId: string | number, actor?: Actor) {
    const order = await Order.findOne({ where: { order_id: orderId } })
    if (!order) throw new WorkflowError('订单不存在', ErrorCode.RECORD_NOT_FOUND, 404)
    const statusVal = order.getDataValue('status') as number
    if (statusVal === 3) return order
    if (statusVal !== 2) throw new WorkflowError('只有开工状态的订单可以完工')
    await order.update({ status: 3, close_time: nowBeijingDate() })
    logger.info('[OrderWorkflowService.finish] 订单完工成功', { order_id: orderId, order_no: order.getDataValue('order_no'), actor: actor?.username })
    return order
  }
}

export class ReportWorkflowService {
  static async syncOrderStatus(orderId: number, transaction?: Transaction) {
    const opts: any = transaction ? { transaction, lock: transaction.LOCK ? transaction.LOCK.UPDATE : undefined } : {}
    const countOpts = transaction ? { transaction } : {}
    const order = await Order.findOne({ where: { order_id: orderId }, ...opts })
    if (!order) return
    const statusVal = order.getDataValue('status') as number
    const plannedQty = Number(order.getDataValue('planned_qty') || 0)
    const total = await ReportOrder.count({ where: { order_id: orderId }, ...countOpts })
    const finishedCount = await ReportOrder.count({ where: { order_id: orderId, status: 1 }, ...countOpts })
    const finishedRows = await ReportOrder.findAll({
      where: { order_id: orderId, status: 1 },
      attributes: [[sequelize.fn('SUM', sequelize.col('report_qty')), 'finished_sum']],
      ...countOpts,
      raw: true,
    })
    const finishedSum = Number((finishedRows[0] as any)?.finished_sum || 0)

    if (total > 0 && statusVal === 1) {
      await order.update({ status: 2 }, { transaction })
      return
    }
    if (total > 0 && finishedCount < total && statusVal === 3) {
      await order.update({ status: 2 }, { transaction })
      return
    }
    if (total > 0 && finishedCount === total && statusVal === 2) {
      await order.update({ status: 3, close_time: nowBeijingDate() }, { transaction })
      if (finishedSum >= plannedQty) {
        await order.update({ status: 4 }, { transaction })
      }
      return
    }
    if (statusVal === 3 && finishedSum >= plannedQty) {
      await order.update({ status: 4 }, { transaction })
      return
    }
    if (total === 0 && statusVal === 2) {
      await order.update({ status: 1, release_time: (order as any).release_time || nowBeijingDate() }, { transaction })
    }
  }

  static async validateFinish(reportOrderId: number) {
    const processCount = await ReportProcess.count({ where: { report_order_id: reportOrderId } })
    if (processCount === 0) throw new WorkflowError('报工单无工序记录，不允许完工')
    const openExceptionCount = await ProcessException.count({ where: { report_order_id: reportOrderId, end_time: null } })
    if (openExceptionCount > 0) throw new WorkflowError(`存在 ${openExceptionCount} 条未关闭的异常记录，请先关闭后再完工`)

    const mustReportProcesses = await ReportProcess.findAll({
      where: { report_order_id: reportOrderId, must_report: 1 },
      attributes: ['process_id', 'process_code', 'process_name'],
    })
    for (const mp of mustReportProcesses) {
      const defectCount = await ProcessDefect.count({ where: { report_order_id: reportOrderId, process_id: mp.process_id } })
      if (defectCount === 0) throw new WorkflowError(`必须报工工序「${mp.process_name}(${mp.process_code})」缺少：不良记录`)
    }

    const hasMaterialProcesses = await ReportProcess.findAll({
      where: { report_order_id: reportOrderId, has_material: 1 },
      attributes: ['process_id', 'process_code', 'process_name'],
    })
    for (const hp of hasMaterialProcesses) {
      const materialCount = await ProcessMaterial.count({ where: { report_order_id: reportOrderId, process_id: hp.process_id } })
      if (materialCount === 0) throw new WorkflowError(`引入物料工序「${hp.process_name}(${hp.process_code})」缺少：物料记录`)
    }

    const manpowerCount = await ManpowerRecord.count({ where: { report_order_id: reportOrderId } })
    if (manpowerCount === 0) throw new WorkflowError('人员记录不能为空，请先填写人员记录')

    const exceptionList = await ProcessException.findAll({
      where: { report_order_id: reportOrderId },
      attributes: ['exception_id', 'start_time', 'end_time', 'duration', 'exception_type'],
    })
    for (const exc of exceptionList) {
      if (!exc.end_time) throw new WorkflowError(`异常记录「${exc.exception_type}」未填写恢复时间`)
      if (!exc.duration || Number(exc.duration) <= 0) throw new WorkflowError(`异常记录「${exc.exception_type}」未填写持续时长`)
    }

    const reportProcesses = await ReportProcess.findAll({
      where: { report_order_id: reportOrderId },
      order: [['sort_order', 'ASC']],
      attributes: ['process_id', 'sort_order'],
    })
    let inputQty = 0
    if (reportProcesses.length > 0) {
      const firstProcessId = reportProcesses[0].process_id
      const firstProcessMaterials = await ProcessMaterial.findAll({
        where: { report_order_id: reportOrderId, process_id: firstProcessId },
        attributes: ['material_type', 'quantity'],
      })
      const investQty = firstProcessMaterials.filter(m => m.material_type === '投入').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
      const returnQty = firstProcessMaterials.filter(m => m.material_type === '退回').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
      inputQty = investQty - returnQty
    }

    const allDefects = await ProcessDefect.findAll({
      where: { report_order_id: reportOrderId },
      attributes: ['quantity'],
      include: [{ model: DefectType, as: 'defect_type', attributes: ['defect_type'], required: false }],
    })
    const defectQty = allDefects.filter(d => (d as any).defect_type?.defect_type !== '检验报废').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
    const scrapQty = allDefects.filter(d => (d as any).defect_type?.defect_type === '检验报废').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
    const expectedOutput = inputQty - defectQty - scrapQty
    const reportOrderRecord = await ReportOrder.findOne({ where: { report_order_id: reportOrderId }, attributes: ['report_qty'] })
    const actualOutput = Number(reportOrderRecord?.getDataValue('report_qty') || 0)
    const outputDiff = actualOutput - expectedOutput
    if (inputQty > 0 && outputDiff < 0) {
      throw new WorkflowError(`投入产出不平衡：投入${inputQty} - 不良${defectQty} - 检验报废${scrapQty} = 预计产出${expectedOutput}，实际报工产出${actualOutput}，实际产出不能少于预计产出`)
    }
  }

  static async validateClose(reportOrderId: number) {
    const defectCount = await ProcessDefect.count({ where: { report_order_id: reportOrderId } })
    const materialCount = await ProcessMaterial.count({ where: { report_order_id: reportOrderId } })
    const scrapCount = await ProcessDefect.count({
      where: { report_order_id: reportOrderId },
      include: [{ model: DefectType, as: 'defect_type', attributes: [], where: { defect_type: '检验报废' }, required: true }],
    })
    if (defectCount > 0) throw new WorkflowError(`该报工单存在 ${defectCount} 条不良记录，不允许关闭`)
    if (materialCount > 0) throw new WorkflowError(`该报工单存在 ${materialCount} 条物料使用记录，不允许关闭`)
    if (scrapCount > 0) throw new WorkflowError(`该报工单存在 ${scrapCount} 条检验报废记录，不允许关闭`)
  }

  static async finish(reportOrderId: number, actor?: Actor) {
    await this.validateFinish(reportOrderId)
    const result = await sequelize.transaction(async (t) => {
      const reportOrder = await ReportOrder.findOne({ where: { report_order_id: reportOrderId }, transaction: t, lock: t.LOCK.UPDATE })
      if (!reportOrder) throw new WorkflowError('报工单不存在', ErrorCode.RECORD_NOT_FOUND, 404)
      if (reportOrder.getDataValue('status') !== 0) throw new WorkflowError('当前报工单状态不允许完工')
      const order = await Order.findOne({ where: { order_id: (reportOrder as any).order_id }, transaction: t, lock: t.LOCK.UPDATE })
      await reportOrder.update({
        status: 1,
        finish_time: nowBeijingDate(),
        finish_user_id: actor?.userId || null,
        finish_user_name: actor?.username || null,
      }, { transaction: t })
      if (order) {
        const finishedRows = await ReportOrder.findAll({
          where: { order_id: order.order_id, status: 1 },
          attributes: [[sequelize.fn('SUM', sequelize.col('report_qty')), 'finished_sum']],
          transaction: t,
          raw: true,
        })
        const finishedSum = Number((finishedRows[0] as any)?.finished_sum || 0)
        await order.update({ finished_qty: finishedSum }, { transaction: t })
      }
      await this.syncOrderStatus((reportOrder as any).order_id, t)
      return reportOrder
    })
    logger.info('[ReportWorkflowService.finish] 报工单完工成功', { report_order_id: reportOrderId, order_id: (result as any).order_id, report_order_no: (result as any).report_order_no, actor: actor?.username })
    return result
  }

  static async close(reportOrderId: number, actor?: Actor) {
    await this.validateClose(reportOrderId)
    const result = await sequelize.transaction(async (t) => {
      const reportOrder = await ReportOrder.findOne({ where: { report_order_id: reportOrderId }, transaction: t, lock: t.LOCK.UPDATE })
      if (!reportOrder) throw new WorkflowError('报工单不存在', ErrorCode.RECORD_NOT_FOUND, 404)
      if (reportOrder.getDataValue('status') === 1) throw new WorkflowError('报工单已完工')
      await reportOrder.update({
        status: 1,
        close_time: nowBeijingDate(),
        close_user_id: actor?.userId || null,
        close_user_name: actor?.username || null,
      }, { transaction: t })
      await this.syncOrderStatus((reportOrder as any).order_id, t)
      return reportOrder
    })
    logger.info('[ReportWorkflowService.close] 报工单关闭成功', { report_order_id: reportOrderId, order_id: (result as any).order_id, report_order_no: (result as any).report_order_no, actor: actor?.username })
    return result
  }
}

export { AppError }
