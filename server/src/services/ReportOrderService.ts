/**
 * 生产报工单业务逻辑（ReportOrderController 下沉）
 *
 * 状态机流转（finish/close）委托 ReportWorkflowService，
 * 本 Service 负责 CRUD + 复杂业务校验（超额报工/幂等/关联数据防删）+ 事务。
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import {
  ReportOrder,
  ReportProcess,
  Order,
  ProductionLine,
  LineProcess,
  Process,
  ManpowerRecord,
  ProcessDefect,
  ProcessException,
  ProcessMaterial,
  ReportImage,
} from '../models/index.js'
import { generateReportOrderNo } from '../utils/sequence.js'
import { nowBeijingDateStr, nowBeijingDate } from '../utils/date.js'
import { ReportWorkflowService } from './ProductionWorkflowService.js'
import { AppError } from '../utils/error.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'

// 报工单状态: 0=开工, 1=完工, 2=关闭
export const REPORT_STATUS_MAP: Record<string, number> = {
  '开工': 0, '完工': 1, '关闭': 2,
}

// ---------- 纯函数（可单测） ----------

/** 校验报工数量：非负整数；undefined/null 视为跳过 */
export function isValidPositiveQty(val: any): boolean {
  if (val === undefined || val === null) return true
  const num = Number(val)
  return Number.isInteger(num) && num >= 0
}

