/**
 * DailyReportService — 制罐车间生产日报表数据聚合
 *
 * 只读聚合 6 张现有表，不改动任何表结构：
 *   ReportOrder            主表（生产批号 + 入库数量）
 *   ProcessMaterial        投入/退回数量 + 印铁批号
 *   ProcessDefect          不良记录（关联 DefectType）
 *   DefectType             不良名称 + 分类
 *   ManpowerRecord         人员 + 总工时
 *   ProcessException       停机记录 + 异常工时
 *   Material               料边 scrap_weight(g)
 */

import { Op } from 'sequelize'
import ReportOrder from '../models/ReportOrder.js'
import ProcessMaterial from '../models/ProcessMaterial.js'
import ProcessDefect from '../models/ProcessDefect.js'
import DefectType from '../models/DefectType.js'
import ManpowerRecord from '../models/ManpowerRecord.js'
import ProcessException from '../models/ProcessException.js'
import Material from '../models/Material.js'

/** PDF 停机代号 A-E → exception_type 映射表 */
const STOP_CODE_MAP: Record<string, string[]> = {
  A: ['待料', '物料短缺'],
  B: ['换型换线'],
  C: ['工艺问题', '质量异常'],
  D: ['设备故障'],
  E: ['人员短缺'],
}
const STOP_CODE_REVERSE: Record<string, string> = {}
for (const [code, types] of Object.entries(STOP_CODE_MAP)) {
  for (const t of types) STOP_CODE_REVERSE[t] = code
}

function mapStopCode(type: string | null | undefined): string {
  if (!type) return 'E'
  return STOP_CODE_REVERSE[type] || 'E'
}

/** PDF 班次：用人力表 shift 字段，早班/中班→白班，晚班→晚班 */
function mapShift(shift: string | null | undefined): string {
  if (!shift) return ''
  if (shift.includes('晚')) return '晚班'
  return '白班'
}

/** 日期范围：当天 00:00:00 ~ 23:59:59（无 TZ 标记，依赖服务器本地时区解析） */
function dateRange(dateStr: string): [Date, Date] {
  const start = new Date(dateStr + ' 00:00:00')
  const end = new Date(dateStr + ' 23:59:59')
  return [start, end]
}

/**
 * 获取当天开工的所有报工单（不限 status，按开工时间排序）
 */
async function fetchReportOrdersByDay(dateStr: string, line?: string, shift?: string) {
  const [start, end] = dateRange(dateStr)
  const where: any = {
    report_time: { [Op.between]: [start, end] },
  }
  if (line) where.line_name = line

  let records = await ReportOrder.findAll({
    where,
    order: [['report_time', 'ASC']],
  })

  // 如果指定班次，需要结合 manpower_record 的 shift 过滤
  if (shift && records.length > 0) {
    const reportIds = records.map((r: any) => r.report_order_id)
    const manpowerRows = await ManpowerRecord.findAll({
      where: { report_order_id: reportIds },
      attributes: ['report_order_id', 'shift'],
    })
    const shiftMap = new Map<number, string>()
    for (const m of manpowerRows) {
      shiftMap.set((m as any).report_order_id, mapShift((m as any).shift))
    }
    records = records.filter((r: any) => {
      const s = shiftMap.get(r.report_order_id)
      return !s || s === shift
    })
  }

  return records as any[]
}

/**
 * 聚合一条报工单的所有生产记录字段
 */
