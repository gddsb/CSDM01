import { Op, QueryTypes } from 'sequelize'
import sequelize from '../config/database.js'
import { ReportOrder } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'

/**
 * 口径说明（重要！）
 * task_energy_meter_data.forward_active_energy 列存储的是【周期实际用电量】(delta)，
 * 来自云抄表平台 valueType="SJZ"（实时值/周期值，不是累计值 LZ）。
 * 因此所有统计直接 SUM 即可。
 */

/** 按时间段 SUM 周期实际用电量 */
async function sumEnergy(from: Date, to: Date): Promise<number> {
  const rowsArr: any = await sequelize.query(`
    SELECT COALESCE(SUM(forward_active_energy), 0) AS kwh
    FROM task_energy_meter_data
    WHERE reading_date >= ? AND reading_date < ? AND forward_active_energy >= 0
  `, { replacements: [from, to], type: QueryTypes.SELECT })
  return Number(rowsArr[0]?.kwh ?? 0)
}

/** 按时间段 SUM report_qty（完工罐数） */
async function sumFinishQty(from: Date, to: Date): Promise<number> {
  const qty: any = await ReportOrder.sum('report_qty', {
    where: { status: 1, finish_time: { [Op.gte]: from, [Op.lt]: to } },
  })
  return Number(qty ?? 0)
}

/** 周起始（周一 0 点）*/
function weekStart(ref: Date): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d
}

/**
 * GET /api/energy/overview
 * KPI: 今日用电 · 本月累计 · 本月峰值 · 昨日单罐 · 本周单罐 · 本月单罐
 */
export async function overview(req: any, res: any) {
  try {
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)
    const today1 = new Date(today0.getTime() + 86400000)
    const yesterday0 = new Date(today0.getTime() - 86400000)
    const monthStart = new Date(today0.getFullYear(), today0.getMonth(), 1)
    const week0 = weekStart(today0)
    const now1 = new Date(today0.getTime() + 86400000)

    // ---- 用电量 ----
    const todayKwh = await sumEnergy(today0, today1)
    const yesterdayKwh = await sumEnergy(yesterday0, today0)
    const weekKwh = await sumEnergy(week0, now1)
    const monthKwh = await sumEnergy(monthStart, now1)

    // ---- 完工罐数 ----
    const yesterdayQty = await sumFinishQty(yesterday0, today0)
    const weekQty = await sumFinishQty(week0, now1)
    const monthQty = await sumFinishQty(monthStart, now1)

    // ---- 本月峰值 ----
    const peakRowsArr: any = await sequelize.query(`
      SELECT DATE(reading_date) AS reading_day, SUM(forward_active_energy) AS day_kwh
      FROM task_energy_meter_data
      WHERE reading_date >= ? AND forward_active_energy >= 0
      GROUP BY DATE(reading_date)
      ORDER BY day_kwh DESC
      LIMIT 1
    `, { replacements: [monthStart], type: QueryTypes.SELECT })
    const peakKwh = Number(peakRowsArr[0]?.day_kwh ?? 0)
    const peakDate = peakRowsArr[0]?.reading_day || null

    // ---- 单罐能耗 ----
    const yesterdayUnit = yesterdayQty > 0 ? yesterdayKwh / yesterdayQty : null
    const weekUnit = weekQty > 0 ? weekKwh / weekQty : null
    const monthUnit = monthQty > 0 ? monthKwh / monthQty : null

    return success(res, {
      today_kwh: Math.round(todayKwh),
      month_kwh: Math.round(monthKwh),
      month_peak_kwh: Math.round(peakKwh),
      month_peak_date: peakDate,
      yesterday_kwh: Math.round(yesterdayKwh),
      yesterday_qty: yesterdayQty,
      yesterday_unit_energy: yesterdayUnit != null ? Math.round(yesterdayUnit) : null,
      week_kwh: Math.round(weekKwh),
      week_qty: weekQty,
      week_unit_energy: weekUnit != null ? Math.round(weekUnit) : null,
      month_qty: monthQty,
      month_unit_energy: monthUnit != null ? Math.round(monthUnit) : null,
    })
  } catch (err: any) {
    logger.error('energy/overview error: ' + err.message)
    return fail(res, '获取能源概览失败', ErrorCode.SYSTEM_ERROR)
  }
}

