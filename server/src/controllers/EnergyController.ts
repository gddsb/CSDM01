import { Op, QueryTypes } from 'sequelize'
import sequelize from '../config/database.js'
import { ReportOrder } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'

/**
 * 口径说明（重要！）
 * task_energy_meter_data.forward_active_energy 列存储的是【周期实际用电量】(delta)，
 * 来自云抄表平台 valueType="SJZ"（实时值/周期值，不是累计值 LZ）。
 * 因此所有统计直接 SUM 即可，不要再用 LAG() 算差值。
 *
 *   累计表底数 = 周期值在表上累加出来的读数
 *   周期实际用量 = API 返回的本期增量（本系统直接存这个）
 *
 * 所以：
 *   today_kwh  = SUM(forward_active_energy) WHERE 今天
 *   month_kwh  = SUM(forward_active_energy) WHERE 本月
 *   day_kwh    = SUM(forward_active_energy) GROUP BY DATE(reading_date)
 *   reverse    = SUM(reverse_active_energy) WHERE 本月
 */

/**
 * 能源看板：核心概览指标
 * GET /api/energy/overview
 */
export async function overview(req: any, res: any) {
  try {
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)
    const yesterday0 = new Date(today0.getTime() - 86400000)
    const monthStart = new Date(today0.getFullYear(), today0.getMonth(), 1)

    // 1. 今日用电（直接 SUM 周期值）
    const todayKwh = await sumEnergy(today0, new Date(today0.getTime() + 86400000))

    // 2. 本月累计
    const monthKwh = await sumEnergy(monthStart, new Date(today0.getTime() + 86400000))

    // 3. 本月峰值（按天 SUM 后取最大）
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

    // 4. 功率因数（取各电表最新读数的加权平均 PF = P / sqrt(P²+Q²)）
    const pfRowArr: any = await sequelize.query(`
      SELECT AVG(
        CASE
          WHEN la > 0 THEN la / SQRT(la * la + COALESCE(lr, 0) * COALESCE(lr, 0))
          ELSE NULL
        END
      ) AS avg_pf
      FROM (
        SELECT t.forward_active_energy AS la, t.forward_reactive_energy AS lr
        FROM task_energy_meter_data t
        INNER JOIN (
          SELECT device_addr, MAX(reading_date) AS max_date
          FROM task_energy_meter_data WHERE device_addr IS NOT NULL
          GROUP BY device_addr
        ) latest ON t.device_addr = latest.device_addr AND t.reading_date = latest.max_date
      ) x
    `, { type: QueryTypes.SELECT })
    const powerFactor = Number(pfRowArr[0]?.avg_pf ?? 0)

    // 5. 反向回送（本月反向有功累计）
    const revRowArr: any = await sequelize.query(`
      SELECT COALESCE(SUM(COALESCE(reverse_active_energy, 0)), 0) AS month_reverse
      FROM task_energy_meter_data
      WHERE reading_date >= ? AND reverse_active_energy >= 0
    `, { replacements: [monthStart], type: QueryTypes.SELECT })
    const monthReverse = Number(revRowArr[0]?.month_reverse ?? 0)

    // 6. 今日完工数 & 单罐能耗
    const todayFinish = await ReportOrder.sum('report_qty', {
      where: {
        status: 1,
        finish_time: { [Op.gte]: today0, [Op.lt]: new Date(today0.getTime() + 86400000) },
      },
    })
    const todayFinishQty = Number(todayFinish ?? 0)
    const unitEnergy = todayFinishQty > 0 ? todayKwh / todayFinishQty : null

    // 7. 环比昨日
    const prevKwh = await sumEnergy(yesterday0, today0)
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

/** 按时间段 SUM 周期实际用电量 */
async function sumEnergy(from: Date, to: Date): Promise<number> {
  const rowsArr: any = await sequelize.query(`
    SELECT COALESCE(SUM(forward_active_energy), 0) AS kwh
    FROM task_energy_meter_data
    WHERE reading_date >= ? AND reading_date < ? AND forward_active_energy >= 0
  `, { replacements: [from, to], type: QueryTypes.SELECT })
  return Number(rowsArr[0]?.kwh ?? 0)
}

/**
 * 30 天趋势：每日用电量（直接 SUM） + 每日完工数 + 单罐能耗
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

    // 日用电（直接按天 SUM 周期值）
    const energyRowsArr: any = await sequelize.query(`
      SELECT DATE(reading_date) AS reading_day, SUM(forward_active_energy) AS day_kwh
      FROM task_energy_meter_data
      WHERE reading_date >= ? AND forward_active_energy >= 0
      GROUP BY DATE(reading_date)
      ORDER BY reading_day
    `, { replacements: [startDate], type: QueryTypes.SELECT })

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
 * 电表列表：最新读数 + 今日实际用电量 + 功率因数 + 在线状态
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
      replacements: [today0, today1],
      type: QueryTypes.SELECT,
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
 * 在线率 + 最新采集时间
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