async function buildProductionRow(ro: any) {
  const reportOrderId = ro.report_order_id

  // 投入/退回数量 + 印铁批号（第一道工序 process_id=1）
  const materials = await ProcessMaterial.findAll({ where: { report_order_id: reportOrderId } })
  let inputQty = 0
  let ironBatchNo: string | null = null
  for (const m of materials as any[]) {
    if (m.material_type === '投入') inputQty += Number(m.quantity || 0)
    if (m.material_type === '退回') inputQty -= Number(m.quantity || 0)
    if (ironBatchNo === null && m.process_id === 1 && m.material_type === '投入') {
      ironBatchNo = m.material_batch || null
    }
  }

  // 不良汇总：来料不良(小张=片,带盖=罐)、制程不良、检验废品
  const defects = await ProcessDefect.findAll({
    where: { report_order_id: reportOrderId },
    include: [{ model: DefectType, required: true, attributes: ['category_name', 'defect_unit'] }],
  })
  let incomingSmall = 0, incomingCap = 0, processDefect = 0, inspectionDefect = 0
  for (const d of defects as any[]) {
    const cat = d.DefectType?.category_name || ''
    const unit = d.DefectType?.defect_unit || ''
    const qty = Number(d.quantity || 0)
    if (cat === '来料不良') {
      if (unit === '片') incomingSmall += qty
      else incomingCap += qty
    } else if (cat === '制程不良') {
      processDefect += qty
    } else if (cat === '检验报废') {
      inspectionDefect += qty
    }
  }

  // 料边(kg)
  let edgeWeightKg: number | null = null
  if (ro.material_id && inputQty > 0) {
    const mat = await Material.findByPk(ro.material_id, { attributes: ['scrap_weight'] }) as any
    if (mat?.scrap_weight) {
      edgeWeightKg = (Number(mat.scrap_weight) * inputQty) / 1000
    }
  }

  // 人员（技工/普工/劳务/其它）+ 总工时
  const manpower = await ManpowerRecord.findOne({
    where: { report_order_id: reportOrderId },
    order: [['created_at', 'DESC']],
  }) as any
  const skilledCount = manpower?.skilled_count || 0
  const generalCount = manpower?.general_count || 0
  const laborCount = manpower?.labor_count || 0
  const otherCount = manpower?.other_count || 0
  const manHours = manpower?.man_hours ? Number(manpower.man_hours) : 0

  // 停机记录 + 异常工时总和
  const exceptions = await ProcessException.findAll({
    where: { report_order_id: reportOrderId },
    attributes: ['duration'],
  })
  const abnormalHours = exceptions.reduce((sum: number, e: any) => sum + Number(e.duration || 0), 0)

  return {
    reportOrderId,
    reportOrderNo: ro.order_no,
    startTime: ro.report_time,
    endTime: ro.finish_time,
    productionBatch: ro.production_batch,
    materialName: ro.material_name,
    specification: ro.specification,
    ironBatchNo,
    inputQty: Math.round(inputQty * 100) / 100,
    outputQty: Number(ro.report_qty || 0),
    incomingDefectSmall: Math.round(incomingSmall * 100) / 100,
    incomingDefectCap: Math.round(incomingCap * 100) / 100,
    processDefect: Math.round(processDefect * 100) / 100,
    inspectionDefect: Math.round(inspectionDefect * 100) / 100,
    edgeWeightKg: edgeWeightKg ? Math.round(edgeWeightKg * 100) / 100 : null,
    skilledCount,
    generalCount,
    laborCount,
    otherCount,
    abnormalHours: Math.round(abnormalHours * 100) / 100,
    totalHours: Math.round((manHours - abnormalHours) * 100) / 100,
  }
}

/**
 * 停机记录：按生产记录的前 4 条报工单筛选
 */
async function buildDowntimeRows(reportIds: number[]) {
  if (reportIds.length === 0) return []
  const rows = await ProcessException.findAll({
    where: { report_order_id: reportIds },
    attributes: [
      'exception_id', 'report_order_id', 'exception_type',
      'start_time', 'end_time', 'description',
      'confirm_user_name', 'duration',
    ],
    order: [['report_order_id', 'ASC'], ['start_time', 'ASC']],
  }) as any[]

  // 取 production_batch
  const reportOrders = await ReportOrder.findAll({
    where: { report_order_id: reportIds },
    attributes: ['report_order_id', 'production_batch'],
  }) as any[]
  const batchMap = new Map<number, string | null>()
  for (const ro of reportOrders) batchMap.set(ro.report_order_id, ro.production_batch)

  return rows.map(e => ({
    reportOrderId: e.report_order_id,
    productionBatch: batchMap.get(e.report_order_id) || null,
    startTime: e.start_time,
    stopCode: mapStopCode(e.exception_type),
    description: e.description,
    endTime: e.end_time,
    confirmUser: e.confirm_user_name,
    durationHours: Number(e.duration || 0),
  }))
}

