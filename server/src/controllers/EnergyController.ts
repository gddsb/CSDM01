import { Op, QueryTypes } from 'sequelize'
import sequelize from '../config/database.js'
import { EnergyMeterData, ReportOrder } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'

/**
 * 能源看板：核心概览指标
 * GET /api/energy/overview
 */
export async function overview(req: any, res: any) {
  try {
    // 时间边界
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)
    const yesterday0 = new Date(today0.getTime() - 86400000)
    const monthStart = new Date(today0.getFullYear(), today0.getMonth(), 1)
    const lastMonthStart = new Date(today0.getFullYear(), today0.getMonth() - 1, 1)

    // 1. 今日用电增量（各电表：今日 0 点最近读数 − 昨日 0 点最近读数）
    const todaySql = `
      SELECT COALESCE(SUM(today_read - yest_read), 0) AS today_kwh
      FROM (
        SELECT device_addr,
          (SELECT forward_active_energy FROM task_energy_meter_data
            WHERE device_addr = t.device_addr AND reading_date >= ?
            ORDER BY reading_date ASC LIMIT 1) AS today_read,
          (SELECT forward_active_energy FROM task_energy_meter_data
            WHERE device_addr = t.device_addr AND reading_date >= ? AND reading_date < ?
            ORDER BY reading_date ASC LIMIT 1) AS yest_read
        FROM (SELECT DISTINCT device_addr FROM task_energy_meter_data WHERE device_addr IS NOT NULL) t
      ) x
      WHERE today_read IS NOT NULL AND yest_read IS NOT NULL AND today_read >= yest_read
    `
    const [todayRow]: any = await sequelize.query(todaySql, {
      replacements: [today0, yesterday0, today0],
      type: QueryTypes.SELECT,
    })
    const todayKwh = Number(todayRow?.today_kwh ?? 0)

    // 2. 本月用电
    const monthSql = `
      SELECT COALESCE(SUM(m_end - m_start), 0) AS month_kwh
      FROM (
        SELECT device_addr,
          (SELECT forward_active_energy FROM task_energy_meter_data
            WHERE device_addr = t.device_addr AND reading_date >= ?
            ORDER BY reading_date DESC LIMIT 1) AS m_end,
          (SELECT forward_active_energy FROM task_energy_meter_data
            WHERE device_addr = t.device_addr AND reading_date >= ? AND reading_date < ?
            ORDER BY reading_date ASC LIMIT 1) AS m_start
        FROM (SELECT DISTINCT device_addr FROM task_energy_meter_data WHERE device_addr IS NOT NULL) t
      ) x
      WHERE m_end IS NOT NULL AND m_start IS NOT NULL
    `
    const [monthRow]: any = await sequelize.query(monthSql, {
      replacements: [today0, monthStart, today0],
      type: QueryTypes.SELECT,
    })
    const monthKwh = Number(monthRow?.month_kwh ?? 0)

    // 3. 本月峰值（单日最大用电量）
    const peakSql = `
      SELECT day_kwh, reading_day FROM (
        SELECT DATE(reading_date) AS reading_day,
          SUM(forward_active_energy - LAG(forward_active_energy) OVER(PARTITION BY device_addr ORDER BY reading_date)) AS day_kwh
        FROM task_energy_meter_data
        WHERE reading_date >= ?
        GROUP BY DATE(reading_date), device_addr
      ) raw
      GROUP BY reading_day
      ORDER BY day_kwh DESC
      LIMIT 1
    `
    const [peakRow]: any = await sequelize.query(peakSql, {
      replacements: [monthStart],
      type: QueryTypes.SELECT,
    })
    const peakKwh = Number(peakRow?.day_kwh ?? 0)
    const peakDate = peakRow?.reading_day || null

    // 4. 功率因数（最新读数平均）
    const pfSql = `
      SELECT AVG(
        CASE
          WHEN forward_active_energy > 0 THEN
            forward_active_energy / SQRT(forward_active_energy * forward_active_energy
              + COALESCE(forward_reactive_energy, 0) * COALESCE(forward_reactive_energy, 0))
          ELSE NULL
        END
      ) AS avg_pf
      FROM task_energy_meter_data m
      INNER JOIN (
        SELECT device_addr, MAX(reading_date) AS max_date
        FROM task_energy_meter_data
        WHERE device_addr IS NOT NULL
        GROUP BY device_addr
      ) latest ON m.device_addr = latest.device_addr AND m.reading_date = latest.max_date
    `
    const [pfRow]: any = await sequelize.query(pfSql, {
      type: QueryTypes.SELECT,
    })
    const powerFactor = Number(pfRow?.avg_pf ?? 0)

    // 5. 反向回送（本月增量）
    const revSql = `
      SELECT COALESCE(SUM(r_end - r_start), 0) AS month_reverse
      FROM (
        SELECT device_addr,
          (SELECT reverse_active_energy FROM task_energy_meter_data
            WHERE device_addr = t.device_addr AND reading_date >= ?
            ORDER BY reading_date DESC LIMIT 1) AS r_end,
          (SELECT reverse_active_energy FROM task_energy_meter_data
            WHERE device_addr = t.device_addr AND reading_date >= ? AND reading_date < ?
            ORDER BY reading_date ASC LIMIT 1) AS r_start
        FROM (SELECT DISTINCT device_addr FROM task_energy_meter_data WHERE device_addr IS NOT NULL) t
      ) x
      WHERE r_end IS NOT NULL AND r_start IS NOT NULL
    `
    const [revRow]: any = await sequelize.query(revSql, {
      replacements: [today0, monthStart, today0],
      type: QueryTypes.SELECT,
    })
    const monthReverse = Number(revRow?.month_reverse ?? 0)

    // 6. 日完工数 & 单罐能耗
    const todayFinish = await ReportOrder.sum('report_qty', {
      where: {
        status: 1,
        finish_time: { [Op.gte]: today0, [Op.lt]: new Date(today0.getTime() + 86400000) },
      },
    })
    const todayFinishQty = Number(todayFinish ?? 0)
    const unitEnergy = todayFinishQty > 0 ? todayKwh / todayFinishQty : null

    // 7. 环比：昨日用电 & 上月同期用电
    const prevDaySql = `
      SELECT COALESCE(SUM(d_read - d_prev), 0) AS prev_kwh
      FROM (
        SELECT device_addr,
          (SELECT forward_active_energy FROM task_energy_meter_data
            WHERE device_addr = t.device_addr AND reading_date >= ? AND reading_date < ?
            ORDER BY reading_date ASC LIMIT 1) AS d_read,
          (SELECT forward_active_energy FROM task_energy_meter_data
            WHERE device_addr = t.device_addr AND reading_date < ?
            ORDER BY reading_date DESC LIMIT 1) AS d_prev
        FROM (SELECT DISTINCT device_addr FROM task_energy_meter_data WHERE device_addr IS NOT NULL) t
      ) x
      WHERE d_read IS NOT NULL AND d_prev IS NOT NULL AND d_read >= d_prev
    `
    const [prevRow]: any = await sequelize.query(prevDaySql, {
      replacements: [yesterday0, today0, yesterday0],
      type: QueryTypes.SELECT,
    })
    const prevKwh = Number(prevRow?.prev_kwh ?? 0)
    const momChange = prevKwh > 0 ? ((todayKwh - prevKwh) / prevKwh) * 100 : null

    return success(res, {
      today_kwh: Math.round(todayKwh * 100) / 100,
      month_kwh: Math.round(monthKwh * 100) / 100,
      month_peak_kwh: Math.round(peakKwh * 100) / 100,
      month_peak_date: peakDate,
      power_factor: Math.round(powerFactor * 1000) / 1000,
      month_reverse_kwh: Math.round(monthReverse * 100) / 100,
      today_finish_qty: todayFinishQty,
      unit_energy: unitEnergy != null ? Math.round(unitEnergy * 100) / 100 : null,
      mom_change: momChange != null ? Math.round(momChange * 10) / 10 : null,
    })
  } catch (err: any) {
    logger.error('energy/overview error: ' + err.message)
    return fail(res, '获取能源概览失败', ErrorCode.SYSTEM_ERROR)
  }
}

