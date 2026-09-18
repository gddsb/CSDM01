/**
 * OEE 聚合 API — 移动端 & PC 端共用
 *
 * 返回设备级 OEE = 可用率 × 性能率 × 质量率 / 10000
 * GET /api/auto/dashboard/oee?range=7|30|month  （默认近7天，公开）
 */
import { Op } from 'sequelize'
import {
  Device, DeviceRuntimeLog, LineDevice,
  ReportOrder, ProcessDefect,
} from '../../models/index.js'
import { nowBeijingDate, formatDate } from '../../utils/date.js'
import { success, fail, ErrorCode } from '../../utils/response.js'
import { logger } from "../../utils/logger.js"

const DEFAULT_BASE_RATES = { availability: 85, performance: 85, quality: 95 }
const clamp = (v: number) => Math.max(0, Math.min(100, v))

function resolveRange(range: string | undefined): { start: Date; end: Date; label: string } {
  const today = nowBeijingDate(); today.setHours(0, 0, 0, 0)
  const r = (range || '7').toString()
  if (r === '30') return { start: new Date(today.getTime() - 29 * 86400000), end: today, label: '近30天' }
  if (r === 'month') return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today, label: '本月' }
  return { start: new Date(today.getTime() - 6 * 86400000), end: today, label: '近7天' }
}

async function buildDailyTrend(start: Date, end: Date) {
  const days: string[] = []
  const cur = new Date(start)
  while (cur <= end) { days.push(formatDate(cur)); cur.setDate(cur.getDate() + 1) }

  const ros = await ReportOrder.findAll({
    where: { report_time: { [Op.gte]: start, [Op.lte]: end } },
    attributes: ['report_time', 'report_qty'], raw: true,
  })
  const defects = await ProcessDefect.findAll({
    where: { record_time: { [Op.gte]: start, [Op.lte]: end } },
    attributes: ['record_time', 'quantity'], raw: true,
  })

  const outputMap: Record<string, number> = {}
  ;(ros as any[]).forEach((r) => {
    if (!r.report_time) return
    const d = formatDate(r.report_time instanceof Date ? r.report_time : new Date(r.report_time))
    outputMap[d] = (outputMap[d] || 0) + Number(r.report_qty || 0)
  })
  const defectMap: Record<string, number> = {}
  ;(defects as any[]).forEach((d) => {
    if (!d.record_time) return
    const ds = formatDate(d.record_time instanceof Date ? d.record_time : new Date(d.record_time))
    defectMap[ds] = (defectMap[ds] || 0) + Number(d.quantity || 0)
  })

  return days.map((d) => {
    const output = outputMap[d] || 0
    const defect = defectMap[d] || 0
    const total = output + defect
    const quality = total > 0 ? clamp(100 - (defect / total) * 100) : null
    return { date: d, output, defect, quality }
  })
}

export async function calcOee(range?: string) {
  const { start, end, label } = resolveRange(range)

  const [devices, runtimeLogs, lineDevices, reportOrders, processDefects] = await Promise.all([
    Device.findAll({ raw: true }),
    DeviceRuntimeLog.findAll({
      where: { created_at: { [Op.gte]: start, [Op.lte]: end } },
      order: [['created_at', 'ASC']], raw: true,
    }),
    LineDevice.findAll({ raw: true }),
    ReportOrder.findAll({
      where: { report_time: { [Op.gte]: start, [Op.lte]: end } },
      attributes: ['report_no', 'report_time', 'report_qty', 'line_id'], raw: true,
    }),
    ProcessDefect.findAll({
      where: { record_time: { [Op.gte]: start, [Op.lte]: end } },
      attributes: ['record_time', 'quantity', 'report_order_id'], raw: true,
    }),
  ])

  const runtimeByDevice = new Map<number, number>()
  for (const r of runtimeLogs as any[]) {
    if (r.delta_hours) runtimeByDevice.set(r.device_id,
      (runtimeByDevice.get(r.device_id) || 0) + Number(r.delta_hours))
  }

  const deviceToLine = new Map<number, number>()
  for (const ld of lineDevices as any[]) {
    deviceToLine.set(ld.device_id, ld.line_id)
  }

  const outputByLine = new Map<number, number>()
  for (const ro of reportOrders as any[]) {
    if (ro.line_id) outputByLine.set(ro.line_id,
      (outputByLine.get(ro.line_id) || 0) + Number(ro.report_qty || 0))
  }

  const reportToLine = new Map<string, number>()
  for (const ro of reportOrders as any[]) {
    if (ro.report_no) reportToLine.set(ro.report_no, ro.line_id)
  }
  const defectByLine = new Map<number, number>()
  for (const pd of processDefects as any[]) {
    if (!pd.report_order_id) continue
    const lineId = reportToLine.get(pd.report_order_id)
    if (lineId) defectByLine.set(lineId,
      (defectByLine.get(lineId) || 0) + Number(pd.quantity || 0))
  }

  const plannedHours = (end.getTime() - start.getTime()) / 3600000
  const devicesOee: any[] = []
  for (const d of devices as any[]) {
    const b = DEFAULT_BASE_RATES
    const deviceId = d.device_id
    const lineId = deviceToLine.get(deviceId) || undefined
    const deltaHours = runtimeByDevice.get(deviceId) || 0
    const output = lineId ? (outputByLine.get(lineId) || 0) : 0
    const lineDefect = lineId ? (defectByLine.get(lineId) || 0) : 0
    const total = output + lineDefect

    const availability = deltaHours > 0 ? clamp((deltaHours / plannedHours) * 100) : b.availability
    const performance = deltaHours > 0 && output > 0
      ? clamp(Math.min(100, (output / (deltaHours * 100)) * 100))
      : b.performance
    const quality = total > 0 ? clamp(100 - (lineDefect / total) * 100) : b.quality
    const oee = +((availability * performance * quality) / 10000).toFixed(1)

    devicesOee.push({
      device_id: deviceId,
      device_name: d.device_name,
      device_code: d.device_code,
      device_type: d.device_type,
      line_id: lineId || null,
      runtime_hours: +deltaHours.toFixed(2),
      availability: +availability.toFixed(1),
      performance: +performance.toFixed(1),
      quality: +quality.toFixed(1),
      oee,
    })
  }
  devicesOee.sort((a, b) => b.oee - a.oee)

  const valid = devicesOee.filter((d) => d.oee > 0)
  const summary = {
    avg_oee: valid.length ? +(valid.reduce((s, d) => s + d.oee, 0) / valid.length).toFixed(1) : 0,
    max_oee: valid[0]?.oee || 0,
    min_oee: valid[valid.length - 1]?.oee || 0,
    device_count: devicesOee.length,
    range_label: label,
  }

  const trend = await buildDailyTrend(start, end)
  return { devices: devicesOee, summary, trend }
}

/** 路由层 handler — 从 req.query.range 取参数 */
export async function oeeHandler(req: any, res: any) {
  try {
    const range = String(req.query.range || '7')
    const data = await calcOee(range)
    return success(res, data)
  } catch (err: any) {
    logger.error('[OEE]', err.message)
    return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { calcOee, oeeHandler }
