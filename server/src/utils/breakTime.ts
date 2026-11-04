import { Op } from 'sequelize'
import ProductionBreakTime from '../models/ProductionBreakTime.js'
import SystemConfig from '../models/SystemConfig.js'
import { ManpowerRecord, ProcessException, ReportOrder } from '../models/index.js'
import { nowBeijingDate } from './date.js'

export interface BreakTime {
  start: string   // "HH:mm"
  end: string     // "HH:mm"
}

export interface BreakRecord {
  break_time_id?: string
  start_time: Date
  end_time: Date
}

/**
 * 计算目标时间段与休息时间段列表的重叠分钟数
 * breakTimes 是具体日期时间的休息记录（含日期）
 */
export function calcOverlapMinutes(
  targetStart: Date,
  targetEnd: Date,
  breakTimes: BreakRecord[],
): number {
  if (!breakTimes.length) return 0
  let totalOverlapMs = 0
  for (const b of breakTimes) {
    const s = Math.max(targetStart.getTime(), b.start_time.getTime())
    const e = Math.min(targetEnd.getTime(), b.end_time.getTime())
    const overlap = e - s
    if (overlap > 0) totalOverlapMs += overlap
  }
  return Math.round(totalOverlapMs / 60000)
}

/**
 * 把 "HH:mm" 模式的休息时间段展开为具体 Date（拼到 targetDate 上）
 * 支持跨天：如果 end < start（如 22:00-06:00），end 拼次日
 */
export function expandBreakPatternToDates(
  patterns: BreakTime[],
  targetDate: Date,
): BreakRecord[] {
  const result: BreakRecord[] = []
  const y = targetDate.getFullYear()
  const m = targetDate.getMonth()
  const d = targetDate.getDate()

  for (const p of patterns) {
    const [sh, sm] = p.start.split(':').map(Number)
    const [eh, em] = p.end.split(':').map(Number)
    const start = new Date(y, m, d, sh, sm, 0, 0)
    const endDayOffset = (eh * 60 + em) < (sh * 60 + sm) ? 1 : 0
    const end = new Date(y, m, d + endDayOffset, eh, em, 0, 0)
    if (end.getTime() > start.getTime()) {
      result.push({ start_time: start, end_time: end })
    }
  }
  return result
}

/**
 * 从 sys_config 读取默认休息时间段
 * 配置示例: [{"start":"12:00","end":"13:00"},{"start":"18:00","end":"18:30"}]
 */
export async function loadDefaultBreakPatterns(): Promise<BreakTime[]> {
  try {
    const cfg = await SystemConfig.findOne({
      where: { config_key: 'default_break_times' },
    })
    if (cfg?.config_value) {
      const parsed = typeof cfg.config_value === 'string'
        ? JSON.parse(cfg.config_value)
        : cfg.config_value
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return []
}

/**
 * 获取某个报工单的休息记录
 * 如果没有，返回空数组（不自动展开系统默认，由 Controller/Service 决定）
 */
export async function loadBreakRecordsByReport(reportOrderId: string): Promise<BreakRecord[]> {
  const list = await ProductionBreakTime.findAll({
    where: { report_order_id: reportOrderId },
    order: [['start_time', 'ASC']],
    attributes: ['break_time_id', 'start_time', 'end_time'],
  })
  return list.map(r => ({
    break_time_id: r.break_time_id,
    start_time: new Date(r.start_time as unknown as string),
    end_time: new Date(r.end_time as unknown as string),
  }))
}

/**
 * 展开系统默认休息时间段为具体日期（用于报工单创建时自动生成）
 */
export async function expandDefaultForReport(
  reportDate: Date,
): Promise<BreakRecord[]> {
  const patterns = await loadDefaultBreakPatterns()
  return expandBreakPatternToDates(patterns, reportDate)
}

/**
 * 过滤只在目标时段 [rangeStart, rangeEnd] 内有重叠的休息记录
 * 用于前端只显示"真正生效"的休息时间
 */
export function filterBreaksInRange(
  breaks: BreakRecord[],
  rangeStart: Date,
  rangeEnd: Date,
): BreakRecord[] {
  if (!breaks.length) return []
  return breaks.filter(b => {
    const s = Math.max(rangeStart.getTime(), b.start_time.getTime())
    const e = Math.min(rangeEnd.getTime(), b.end_time.getTime())
    return e - s > 0
  })
}

/**
 * 重新计算一个报工单的全部净工时 / 净停机时长
 * - ManpowerRecord.net_hours = gross - overlap
 * - ProcessException.net_duration = gross - overlap（逐条算）
 * 后端重算入口：完工时调、存量补算脚本调
 */
export async function recalcNetForReport(reportOrderId: number): Promise<void> {
  const ro = await ReportOrder.findOne({ where: { report_order_id: reportOrderId } })
  if (!ro) return

  // 报工时段：开工到完工（或到现在）
  const startDate = new Date((ro as any).getDataValue('report_time') as string)
  const finishVal = (ro as any).getDataValue('finish_time')
  const endDate = finishVal ? new Date(finishVal as string) : nowBeijingDate()
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) return

  // 查休息记录（如果没有先自动补默认）
  let breaks = await loadBreakRecordsByReport(String(reportOrderId))
  if (breaks.length === 0) {
    try {
      const defaultBreaks = await expandDefaultForReport(startDate)
      for (const br of defaultBreaks) {
        await ProductionBreakTime.create({
          break_time_id: (crypto as any)?.randomUUID?.() || String(Date.now()) + Math.random(),
          report_order_id: reportOrderId as unknown as string,
          start_time: br.start_time,
          end_time: br.end_time,
          remark: '系统默认休息（存量补算自动展开）',
        } as any)
      }
      breaks = defaultBreaks
    } catch { /* ignore */ }
  }

  // 1) 重算 ManpowerRecord.net_hours
  const manRecords = await ManpowerRecord.findAll({
    where: { report_order_id: reportOrderId },
  })
  const breakRecs = breaks.map(b => ({
    start_time: b.start_time,
    end_time: b.end_time,
  }))

  for (const m of manRecords as any[]) {
    try {
      const ms = m.getDataValue('start_time') ? new Date(m.getDataValue('start_time')) : startDate
      const me = m.getDataValue('end_time') ? new Date(m.getDataValue('end_time')) : endDate
      if (isNaN(ms.getTime()) || isNaN(me.getTime())) continue
      const overlapMin = calcOverlapMinutes(ms, me, breakRecs)
      const grossHours = Number((m.getDataValue('hours') || 0))
      let netHours = Number((grossHours - overlapMin / 60).toFixed(2))
      if (netHours < 0) netHours = 0
      await m.update({ net_hours: netHours })
    } catch { /* skip one */ }
  }

  // 2) 重算所有 ProcessException.net_duration
  const excRecords = await ProcessException.findAll({
    where: { report_order_id: reportOrderId },
  })
  for (const e of excRecords as any[]) {
    try {
      const es = e.getDataValue('start_time')
      if (!es) continue
      const ed = e.getDataValue('end_time')
      const start = new Date(es)
      const end = ed ? new Date(ed) : endDate
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() <= start.getTime()) continue
      const overlapMin = calcOverlapMinutes(start, end, breakRecs)
      const gross = Number(e.getDataValue('duration') || 0)
      let nd = Number((gross - overlapMin / 60).toFixed(2))
      if (nd < 0) nd = 0
      await e.update({ net_duration: nd })
    } catch { /* skip one */ }
  }
}