/**
 * 30 天趋势：每日用电量 + 每日完工数 + 单罐能耗
 * GET /api/energy/trend?days=30
 */
export async function trend(req: any, res: any) {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() - days + 1)
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)
    const tomorrow0 = new Date(today0.getTime() + 86400000)

    // 日用电（窗口函数算增量后按天 SUM）
    const energySql = `
      SELECT d AS reading_day, COALESCE(SUM(delta), 0) AS day_kwh
      FROM (
        SELECT DATE(reading_date) AS d, device_addr,
          forward_active_energy - LAG(forward_active_energy) OVER(PARTITION BY device_addr ORDER BY reading_date) AS delta
        FROM task_energy_meter_data
        WHERE reading_date >= ?
      ) raw
      WHERE delta IS NOT NULL AND delta >= 0
      GROUP BY d
      ORDER BY d
    `
    const [energyRows]: any = await sequelize.query(energySql, {
      replacements: [startDate],
      type: QueryTypes.SELECT,
    })

    // 完工数按天
    const finishRows: any[] = await ReportOrder.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('finish_time')), 'day'],
        [sequelize.fn('SUM', sequelize.col('report_qty')), 'qty'],
      ],
      where: {
        status: 1,
        finish_time: { [Op.gte]: startDate, [Op.lt]: tomorrow0 },
      },
      group: ['day'],
      raw: true,
    })

    const finishMap = new Map<string, number>()
    finishRows.forEach((r: any) => {
      const d = (r as any).day || (r as any).finish_time
      if (d) finishMap.set(String(d).slice(0, 10), Number((r as any).qty || 0))
    })

    // 填充每天数据
    const result: any[] = []
    const energyMap = new Map<string, number>()
    energyRows.forEach((r: any) => {
      energyMap.set(String(r.reading_day).slice(0, 10), Number(r.day_kwh || 0))
    })

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getTime() + i * 86400000)
      const key = d.toISOString().slice(0, 10)
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
 * 电表列表：最新读数 + 今日增量 + 在线状态
 * GET /api/energy/meter-list
 */