/** 将状态参数（字符串/数字/数组）转换为整数数组 */
export function parseReportStatusParam(status: any): number[] | null {
  if (status === undefined || status === '') return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  for (const s of arr) {
    const parts = typeof s === 'string' && s.includes(',') ? s.split(',') : [s]
    for (const p of parts) {
      const n = REPORT_STATUS_MAP[p as string] !== undefined
        ? REPORT_STATUS_MAP[p as string]
        : Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

/** 构建列表查询条件（纯函数） */
export function buildReportOrderWhere(query: any): any {
  const where: any = {}
  const { keyword, status, order_id, line_id, dateStart, dateEnd } = query

  if (keyword) {
    where[Op.or] = [
      { report_no: { [Op.like]: `%${keyword}%` } },
      { order_no: { [Op.like]: `%${keyword}%` } },
      { material_name: { [Op.like]: `%${keyword}%` } },
    ]
  }

  const statusNums = parseReportStatusParam(status)
  if (statusNums) {
    where.status = statusNums.length === 1 ? statusNums[0] : { [Op.in]: statusNums }
  }
  if (order_id) where.order_id = Number(order_id)
  if (line_id) where.line_id = Number(line_id)

  if (dateStart || dateEnd) {
    where.report_time = {}
    if (dateStart) where.report_time[Op.gte] = new Date(dateStart)
    if (dateEnd) where.report_time[Op.lte] = new Date(`${dateEnd} 23:59:59`)
  }

  return where
}

/** 超额报工阈值判断（纯函数，返回 needConfirm + confirmMsg） */
export function calcOverReportConfirm(
  plannedQty: number,
  sumQty: number,
  newReportQty: number
): { needConfirm: boolean; confirmMsg: string; remainingQty: number } {
  const remainingQty = Math.max(0, plannedQty - sumQty)
  if (plannedQty <= 0 || newReportQty <= 0) {
    return { needConfirm: false, confirmMsg: '', remainingQty }
  }

  let needConfirm = false
  let confirmMsg = ''

  if (plannedQty >= 10000) {
    const threshold = remainingQty * 1.05
    if (newReportQty > threshold && remainingQty > 0) {
      needConfirm = true
      confirmMsg = `报工数量(${newReportQty})超过未完工数量(${remainingQty})的5%，请确认是否继续`
    }
  } else {
    if (newReportQty - remainingQty > 500 && remainingQty > 0) {
      needConfirm = true
      confirmMsg = `报工数量(${newReportQty})超过未完工数量(${remainingQty})500以上，请确认是否继续`
    }
  }

  return { needConfirm, confirmMsg, remainingQty }
}

// ---------- DB helper（不是纯函数，但逻辑清晰可抽取） ----------

async function sumReportQty(orderId: number, excludeReportOrderId?: number): Promise<number> {
  const where: any = { order_id: orderId }
  if (excludeReportOrderId !== undefined) {
    where.report_order_id = { [Op.ne]: excludeReportOrderId }
  }
  const rows = await ReportOrder.findAll({
    where,
    attributes: [[sequelize.fn('SUM', sequelize.col('report_qty')), 'total_qty']],
    raw: true,
  })
  return Number((rows as any[])[0]?.total_qty || 0)
}

async function syncReportProcesses(reportOrderId: number, lineId: number, transaction?: any) {
  const opts = transaction ? { transaction } : {}

  await ReportProcess.destroy({ where: { report_order_id: reportOrderId }, ...opts })

  const lineProcesses = await LineProcess.findAll({
    where: { line_id: lineId, status: 1 },
    order: [['sort_order', 'ASC']],
    ...opts,
  })

  if (lineProcesses.length === 0) return 0

  const processIds = lineProcesses.map(lp => lp.process_id)
  const processes = await Process.findAll({
    where: { process_id: { [Op.in]: processIds } },
    ...opts,
  })
  const processMap = new Map(processes.map(p => [p.process_id, p]))

  const records: any[] = []
  for (const lp of lineProcesses) {
    const process = processMap.get(lp.process_id)
    if (process) {
      records.push({
        report_order_id: reportOrderId,
        process_id: process.process_id,
        process_code: process.process_code,
        process_name: process.process_name,
        has_material: (process as any).getDataValue('has_material'),
        must_report: (process as any).getDataValue('must_report'),
        sort_order: lp.sort_order,
      })
    }
  }

  if (records.length > 0) {
    await ReportProcess.bulkCreate(records, opts)
  }

  return records.length
}

async function getReportOrderWithOrder(reportOrderId: number) {
  return ReportOrder.findOne({
    where: { report_order_id: reportOrderId },
    include: [
      { model: Order, as: 'order', attributes: ['film_version', 'version_no', 'barcode'], required: false },
    ],
  })
}

// ---------- 业务 Service ----------

export interface ReportOrderCreateInput {
  order_id: number
  line_id: number
  report_qty?: number
  remarks?: string
  confirmed?: boolean
}

export interface ReportOrderUpdateInput {
  report_qty?: number
  line_id?: number
  remarks?: string
}

export const ReportOrderService = {
  /** 分页查询报工单列表 */
  async list(query: any) {
    const where = buildReportOrderWhere(query)
    const limit = Math.min(Number(query.pageSize) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit

    return await ReportOrder.findAndCountAll({
      where,
      include: [
        {
          model: Order.sequelize ? Order : (Order as any),
          as: 'order',
          attributes: ['film_version', 'version_no', 'barcode', 'planned_qty', 'status'],
          required: false,
        },
      ],
      limit,
      offset,
      order: [['report_no', 'DESC']],
    })
  },

  /** 报工单详情（含全部子表） */
  async detail(id: number | string) {
    const reportOrder = await ReportOrder.findOne({
      where: { report_order_id: Number(id) },
      include: [
        { model: Order, as: 'order' },
        { model: ReportProcess, as: 'report_processes', order: [['sort_order', 'ASC']] as any },
        { model: ManpowerRecord, as: 'manpower_records' },
        { model: ProcessException, as: 'process_exceptions' },
        { model: ProcessDefect, as: 'process_defects' },
        { model: ProcessMaterial, as: 'process_materials' },
        { model: ReportImage, as: 'report_images' },
      ],
    })
    if (!reportOrder) throw new AppError('报工单不存在', 10002, 404)
    return reportOrder
  },

  /** 创建报工单（含幂等 + 超额报工二次确认 + 事务） */
  async create(input: ReportOrderCreateInput, actor?: any) {
    if (!input.order_id) throw new AppError('订单 ID 不能为空', 10001, 400)
    if (!input.line_id) throw new AppError('产线 ID 不能为空', 10001, 400)
    if (!isValidPositiveQty(input.report_qty)) {
      throw new AppError('报工数量必须是非负整数', 10001, 400)
    }

    const order = await Order.findOne({ where: { order_id: input.order_id } })
    if (!order) throw new AppError('订单不存在', 10002, 404)

    const orderStatus = (order as any).getDataValue('status')
    if (orderStatus < 1) {
      throw new AppError('订单未下发，不允许创建报工单', 20001, 409)
    }
    if (orderStatus >= 4) {
      throw new AppError('订单已关闭，不允许创建报工单', 20001, 409)
    }

    // 超额报工校验
    const plannedQty = Number((order as any).getDataValue('planned_qty') || 0)
    if (plannedQty > 0 && input.report_qty !== undefined && Number(input.report_qty) > 0) {
      const sumQty = await sumReportQty(input.order_id)
      const result = calcOverReportConfirm(plannedQty, sumQty, Number(input.report_qty))
      if (result.needConfirm && !input.confirmed) {
        throw new AppError(result.confirmMsg, 20001, 409, {
          need_confirm: true,
          remaining_qty: result.remainingQty,
        })
      }
    }

    const line = await ProductionLine.findOne({ where: { line_id: input.line_id } })
    if (!line) throw new AppError('产线不存在', 10002, 404)

    // 幂等：当日同产线已存在则返回已有
    const now = nowBeijingDate()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const existing = await ReportOrder.findOne({
      where: {
        order_id: input.order_id,
        line_id: input.line_id,
        report_time: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
      },
    })
    if (existing) {
      return { idempotent: true, reportOrder: existing }
    }

    const report_no = await generateReportOrderNo()
    const transactionResult = await sequelize.transaction(async (t) => {
      const reportOrder = await ReportOrder.create({
        report_no,
        order_id: (order as any).order_id,
        order_no: (order as any).order_no,
        line_id: (line as any).line_id,
        line_name: (line as any).line_name,
        material_id: (order as any).material_id,
        material_code: (order as any).material_code,
        material_name: (order as any).material_name,
        specification: (order as any).specification,
        report_qty: input.report_qty || 0,
        report_time: now,
        status: 0,
        report_user_id: actor?.userId || null,
        report_user_name: actor?.username || null,
        remarks: input.remarks,
      } as any, { transaction: t })

      await syncReportProcesses(reportOrder.report_order_id, (line as any).line_id, t)

      await ManpowerRecord.create({
        report_order_id: reportOrder.report_order_id,
        record_date: nowBeijingDateStr(),
        shift: '白班',
        start_time: now,
        end_time: now,
        hours: 0,
        skilled_count: 0,
        general_count: 0,
        labor_count: 0,
        other_count: 0,
        total_people: 0,
        man_hours: 0,
        record_user: actor?.username || null,
        record_user_name: actor?.real_name || actor?.username || null,
      } as any, { transaction: t })

      await ProcessException.create({
        report_order_id: reportOrder.report_order_id,
        exception_type: '换型换线',
        start_time: now,
        end_time: null,
        duration: 0,
        description: '报工单创建时自动生成',
        record_user: actor?.username || null,
        record_user_name: actor?.real_name || actor?.username || null,
      } as any, { transaction: t })

      await ReportWorkflowService.syncOrderStatus(input.order_id, t)

      return reportOrder
    })

    return { idempotent: false, reportOrder: transactionResult }
  },

  /** 修改报工单（仅开工状态 + 数量/产线/备注） */
  async update(id: number | string, input: ReportOrderUpdateInput) {
    const reportOrder = await ReportOrder.findOne({ where: { report_order_id: Number(id) } })
    if (!reportOrder) throw new AppError('报工单不存在', 10002, 404)

    if ((reportOrder as any).getDataValue('status') !== 0) {
      throw new AppError('当前报工单状态不允许修改', 20001, 409)
    }

    if (input.report_qty !== undefined && !isValidPositiveQty(input.report_qty)) {
      throw new AppError('报工数量必须是非负整数', 10001, 400)
    }

    const updateData: any = {}
    if (input.report_qty !== undefined) updateData.report_qty = input.report_qty
    if (input.remarks !== undefined) updateData.remarks = input.remarks

    // 数量校验：修改后不能超过订单计划数量
    if (input.report_qty !== undefined) {
      const order = await Order.findOne({ where: { order_id: (reportOrder as any).order_id } })
      if (order) {
        const plannedQty = Number((order as any).getDataValue('planned_qty') || 0)
        if (plannedQty > 0) {
          const sumQty = await sumReportQty((reportOrder as any).order_id, Number(id))
          if (sumQty + Number(input.report_qty) > plannedQty) {
            throw new AppError(
              `报工数量超出订单计划数量（已报${sumQty}，计划${plannedQty}）`,
              20001, 409
            )
          }
        }
      }
    }

    // 产线切换：子表有数据则不允许
    let newLineId: number | null = null
    if (input.line_id && input.line_id !== (reportOrder as any).line_id) {
      const [defectCount, materialCount, exceptionCount, manpowerCount, imageCount] = await Promise.all([
        ProcessDefect.count({ where: { report_order_id: Number(id) } }),
        ProcessMaterial.count({ where: { report_order_id: Number(id) } }),
        ProcessException.count({ where: { report_order_id: Number(id) } }),
        ManpowerRecord.count({ where: { report_order_id: Number(id) } }),
        ReportImage.count({ where: { report_order_id: Number(id) } }),
      ])
      const total = defectCount + materialCount + exceptionCount + manpowerCount + imageCount
      if (total > 0) {
        throw new AppError(
          `该报工单已存在子表记录(不良${defectCount}/物料${materialCount}/异常${exceptionCount}/人员${manpowerCount}/图片${imageCount})，不允许切换产线`,
          20001, 409
        )
      }
      const line = await ProductionLine.findOne({ where: { line_id: input.line_id } })
      if (!line) throw new AppError('产线不存在', 10002, 404)
      newLineId = (line as any).line_id
      const newLineName: string = (line as any).line_name
      updateData.line_id = newLineId
      updateData.line_name = newLineName
    }

    // 事务：如果涉及产线切换，需要同步工序
    if (newLineId !== null) {
      await sequelize.transaction(async (t) => {
        await reportOrder.update(updateData, { transaction: t })
        await syncReportProcesses(reportOrder.report_order_id, newLineId!, t)
      })
    } else if (Object.keys(updateData).length > 0) {
      await reportOrder.update(updateData)
    }

    return reportOrder
  },

  /** 删除报工单（仅开工状态 + 无子表记录 + 事务） */
  async remove(id: number | string) {
    const reportOrder = await ReportOrder.findOne({ where: { report_order_id: Number(id) } })
    if (!reportOrder) throw new AppError('报工单不存在', 10002, 404)

    if ((reportOrder as any).getDataValue('status') !== 0) {
      throw new AppError('只有开工状态的报工单可以删除', 20001, 409)
    }

    const [defectCount, materialCount, imageCount] = await Promise.all([
      ProcessDefect.count({ where: { report_order_id: Number(id) } }),
      ProcessMaterial.count({ where: { report_order_id: Number(id) } }),
      ReportImage.count({ where: { report_order_id: Number(id) } }),
    ])
    if (defectCount + materialCount + imageCount > 0) {
      throw new AppError(
        `该报工单存在关联记录(不良${defectCount}/物料${materialCount}/图片${imageCount})，无法删除`,
        20001, 409
      )
    }

    const orderId = (reportOrder as any).order_id
    await sequelize.transaction(async (t) => {
      await ReportProcess.destroy({ where: { report_order_id: Number(id) }, transaction: t })
      await ManpowerRecord.destroy({ where: { report_order_id: Number(id) }, transaction: t })
      await ProcessException.destroy({ where: { report_order_id: Number(id) }, transaction: t })
      await reportOrder.destroy({ transaction: t })
      await ReportWorkflowService.syncOrderStatus(orderId, t)
    })

    return true
  },

  /** 获取报工单工序列表 */
  async getProcesses(id: number | string) {
    return await ReportProcess.findAll({
      where: { report_order_id: Number(id) },
      order: [['sort_order', 'ASC']],
    })
  },

  // ---------- 状态流转（委托 WorkflowService） ----------

  async finish(id: number | string, actor?: any) {
    const result = await ReportWorkflowService.finish(Number(id), actor)
    const full = await getReportOrderWithOrder(Number(id))
    return full || result
  },

  async close(id: number | string, actor?: any) {
    const result = await ReportWorkflowService.close(Number(id), actor)
    const full = await getReportOrderWithOrder(Number(id))
    return full || result
  },

  /** 导出兼容：内部直接调用 ReportWorkflowService.syncOrderStatus */
  async syncOrderStatus(orderId: number, transaction?: any) {
    return await ReportWorkflowService.syncOrderStatus(orderId, transaction)
  },
}

export default ReportOrderService
