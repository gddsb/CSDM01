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

/** 完工前预检项 —— 前端弹窗展示，block 禁止完工 / warn 提示 / pass 通过 */
export interface FinishCheckItem {
  level: 'pass' | 'warn' | 'block'
  category: string
  label: string
  detail: string
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

  /** 完工前预检 —— 返回结构化 check items 给前端弹窗，不同于 validateFinish 单条 throw */
  static async preCheckFinish(reportOrderId: number): Promise<FinishCheckItem[]> {
    const items: FinishCheckItem[] = []

    // 1. 必报工序不良记录
    const mustReport = await ReportProcess.findAll({
      where: { report_order_id: reportOrderId, must_report: 1 },
      attributes: ['process_id', 'process_name', 'process_code'],
    })
    let mustDone = 0
    for (const mp of mustReport) {
      const c = await ProcessDefect.count({ where: { report_order_id: reportOrderId, process_id: mp.process_id } })
      if (c > 0) mustDone++
    }
    if (mustReport.length === 0) {
      items.push({ level: 'warn', category: '工序', label: '无必报工序', detail: '未标记必须报工工序，建议确认是否完整' })
    } else if (mustDone === mustReport.length) {
      items.push({ level: 'pass', category: '工序', label: `必报工序 ${mustDone}/${mustReport.length} 已完成`, detail: '全部必报工序都已有不良记录' })
    } else {
      items.push({ level: 'block', category: '工序', label: `必报工序 ${mustDone}/${mustReport.length} 未完成`,
        detail: `${mustReport.length - mustDone} 个必报工序缺少不良记录` })
    }

    // 2. 未关闭异常
    const openExceptions = await ProcessException.findAll({
      where: { report_order_id: reportOrderId, end_time: null },
      attributes: ['exception_type'],
    })
    if (openExceptions.length === 0) {
      items.push({ level: 'pass', category: '异常', label: '无未关闭异常', detail: '所有异常记录均已结束' })
    } else {
      const types = openExceptions.map(e => e.exception_type || '未命名').filter(Boolean).join('、')
      items.push({ level: 'block', category: '异常', label: `${openExceptions.length} 条异常未关闭`,
        detail: `${types} 未填写结束时间，请点"结束"补完工时` })
    }

    // 3. 异常时长完整性
    const allExceptions = await ProcessException.findAll({
      where: { report_order_id: reportOrderId },
      attributes: ['exception_type', 'duration'],
    })
    const badDurations = allExceptions.filter(e => !e.duration || Number(e.duration) <= 0)
    if (allExceptions.length > 0) {
      if (badDurations.length === 0) {
        items.push({ level: 'pass', category: '异常', label: '异常时长已填写', detail: '所有异常记录持续时长有效' })
      } else {
        const types = badDurations.map(e => e.exception_type || '').filter(Boolean).join('、')
        items.push({ level: 'block', category: '异常', label: `${badDurations.length} 条异常未填时长`,
          detail: `${types} 的持续时长为空或无效` })
      }
    }

    // 4. 人员记录
    const manpower = await ManpowerRecord.findOne({ where: { report_order_id: reportOrderId } })
    if (!manpower) {
      items.push({ level: 'block', category: '人员', label: '人员记录未填写', detail: '请至少填写一项人员配置（技工/普工/劳务/其他）' })
    } else {
      const filled = [
        Number(manpower.skilled_workers || 0),
        Number(manpower.regular_workers || 0),
        Number(manpower.labor_workers || 0),
        Number(manpower.other_workers || 0),
      ].reduce((s, v) => s + v, 0)
      const openedTotal = Number(manpower.total_workers || 0)
      if (filled === 0) {
        items.push({ level: 'block', category: '人员', label: '人员配置为 0',
          detail: openedTotal > 0 ? `开工登记 ${openedTotal} 人，但所有类型配置都是 0` : '所有人员类型数量都是 0' })
      } else {
        items.push({ level: 'pass', category: '人员', label: `人员配置 ${filled} 人`,
          detail: openedTotal > 0 && openedTotal !== filled ? `开工登记 ${openedTotal} 人 vs 配置 ${filled} 人` : '人员配置已填写' })
      }
    }

    // 5. 引入物料工序
    const hasMaterialProcesses = await ReportProcess.findAll({
      where: { report_order_id: reportOrderId, has_material: 1 },
    })
    if (hasMaterialProcesses.length === 0) {
      items.push({ level: 'pass', category: '物料', label: '无引入物料工序', detail: '不需要物料工序' })
    } else {
      let matOk = 0
      for (const hp of hasMaterialProcesses) {
        const c = await ProcessMaterial.count({ where: { report_order_id: reportOrderId, process_id: hp.process_id } })
        if (c > 0) matOk++
      }
      if (matOk === hasMaterialProcesses.length) {
        items.push({ level: 'pass', category: '物料', label: `物料工序 ${matOk}/${hasMaterialProcesses.length} 已完成`, detail: '所有引入物料工序都有物料记录' })
      } else {
        items.push({ level: 'block', category: '物料', label: `物料工序 ${matOk}/${hasMaterialProcesses.length} 未完成`,
          detail: `${hasMaterialProcesses.length - matOk} 个工序缺少物料记录` })
      }
    }

    // 6. 投入产出平衡
    let inputQty = 0
    const firstProcess = await ReportProcess.findOne({
      where: { report_order_id: reportOrderId },
      order: [['sort_order', 'ASC']],
      attributes: ['process_id'],
    })
    if (firstProcess) {
      const firstMats = await ProcessMaterial.findAll({
        where: { report_order_id: reportOrderId, process_id: firstProcess.process_id },
        attributes: ['material_type', 'quantity'],
      })
      const investQty = firstMats.filter(m => m.material_type === '投入').reduce((s, m) => s + (Number(m.quantity) || 0), 0)
      const returnQty = firstMats.filter(m => m.material_type === '退回').reduce((s, m) => s + (Number(m.quantity) || 0), 0)
      inputQty = investQty - returnQty
    }
    const allDefects = await ProcessDefect.findAll({
      where: { report_order_id: reportOrderId },
      attributes: ['quantity'],
      include: [{ model: DefectType, as: 'defect_type', attributes: ['defect_type'], required: false }],
    })
    const defectQty = allDefects.filter(d => (d as any).defect_type?.defect_type !== '检验报废').reduce((s, d) => s + (Number(d.quantity) || 0), 0)
    const scrapQty = allDefects.filter(d => (d as any).defect_type?.defect_type === '检验报废').reduce((s, d) => s + (Number(d.quantity) || 0), 0)
    const expectedOutput = inputQty - defectQty - scrapQty
    const ro = await ReportOrder.findOne({ where: { report_order_id: reportOrderId }, attributes: ['report_qty'] })
    const actualOutput = Number(ro?.getDataValue('report_qty') || 0)

    if (inputQty <= 0) {
      items.push({ level: 'warn', category: '产出', label: '无法计算产出平衡', detail: '首道工序没有物料投入记录' })
    } else {
      const diff = actualOutput - expectedOutput
      if (diff < 0) {
        items.push({ level: 'block', category: '产出', label: '投入产出不平衡',
          detail: `投入${inputQty} - 不良${defectQty} - 报废${scrapQty} = 应产出${expectedOutput}，实际报工${actualOutput}，差${-diff}个` })
      } else if (diff > inputQty * 0.05) {
        items.push({ level: 'warn', category: '产出', label: `产出超出应产出${Math.round(diff)}个`,
          detail: `投入${inputQty}，应产出${expectedOutput}，实际${actualOutput}，多${diff}个去向不明` })
      } else {
        items.push({ level: 'pass', category: '产出', label: '投入产出平衡',
          detail: `产出 ${actualOutput} / 应产出 ${expectedOutput}（投入${inputQty}）` })
      }
    }

    // 7. 工序数量
    const processCount = await ReportProcess.count({ where: { report_order_id: reportOrderId } })
    if (processCount === 0) {
      items.push({ level: 'block', category: '工序', label: '无工序记录', detail: '报工单没有绑定工序' })
    }

    return items
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
