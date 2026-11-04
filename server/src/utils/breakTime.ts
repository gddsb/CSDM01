import { Op } from 'sequelize'
import ProductionBreakTime from '../models/ProductionBreakTime.js'
import SystemConfig from '../models/SystemConfig.js'

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