export async function meterList(req: any, res: any) {
  try {
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)

    const sql = `
      SELECT t.device_addr, t.device_name, t.forward_active_energy, t.forward_reactive_energy,
             t.reverse_active_energy, t.reading_date,
             y.yest_read,
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
        SELECT device_addr, forward_active_energy AS yest_read
        FROM task_energy_meter_data
        WHERE (device_addr, reading_date) IN (
          SELECT device_addr, MIN(reading_date)
          FROM task_energy_meter_data
          WHERE reading_date >= ? AND reading_date < ?
          GROUP BY device_addr
        )
      ) y ON t.device_addr = y.device_addr
      ORDER BY (t.forward_active_energy - COALESCE(y.yest_read, 0)) DESC
    `
    const [rows]: any = await sequelize.query(sql, {
      replacements: [today0, new Date(today0.getTime() + 86400000)],
      type: QueryTypes.SELECT,
    })

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000)
    const list = rows.map((r: any) => ({
      device_addr: r.device_addr,
      device_name: r.device_name || r.device_addr,
      forward_active: Number(r.forward_active_energy ?? 0),
      forward_reactive: Number(r.forward_reactive_energy ?? 0),
      reverse_active: Number(r.reverse_active_energy ?? 0),
      reading_date: r.reading_date,
      today_delta: Number(r.yest_read != null ? Math.max(0, (r.forward_active_energy ?? 0) - r.yest_read) : 0),
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
 * 在线率 + 采集成功率
 * GET /api/energy/online
 */
export async function online(req: any, res: any) {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000)

    // 电表总数
    const meters: any = await EnergyMeterData.findAll({
      attributes: [[sequelize.fn('COUNT', sequelize.literal('DISTINCT device_addr')), 'total']],
      where: { device_addr: { [Op.ne]: null } },
      raw: true,
    })
    const totalMeters = Number(meters?.[0]?.total ?? 0)

    // 在线数
    const online: any = await EnergyMeterData.findAll({
      attributes: [[sequelize.fn('COUNT', sequelize.literal('DISTINCT t.device_addr')), 'online_count']],
      where: { reading_date: { [Op.gte]: twoHoursAgo } },
      raw: true,
    })
    const onlineCount = Number(online?.[0]?.online_count ?? 0)

    // 最新采集时间
    const latest: any = await EnergyMeterData.findOne({
      attributes: [[sequelize.fn('MAX', sequelize.col('reading_date')), 'last_read']],
      raw: true,
    })

    return success(res, {
      total_meters: totalMeters,
      online_count: onlineCount,
      online_rate: totalMeters > 0 ? Math.round((onlineCount / totalMeters) * 1000) / 10 : 0,
      last_reading: latest?.last_read || null,
    })
  } catch (err: any) {
    logger.error('energy/online error: ' + err.message)
    return fail(res, '获取在线状态失败', ErrorCode.SYSTEM_ERROR)
  }
}