/**
 * 不良分类交叉表
 * 行 = defect_name（按 sort_order 排序）
 * 列 = 前 4 条报工单
 * 格 = SUM(quantity)
 */
async function buildDefectMatrix(
  reportIds: number[],
  categoryName: string,
) {
  // 1. 取该分类所有不良类型
  const defectTypes = await DefectType.findAll({
    where: { category_name: categoryName, status: 1 },
    attributes: ['defect_id', 'defect_name', 'sort_order'],
    order: [['sort_order', 'ASC']],
  }) as any[]

  const rows = defectTypes.map((d, i) => ({
    defectId: d.defect_id,
    defectName: d.defect_name,
  }))

  // 2. 取前 4 条报工单信息作为列头
  const reportOrders = await ReportOrder.findAll({
    where: { report_order_id: reportIds },
    attributes: ['report_order_id', 'order_no', 'finish_time'],
    order: [['finish_time', 'ASC']],
  }) as any[]
  // 按传入的 reportIds 顺序排列（保持生产记录的序号对应）
  const orderedCols = reportIds.map(id => reportOrders.find(r => r.report_order_id === id)).filter(Boolean)
  const cols = orderedCols.map((r: any) => ({
    reportOrderId: r.report_order_id,
    reportOrderNo: r.order_no,
  }))

  // 3. 一次性查询所有不良记录，按 defect_type_id + report_order_id 分组
  if (reportIds.length === 0 || defectTypes.length === 0) {
    return {
      rows, cols,
      cells: rows.map(() => cols.map(() => 0)),
      colSubtotals: cols.map(() => 0),
    }
  }

  const defectIds = defectTypes.map((d: any) => d.defect_id)
  const defects = await ProcessDefect.findAll({
    where: {
      report_order_id: reportIds,
      defect_type_id: defectIds,
    },
    attributes: ['report_order_id', 'defect_type_id', 'quantity'],
  }) as any[]

  // 构建二维数组
  const colIdxMap = new Map<number, number>()
  cols.forEach((c, i) => colIdxMap.set(c.reportOrderId, i))
  const rowIdxMap = new Map<number, number>()
  rows.forEach((r, i) => rowIdxMap.set(r.defectId, i))

  const cells: number[][] = rows.map(() => cols.map(() => 0))
  for (const d of defects) {
    const ri = rowIdxMap.get(d.defect_type_id)
    const ci = colIdxMap.get(d.report_order_id)
    if (ri !== undefined && ci !== undefined) {
      cells[ri][ci] += Number(d.quantity || 0)
    }
  }

  const colSubtotals = cols.map((_, ci) =>
    cells.reduce((sum, row) => sum + row[ci], 0),
  )

  return { rows, cols, cells, colSubtotals }
}

/**
 * 主入口
 */
export async function getDailyReport(dateStr: string, line?: string, shift?: string) {
  // 1. 取当天开工的所有报工单（不限 status）
  const dayOrders = await fetchReportOrdersByDay(dateStr, line, shift)
  const reportIds = dayOrders.map((r: any) => r.report_order_id)

  // 2. 表头
  let headerLine = line || ''
  let headerShift = shift || ''
  if (!headerLine && dayOrders.length > 0) headerLine = dayOrders[0].line_name || ''
  if (!headerShift && dayOrders.length > 0) {
    const firstManpower = await ManpowerRecord.findOne({
      where: { report_order_id: dayOrders[0].report_order_id },
      attributes: ['shift'],
    }) as any
    headerShift = mapShift(firstManpower?.shift)
  }

  // 3. 并行聚合所有部分
  const [productionRows, downtime, incomingMatrix, processMatrix] = await Promise.all([
    Promise.all(dayOrders.map(ro => buildProductionRow(ro))),
    buildDowntimeRows(reportIds),
    buildDefectMatrix(reportIds, '来料不良'),
    buildDefectMatrix(reportIds, '制程不良'),
  ])

  // 给 productionRows 加序号
  productionRows.forEach((row, i) => (row as any).seq = i + 1)

  return {
    header: {
      date: dateStr,
      line: headerLine,
      shift: headerShift,
    },
    productionRows,
    downtime,
    incomingDefectMatrix: incomingMatrix,
    processDefectMatrix: processMatrix,
  }
}