/**
 * 每日用电趋势
 *   mode=month  (默认) 本月 1 号 到 今天
 *   mode=rolling 近 days 天（days 默认 30）
 * GET /api/energy/trend?mode=month
 */
export async function trend(req: any, res: any) {
  try {
    const mode = String(req.query.mode || 'month')
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)
    const tomorrow0 = new Date(today0.getTime() + 86400000)
    let startDate: Date
    let days: number
    if (mode === 'rolling') {
      days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)
      startDate = new Date(today0.getTime() - (days - 1) * 86400000)
    } else {
      startDate = new Date(today0.getFullYear(), today0.getMonth(), 1)
      days = Math.floor((today0.getTime() - startDate.getTime()) / 86400000) + 1
    }

    const energyRowsArr: any = await sequelize.query(`
      SELECT DATE(reading_date) AS reading_day, SUM(forward_active_energy) AS day_kwh
      FROM task_energy_meter_data
      WHERE reading_date >= ? AND forward_active_energy >= 0
      GROUP BY DATE(reading_date)
      ORDER BY reading_day
    `, { replacements: [startDate], type: QueryTypes.SELECT })

    const finishRows: any[] = await ReportOrder.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('finish_time')), 'day'],
        [sequelize.fn('SUM', sequelize.col('report_qty')), 'qty'],
      ],
      where: { status: 1, finish_time: { [Op.gte]: startDate, [Op.lt]: tomorrow0 } },
      group: ['day'],
      raw: true,
    })

    const finishMap = new Map<string, number>()
    finishRows.forEach((r: any) => {
      const d = String(r.day || r.finish_time || '').slice(0, 10)
      if (d) finishMap.set(d, Number(r.qty || 0))
    })

    const energyMap = new Map<string, number>()
    energyRowsArr.forEach((r: any) => {
      energyMap.set(String(r.reading_day).slice(0, 10), Number(r.day_kwh || 0))
    })

    const result: any[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getTime() + i * 86400000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const kwh = energyMap.get(key) || 0
      const qty = finishMap.get(key) || 0
      result.push({
        date: key,
        day_kwh: Math.round(kwh * 100) / 100,
        finish_qty: qty,
        unit_energy: qty > 0 ? Math.round((kwh / qty) * 100) / 100 : null,
      })
    }
    return success(res, result)
  } catch (err: any) {
    logger.error('energy/trend error: ' + err.message)
    return fail(res, '获取能源趋势失败', ErrorCode.SYSTEM_ERROR)
  }
}

/**
 * 近 12 个月（滚动）用电趋势：按月 SUM 周期值
 * GET /api/energy/month-trend?months=12
 */
