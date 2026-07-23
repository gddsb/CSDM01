import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import {
  ReportOrder,
  ReportProcess,
  Order,
  ProductionLine,
  LineProcess,
  Process,
  Material,
  ManpowerRecord,
  ProcessDefect,
  ProcessException,
  ProcessMaterial,
  ReportImage,
  DefectType,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateReportOrderNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'

// 报工单状态: 0=开工, 1=完工, 2=关闭
const statusMap = { '开工': 0, '完工': 1, '关闭': 2 }

function isValidPositiveQty(val: any): boolean {
  if (val === undefined || val === null) return true
  const num = Number(val)
  return Number.isInteger(num) && num >= 0
}

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
  return Number(rows[0]?.total_qty || 0)
}

// 将状态参数（字符串/数字/数组）转换为整数数组
const parseStatusParam = (status) => {
  if (status === undefined || status === '') return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach(s => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach(p => {
        const n = statusMap[p] !== undefined ? statusMap[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = statusMap[s] !== undefined ? statusMap[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

// 从产线工序表继承工序到报工工序子表
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
        has_material: process.getDataValue('has_material'),
        must_report: process.getDataValue('must_report'),
        sort_order: lp.sort_order,
      })
    }
  }

  if (records.length > 0) {
    await ReportProcess.bulkCreate(records, opts)
  }

  return records.length
}

/**
 * 检查并联动更新订单状态
 * - 报工单创建后：若订单为"下发"，自动转为"开工"
 * - 报工单完工后：若该订单下所有报工单均"完工"，订单自动转为"完工"
 * - 报工单删除后：若无剩余报工单且订单为"开工"，可回退为"下发"
 */
export async function syncOrderStatus(orderId: number, transaction?: any) {
  const opts = transaction ? { transaction, lock: transaction.LOCK ? transaction.LOCK.UPDATE : undefined } : {}
  const countOpts = transaction ? { transaction } : {}

  const order = await Order.findOne({ where: { order_id: orderId }, ...opts })
  if (!order) return

  const statusVal = order.getDataValue('status')

  const total = await ReportOrder.count({
    where: { order_id: orderId, status: { [Op.ne]: 2 } },
    ...countOpts,
  })
  const finishedCount = await ReportOrder.count({
    where: { order_id: orderId, status: 1 },
    ...countOpts,
  })

  if (total > 0 && statusVal === 1) {
    await order.update({ status: 2 }, { transaction })
    return
  }

  if (total > 0 && finishedCount === total && statusVal === 2) {
    await order.update({ status: 3, close_time: new Date() }, { transaction })
    return
  }

  if (total === 0 && statusVal === 2) {
    await order.update({ status: 1, release_time: order.release_time || new Date() }, { transaction })
    return
  }
}

// 报工单列表
export const list = async (req, res) => {
  try {
    const {
      keyword,
      status,
      order_id,
      line_id,
      dateStart,
      dateEnd,
      page = 1,
      pageSize = 20,
    } = req.query

    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { report_no: { [Op.like]: `%${keyword}%` } },
        { order_no: { [Op.like]: `%${keyword}%` } },
        { material_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    const statusNums = parseStatusParam(status)
    if (statusNums) {
      where.status = statusNums.length === 1 ? statusNums[0] : { [Op.in]: statusNums }
    }
    if (order_id) where.order_id = Number(order_id)
    if (line_id) where.line_id = Number(line_id)
    if (dateStart || dateEnd) {
      where.report_time = {}
      if (dateStart) where.report_time[Op.gte] = new Date(dateStart)
      if (dateEnd) where.report_time[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ReportOrder.findAndCountAll({
      where,
      include: [
        {
          model: Material,
          as: 'material',
          attributes: ['material_code', 'specification', 'unit_name'],
          required: false,
        },
      ],
      limit,
      offset,
      order: [['report_no', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询报工单列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 报工单详情（含报工工序、人员、异常、不良、物料、图片）
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const reportOrder = await ReportOrder.findOne({
      where: { report_order_id: id },
      include: [
        { model: Order, as: 'order' },
        { model: Material, as: 'material', attributes: ['material_code', 'specification', 'unit_name'] },
        { model: ReportProcess, as: 'report_processes', order: [['sort_order', 'ASC']] as any },
        { model: ManpowerRecord, as: 'manpower_records' },
        { model: ProcessException, as: 'process_exceptions' },
        { model: ProcessDefect, as: 'process_defects' },
        { model: ProcessMaterial, as: 'process_materials' },
        { model: ReportImage, as: 'report_images' },
      ],
    })
    if (!reportOrder) return fail(res, '报工单不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, reportOrder, '查询成功')
  } catch (err) {
    console.error('查询报工单详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 创建报工单（自动生成报工单号 WO-16+YYMMDD+3位序号）
// 业务规则：仅"下发"/"开工"状态的订单可创建报工单；创建时从所选产线继承工序
// 幂等：同一 order_id + line_id + 当日 已存在则返回已有
export const create = async (req, res) => {
  try {
    const { order_id, line_id, report_qty, remarks } = req.body
    if (!order_id) return fail(res, '订单 ID 不能为空', ErrorCode.PARAM_INVALID)
    if (!line_id) return fail(res, '产线 ID 不能为空', ErrorCode.PARAM_INVALID)

    if (!isValidPositiveQty(report_qty)) {
      return fail(res, '报工数量必须是非负整数', ErrorCode.PARAM_INVALID)
    }

    const order = await Order.findOne({ where: { order_id } })
    if (!order) return fail(res, '订单不存在', ErrorCode.RECORD_NOT_FOUND)

    const orderStatus = order.getDataValue('status')
    if (orderStatus < 1) {
      return fail(res, '订单未下发，不允许创建报工单', ErrorCode.BUSINESS_ERROR)
    }
    if (orderStatus >= 4) {
      return fail(res, '订单已关闭，不允许创建报工单', ErrorCode.BUSINESS_ERROR)
    }

    const plannedQty = Number(order.getDataValue('planned_qty') || 0)
    if (plannedQty > 0 && report_qty !== undefined) {
      const sumQty = await sumReportQty(order_id)
      if (sumQty + Number(report_qty) > plannedQty) {
        return fail(res, `报工数量超出订单计划数量（已报${sumQty}，计划${plannedQty}）`, ErrorCode.BUSINESS_ERROR)
      }
    }

    const line = await ProductionLine.findOne({ where: { line_id } })
    if (!line) return fail(res, '产线不存在', ErrorCode.RECORD_NOT_FOUND)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const existing = await ReportOrder.findOne({
      where: {
        order_id,
        line_id,
        report_time: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
      },
    })
    if (existing) {
      logger.warn('[ReportOrder.create] 幂等命中：当日同产线已存在报工单', { order_id, line_id, report_order_id: existing.report_order_id })
      return success(res, existing, '当日同产线已存在报工单，返回已有记录')
    }

    const report_no = await generateReportOrderNo()

    const result = await sequelize.transaction(async (t) => {
      const reportOrder = await ReportOrder.create({
        report_no,
        order_id: order.order_id,
        order_no: order.order_no,
        line_id: line.line_id,
        line_name: line.line_name,
        material_id: order.material_id,
        material_code: order.material_code,
        material_name: order.material_name,
        specification: order.specification,
        report_qty: report_qty || 0,
        report_time: now,
        status: 0,
        report_user_id: req.user?.userId || null,
        report_user_name: req.user?.username || null,
        remarks,
      }, { transaction: t })

      await syncReportProcesses(reportOrder.report_order_id, line.line_id, t)

      await ManpowerRecord.create({
        report_order_id: reportOrder.report_order_id,
        record_date: now.toISOString().slice(0, 10),
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
        record_user: req.user?.username || null,
        record_user_name: req.user?.real_name || req.user?.username || null,
      }, { transaction: t })

      await syncOrderStatus(order_id, t)

      return reportOrder
    })

    logger.info('[ReportOrder.create] 报工单创建成功', { report_order_id: result.report_order_id, order_id, report_no: result.report_no, user: req.user?.username })
    return success(res, result, '创建成功')
  } catch (err) {
    console.error('创建报工单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改报工单（仅"开工"状态可修改）
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const reportOrder = await ReportOrder.findOne({ where: { report_order_id: id } })
    if (!reportOrder) return fail(res, '报工单不存在', ErrorCode.RECORD_NOT_FOUND)

    if (reportOrder.getDataValue('status') !== 0) {
      return fail(res, '当前报工单状态不允许修改', ErrorCode.BUSINESS_ERROR)
    }

    const { report_qty, line_id, remarks } = req.body

    if (report_qty !== undefined && !isValidPositiveQty(report_qty)) {
      return fail(res, '报工数量必须是非负整数', ErrorCode.PARAM_INVALID)
    }

    const updateData: any = {}
    if (report_qty !== undefined) updateData.report_qty = report_qty
    if (remarks !== undefined) updateData.remarks = remarks

    if (report_qty !== undefined) {
      const order = await Order.findOne({ where: { order_id: reportOrder.order_id } })
      if (order) {
        const plannedQty = Number(order.getDataValue('planned_qty') || 0)
        if (plannedQty > 0) {
          const sumQty = await sumReportQty(reportOrder.order_id, Number(id))
          if (sumQty + Number(report_qty) > plannedQty) {
            return fail(res, `报工数量超出订单计划数量（已报${sumQty}，计划${plannedQty}）`, ErrorCode.BUSINESS_ERROR)
          }
        }
      }
    }

    let newLineId: number | null = null
    let newLineName: string | null = null

    if (line_id && line_id !== reportOrder.line_id) {
      const [defectCount, materialCount, exceptionCount, manpowerCount, imageCount] = await Promise.all([
        ProcessDefect.count({ where: { report_order_id: id } }),
        ProcessMaterial.count({ where: { report_order_id: id } }),
        ProcessException.count({ where: { report_order_id: id } }),
        ManpowerRecord.count({ where: { report_order_id: id } }),
        ReportImage.count({ where: { report_order_id: id } }),
      ])
      const total = defectCount + materialCount + exceptionCount + manpowerCount + imageCount
      if (total > 0) {
        return fail(res, `该报工单已存在子表记录(不良${defectCount}/物料${materialCount}/异常${exceptionCount}/人员${manpowerCount}/图片${imageCount})，不允许切换产线`, ErrorCode.BUSINESS_ERROR)
      }

      const line = await ProductionLine.findOne({ where: { line_id } })
      if (!line) return fail(res, '产线不存在', ErrorCode.RECORD_NOT_FOUND)
      newLineId = line.line_id
      newLineName = line.line_name
      updateData.line_id = newLineId
      updateData.line_name = newLineName
    }

    if (newLineId !== null) {
      await sequelize.transaction(async (t) => {
        await reportOrder.update(updateData, { transaction: t })
        await syncReportProcesses(reportOrder.report_order_id, newLineId!, t)
      })
    } else if (Object.keys(updateData).length > 0) {
      await reportOrder.update(updateData)
    }

    return success(res, reportOrder, '修改成功')
  } catch (err) {
    console.error('修改报工单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除报工单（仅"开工"状态可删除，需无关联子记录）
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const reportOrder = await ReportOrder.findOne({ where: { report_order_id: id } })
    if (!reportOrder) return fail(res, '报工单不存在', ErrorCode.RECORD_NOT_FOUND)

    if (reportOrder.getDataValue('status') !== 0) {
      return fail(res, '只有开工状态的报工单可以删除', ErrorCode.BUSINESS_ERROR)
    }

    const orderId = reportOrder.order_id

    const [defectCount, materialCount, exceptionCount, manpowerCount, imageCount] = await Promise.all([
      ProcessDefect.count({ where: { report_order_id: id } }),
      ProcessMaterial.count({ where: { report_order_id: id } }),
      ProcessException.count({ where: { report_order_id: id } }),
      ManpowerRecord.count({ where: { report_order_id: id } }),
      ReportImage.count({ where: { report_order_id: id } }),
    ])
    const total = defectCount + materialCount + exceptionCount + manpowerCount + imageCount
    if (total > 0) {
      return fail(res, `该报工单存在关联记录(不良${defectCount}/物料${materialCount}/异常${exceptionCount}/人员${manpowerCount}/图片${imageCount})，无法删除`, ErrorCode.BUSINESS_ERROR)
    }

    await sequelize.transaction(async (t) => {
      await ReportProcess.destroy({ where: { report_order_id: id }, transaction: t })
      await ManpowerRecord.destroy({ where: { report_order_id: id }, transaction: t })
      await reportOrder.destroy({ transaction: t })
      await syncOrderStatus(orderId, t)
    })

    logger.info('[ReportOrder.remove] 报工单删除成功', { report_order_id: id, order_id: orderId, user: req.user?.username })
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除报工单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 完工报工单（开工 → 完工）
// 业务规则：报工单完工后联动订单状态：所有报工单均完工 → 订单完工
// 完工校验：
//  1. 报工单必须存在且状态为开工
//  2. 必须有工序记录
//  3. 无未关闭的异常记录
//  4. 必须报工的工序(must_report=1)需有不良或物料报工数据
//  5. 投入产出平衡（投入=产出，无损耗）
//  6. 人员记录有数据
//  7. 异常工时记录填写完整
export const finish = async (req, res) => {
  try {
    const { id } = req.params
    const reportOrderId = Number(id)

    const processCount = await ReportProcess.count({ where: { report_order_id: reportOrderId } })
    const openExceptionCount = await ProcessException.count({
      where: { report_order_id: reportOrderId, end_time: null },
    })
    if (processCount === 0) {
      return fail(res, '报工单无工序记录，不允许完工', ErrorCode.BUSINESS_ERROR)
    }
    if (openExceptionCount > 0) {
      return fail(res, `存在 ${openExceptionCount} 条未关闭的异常记录，请先关闭后再完工`, ErrorCode.BUSINESS_ERROR)
    }

    const mustReportProcesses = await ReportProcess.findAll({
      where: { report_order_id: reportOrderId, must_report: 1 },
      attributes: ['process_id', 'process_code', 'process_name'],
    })
    for (const mp of mustReportProcesses) {
      const defectCount = await ProcessDefect.count({
        where: { report_order_id: reportOrderId, process_id: mp.process_id },
      })
      const materialCount = await ProcessMaterial.count({
        where: { report_order_id: reportOrderId, process_id: mp.process_id },
      })
      if (defectCount === 0 && materialCount === 0) {
        return fail(res, `必须报工工序「${mp.process_name}(${mp.process_code})」未填写报工数据(不良/物料)`, ErrorCode.BUSINESS_ERROR)
      }
    }

    const manpowerCount = await ManpowerRecord.count({ where: { report_order_id: reportOrderId } })
    if (manpowerCount === 0) {
      return fail(res, '人员记录不能为空，请先填写人员记录', ErrorCode.BUSINESS_ERROR)
    }

    const exceptionList = await ProcessException.findAll({
      where: { report_order_id: reportOrderId },
      attributes: ['exception_id', 'start_time', 'end_time', 'duration', 'exception_type'],
    })
    for (const exc of exceptionList) {
      if (!exc.end_time) {
        return fail(res, `异常记录「${exc.exception_type}」未填写恢复时间`, ErrorCode.BUSINESS_ERROR)
      }
      if (!exc.duration || Number(exc.duration) <= 0) {
        return fail(res, `异常记录「${exc.exception_type}」未填写持续时长`, ErrorCode.BUSINESS_ERROR)
      }
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
      const investQty = firstProcessMaterials
        .filter(m => m.material_type === '投入')
        .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
      const returnQty = firstProcessMaterials
        .filter(m => m.material_type === '退回')
        .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
      inputQty = investQty - returnQty
    }

    const allDefects = await ProcessDefect.findAll({
      where: { report_order_id: reportOrderId },
      attributes: ['quantity'],
      include: [{
        model: DefectType,
        as: 'defect_type',
        attributes: ['defect_type'],
        required: false,
      }],
    })
    const defectQty = allDefects
      .filter(d => {
        const dt = (d as any).defect_type?.defect_type
        return dt !== '检验报废'
      })
      .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
    const scrapQty = allDefects
      .filter(d => (d as any).defect_type?.defect_type === '检验报废')
      .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)

    const expectedOutput = inputQty - defectQty - scrapQty
    const reportOrder = await ReportOrder.findOne({
      where: { report_order_id: reportOrderId },
      attributes: ['report_qty'],
    })
    const actualOutput = Number(reportOrder?.getDataValue('report_qty') || 0)
    if (inputQty > 0 && Math.abs(actualOutput - expectedOutput) > 0.001) {
      return fail(res, `投入产出不平衡：投入${inputQty} - 不良${defectQty} - 检验报废${scrapQty} = 预计产出${expectedOutput}，实际报工产出${actualOutput}`, ErrorCode.BUSINESS_ERROR)
    }

    const result = await sequelize.transaction(async (t) => {
      const reportOrder = await ReportOrder.findOne({
        where: { report_order_id: id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      })
      if (!reportOrder) {
        const err: any = new Error('报工单不存在')
        err.code = ErrorCode.RECORD_NOT_FOUND
        throw err
      }
      if (reportOrder.getDataValue('status') !== 0) {
        const err: any = new Error('当前报工单状态不允许完工')
        err.code = ErrorCode.BUSINESS_ERROR
        throw err
      }

      const order = await Order.findOne({
        where: { order_id: reportOrder.order_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      })

      await reportOrder.update({
        status: 1,
        finish_time: new Date(),
        finish_user_id: req.user?.userId || null,
        finish_user_name: req.user?.username || null,
      }, { transaction: t })

      if (order) {
        const finishedRows = await ReportOrder.findAll({
          where: { order_id: order.order_id, status: 1 },
          attributes: [[sequelize.fn('SUM', sequelize.col('report_qty')), 'finished_sum']],
          transaction: t,
          raw: true,
        })
        const finishedSum = Number(finishedRows[0]?.finished_sum || 0)
        await order.update({ finished_qty: finishedSum }, { transaction: t })
      }

      await syncOrderStatus(reportOrder.order_id, t)

      return reportOrder
    })

    logger.info('[ReportOrder.finish] 报工单完工成功', { report_order_id: id, order_id: result.order_id, report_order_no: result.report_order_no, user: req.user?.username })
    return success(res, result, '报工单已完工')
  } catch (err: any) {
    if (err && err.code) {
      return fail(res, err.message, err.code)
    }
    console.error('完工报工单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 关闭报工单（开工/完工 → 关闭）
// 关闭校验：无不良记录、无物料使用记录、无检验报废记录
export const close = async (req, res) => {
  try {
    const { id } = req.params
    const reportOrderId = Number(id)

    const defectCount = await ProcessDefect.count({ where: { report_order_id: reportOrderId } })
    const materialCount = await ProcessMaterial.count({ where: { report_order_id: reportOrderId } })

    const scrapCount = await ProcessDefect.count({
      where: { report_order_id: reportOrderId },
      include: [{
        model: DefectType,
        as: 'defect_type',
        attributes: [],
        where: { defect_type: '检验报废' },
        required: true,
      }],
    })

    if (defectCount > 0) {
      return fail(res, `该报工单存在 ${defectCount} 条不良记录，不允许关闭`, ErrorCode.BUSINESS_ERROR)
    }
    if (materialCount > 0) {
      return fail(res, `该报工单存在 ${materialCount} 条物料使用记录，不允许关闭`, ErrorCode.BUSINESS_ERROR)
    }
    if (scrapCount > 0) {
      return fail(res, `该报工单存在 ${scrapCount} 条检验报废记录，不允许关闭`, ErrorCode.BUSINESS_ERROR)
    }

    const result = await sequelize.transaction(async (t) => {
      const reportOrder = await ReportOrder.findOne({
        where: { report_order_id: id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      })
      if (!reportOrder) {
        const err: any = new Error('报工单不存在')
        err.code = ErrorCode.RECORD_NOT_FOUND
        throw err
      }
      const statusVal = reportOrder.getDataValue('status')
      if (statusVal === 2) {
        const err: any = new Error('报工单已关闭')
        err.code = ErrorCode.BUSINESS_ERROR
        throw err
      }

      await reportOrder.update({
        status: 2,
        close_time: new Date(),
        close_user_id: req.user?.userId || null,
        close_user_name: req.user?.username || null,
      }, { transaction: t })

      await syncOrderStatus(reportOrder.order_id, t)

      return reportOrder
    })

    logger.info('[ReportOrder.close] 报工单关闭成功', { report_order_id: id, order_id: result.order_id, report_order_no: result.report_order_no, user: req.user?.username })
    return success(res, result, '报工单已关闭')
  } catch (err: any) {
    if (err && err.code) {
      return fail(res, err.message, err.code)
    }
    console.error('关闭报工单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 获取报工单工序列表（继承自产线工序表）
export const getProcesses = async (req, res) => {
  try {
    const { id } = req.params
    const processes = await ReportProcess.findAll({
      where: { report_order_id: id },
      order: [['sort_order', 'ASC']],
    })
    return success(res, processes)
  } catch (err) {
    console.error('获取报工单工序失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove, finish, close, getProcesses, syncOrderStatus }