export async function monthTrend(req: any, res: any) {
  try {
    const months = Math.min(Math.max(Number(req.query.months) || 12, 3), 36)
    const now = new Date()
    const startYear = now.getFullYear()
    const startMonth = now.getMonth() - months + 1
    const start = new Date(startYear, startMonth, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const energyRowsArr: any = await sequelize.query(`
      SELECT DATE_FORMAT(reading_date, '%Y-%m') AS ym, SUM(forward_active_energy) AS month_kwh
      FROM task_energy_meter_data
      WHERE reading_date >= ? AND reading_date < ? AND forward_active_energy >= 0
      GROUP BY DATE_FORMAT(reading_date, '%Y-%m')
      ORDER BY ym
    `, { replacements: [start, end], type: QueryTypes.SELECT })

    const finishRowsArr: any = await sequelize.query(`
      SELECT DATE_FORMAT(finish_time, '%Y-%m') AS ym, SUM(report_qty) AS qty
      FROM production_report_order
      WHERE status = 1 AND finish_time >= ? AND finish_time < ?
      GROUP BY DATE_FORMAT(finish_time, '%Y-%m')
      ORDER BY ym
    `, { replacements: [start, end], type: QueryTypes.SELECT })

    const kwhMap = new Map<string, number>()
    energyRowsArr.forEach((r: any) => kwhMap.set(r.ym, Number(r.month_kwh || 0)))
    const qtyMap = new Map<string, number>()
    finishRowsArr.forEach((r: any) => qtyMap.set(r.ym, Number(r.qty || 0)))

    const result: any[] = []
    for (let i = 0; i < months; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const kwh = kwhMap.get(ym) || 0
      const qty = qtyMap.get(ym) || 0
      result.push({
        month: ym,
        month_kwh: Math.round(kwh * 100) / 100,
        finish_qty: qty,
        unit_energy: qty > 0 ? Math.round((kwh / qty) * 100) / 100 : null,
      })
    }
    return success(res, result)
  } catch (err: any) {
    logger.error('energy/month-trend error: ' + err.message)
    return fail(res, '获取月度趋势失败', ErrorCode.SYSTEM_ERROR)
  }
}

/**
 * 电表列表：最新读数 + 今日实际用电量 + 在线状态（保留兼容旧客户端）
 * GET /api/energy/meter-list
 */
export async function meterList(req: any, res: any) {
  try {
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)
    const today1 = new Date(today0.getTime() + 86400000)
    const sql = `
      SELECT
        t.device_addr, t.device_name, t.forward_active_energy, t.forward_reactive_energy,
        t.reverse_active_energy, t.reading_date,
        IFNULL(td.today_kwh, 0) AS today_kwh,
        CASE
          WHEN t.forward_active_energy > 0 THEN
            t.forward_active_energy / SQRT(t.forward_active_energy * t.forward_active_energy
              + COALESCE(t.forward_reactive_energy, 0) * COALESCE(t.forward_reactive_energy, 0))
          ELSE NULL
        END AS power_factor
      FROM task_energy_meter_data t
      INNER JOIN (
        SELECT device_addr, MAX(reading_date) AS max_date
        FROM task_energy_meter_data WHERE device_addr IS NOT NULL
        GROUP BY device_addr
      ) latest ON t.device_addr = latest.device_addr AND t.reading_date = latest.max_date
      LEFT JOIN (
        SELECT device_addr, SUM(forward_active_energy) AS today_kwh
        FROM task_energy_meter_data
        WHERE reading_date >= ? AND reading_date < ? AND forward_active_energy >= 0
        GROUP BY device_addr
      ) td ON t.device_addr = td.device_addr
      ORDER BY today_kwh DESC
    `
    const rowsArr: any = await sequelize.query(sql, {
      replacements: [today0, today1], type: QueryTypes.SELECT,
    })
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000)
    const list = rowsArr.map((r: any) => ({
      device_addr: r.device_addr,
      device_name: r.device_name || r.device_addr,
      forward_active: Number(r.forward_active_energy ?? 0),
      forward_reactive: Number(r.forward_reactive_energy ?? 0),
      reverse_active: Number(r.reverse_active_energy ?? 0),
      reading_date: r.reading_date,
      today_delta: Number(r.today_kwh ?? 0),
      power_factor: r.power_factor != null ? Math.round(Number(r.power_factor) * 1000) / 1000 : null,
      online: new Date(r.reading_date) >= twoHoursAgo,
    }))
    return success(res, list)
  } catch (err: any) {
    logger.error('energy/meter-list error: ' + err.message)
    return fail(res, '获取电表列表失败', ErrorCode.SYSTEM_ERROR)
  }
}

/**
 * 在线率 + 最新采集时间（保留兼容旧客户端）
 * GET /api/energy/online
 */
export async function online(req: any, res: any) {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000)
    const statArr: any = await sequelize.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN device_addr IS NOT NULL THEN device_addr END) AS total,
        COUNT(DISTINCT CASE WHEN reading_date >= ? THEN device_addr END) AS online_cnt,
        MAX(reading_date) AS last_reading
      FROM task_energy_meter_data
    `, { replacements: [twoHoursAgo], type: QueryTypes.SELECT })
    const total = Number(statArr[0]?.total ?? 0)
    const onlineCnt = Number(statArr[0]?.online_cnt ?? 0)
    return success(res, {
      total_meters: total,
      online_count: onlineCnt,
      online_rate: total > 0 ? Math.round((onlineCnt / total) * 1000) / 10 : 0,
      last_reading: statArr[0]?.last_reading || null,
    })
  } catch (err: any) {
    logger.error('energy/online error: ' + err.message)
    return fail(res, '获取在线状态失败', ErrorCode.SYSTEM_ERROR)
  }
}
