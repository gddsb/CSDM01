/** MaintenanceGenerator —— 工单生成 + 保养矩阵 */
/**
 * generateRecords: 按月批量生成日/周/月保养执行记录
 *   - daily: 整月每日一条（本月 + skip_past 时跳过已过去日期）
 *   - weekly: 整月覆盖的 ISO 周各一条
 *   - monthly: 当月一条
 *   - runtime: 已移除（不再自动生成运行时长触发的记录）
 *   - 同一 standard_id + period_key 只生成一条（不管状态，已存在即跳过）
 *
 * getMatrix: 查询设备某月保养矩阵视图（不变）
 */
import { Op } from 'sequelize'
import sequelize from 'sequelize'
import {
  DeviceMaintenanceProfile, DeviceMaintenanceRecord, DeviceMaintenanceStandard,
} from '../models/index.js'
import { generateDeviceRecordNo } from '../utils/sequence.js'
import { ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import {
  todayStr, dateOnlyStr, getISOWeek, buildPeriodKey,
  dailyPeriodKeys, weeklyPeriodKeys, monthlyStandardActive,
} from '../utils/maintenanceMatrix.js'
import { loadDeviceFields } from './MaintenanceProfileCrud.js'

/** generateRecords —— 按月批量生成日/周/月保养执行记录 */
export async function generateRecords(body: any) {
  const t = await DeviceMaintenanceRecord.sequelize.transaction()
  try {
    const { target_month, device_id, skip_past } = body || {}

    // 1. 参数校验
    if (!target_month || !/^\d{4}-\d{2}$/.test(String(target_month))) {
      throw new AppError('target_month 格式错误，应为 YYYY-MM', ErrorCode.PARAM_INVALID)
    }
    const [yr, mo] = String(target_month).split('-').map(Number)
    const isCurrentMonth = target_month === todayStr().slice(0, 7)
    const skipPast = skip_past !== false  // 默认 true

    // 2. 查生效设备档案
    const effectiveProfiles = await DeviceMaintenanceProfile.findAll({
      where: { status: '生效' },
      attributes: ['device_id'],
      transaction: t,
    })
    let effectiveDeviceIds = effectiveProfiles.map((p: any) => p.getDataValue('device_id'))
    if (device_id) effectiveDeviceIds = effectiveDeviceIds.filter(id => id === Number(device_id))
    if (effectiveDeviceIds.length === 0) {
      await t.commit()
      return { created: 0, skipped: 0, records: [] }
    }

    // 3. 查日/周/月三种模式的保养标准（不含 runtime）
    const standards = await DeviceMaintenanceStandard.findAll({
      where: {
        trigger_mode: { [Op.in]: ['daily', 'weekly', 'monthly'] },
        status: 1,
        device_id: { [Op.in]: effectiveDeviceIds },
      },
      transaction: t,
    })

    // monthly 标准的 monthly_plan 可能只在某些月份生效
    const activeStandards = standards.filter((s: any) => {
      const tm = s.getDataValue('trigger_mode')
      if (tm === 'monthly') return monthlyStandardActive(s.getDataValue('monthly_plan'), mo)
      return true
    })

    if (activeStandards.length === 0) {
      await t.commit()
      return { created: 0, skipped: 0, records: [] }
    }

    // 4. 计算每种模式的 period_keys
    const dailyKeys = dailyPeriodKeys(yr, mo)
    const weekKeys = weeklyPeriodKeys(yr, mo)

    // 本月 + skipPast → daily 只取今天及以后
    const effectiveDailyKeys = (isCurrentMonth && skipPast)
      ? dailyKeys.filter(pk => pk >= todayStr())
      : dailyKeys

    // 5. 构建 (standard_id, period_key) 全集 → 一次性查已有记录去重
    const periodKeysSet = new Set<string>()
    const stdPeriodMap: Record<number, string[]> = {}

    for (const s of activeStandards) {
      const sid = s.getDataValue('standard_id')
      const tm = s.getDataValue('trigger_mode')
      let keys: string[] = []
      if (tm === 'daily') keys = effectiveDailyKeys
      else if (tm === 'weekly') keys = weekKeys
      else if (tm === 'monthly') keys = [target_month]
      keys.forEach(k => periodKeysSet.add(k))
      stdPeriodMap[sid] = keys
    }

    const allPeriodKeys = Array.from(periodKeysSet)
    const standardIds = activeStandards.map((s: any) => s.getDataValue('standard_id'))

    let existSet: Set<string> = new Set()
    if (allPeriodKeys.length > 0) {
      const existing = await DeviceMaintenanceRecord.findAll({
        where: {
          standard_id: { [Op.in]: standardIds },
          period_key: { [Op.in]: allPeriodKeys },
        },
        attributes: ['standard_id', 'period_key'],
        transaction: t,
      })
      existSet = new Set(existing.map((r: any) => `${r.getDataValue('standard_id')}|${r.getDataValue('period_key')}`))
    }

    // 6. 批量创建
    const createdList: any[] = []
    let skipped = 0

    for (const s of activeStandards) {
      const sid = s.getDataValue('standard_id')
      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(
        s.getDataValue('device_id'),
        s.getDataValue('device_code'),
        s.getDataValue('device_name'),
        t,
      )
      for (const pk of stdPeriodMap[sid] || []) {
        if (existSet.has(`${sid}|${pk}`)) { skipped++; continue }
        const recordNo = await generateDeviceRecordNo()
        const created = await DeviceMaintenanceRecord.create({
          record_no: recordNo,
          standard_id: sid,
          device_id: s.getDataValue('device_id'),
          device_code: finalDeviceCode,
          device_name: finalDeviceName,
          trigger_mode: s.getDataValue('trigger_mode'),
          period_key: pk,
          status: 0,
          remarks: '自动生成',
        }, { transaction: t })
        createdList.push(created)
      }
    }

    await t.commit()
    return {
      created: createdList.length,
      skipped,
      records: createdList.map(r => ({ record_id: r.record_id, record_no: r.record_no })),
    }
  } catch (err: any) {
    if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
    throw new AppError(err.message || '生成失败', ErrorCode.SYSTEM_ERROR)
  }
}

export async function getMatrix(query: any) {
  const { device_id, year_month, year } = query
  if (!device_id) throw new AppError('设备ID不能为空', ErrorCode.PARAM_INVALID)

  let ym = year_month
  if (!ym && year) ym = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  if (!ym) ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const [yr, mo] = ym.split('-').map(Number)
  const daysInMonth = new Date(yr, mo, 0).getDate()

  // 提前计算 period_keys 集（纯工具函数，已测试）
  const dailyKeys = dailyPeriodKeys(yr, mo)
  const weekKeys = weeklyPeriodKeys(yr, mo)

  // 1. 查该设备全部启用标准
  const standards = await DeviceMaintenanceStandard.findAll({
    where: { device_id, status: 1 },
    order: [['trigger_mode', 'ASC'], ['sort_order', 'ASC'], ['standard_id', 'ASC']],
  })

  // 2. 按 trigger_mode 分组
  const dailyStds: any[] = []
  const weeklyStds: any[] = []
  const monthlyStds: any[] = []
  const runtimeStds: any[] = []
  standards.forEach((s: any) => {
    const tm = s.getDataValue('trigger_mode')
    if (tm === 'daily') dailyStds.push(s)
    else if (tm === 'weekly') weeklyStds.push(s)
    else if (tm === 'monthly') {
      const mp = s.getDataValue('monthly_plan')
      if (monthlyStandardActive(mp, mo)) monthlyStds.push(s)
    } else if (tm === 'runtime') runtimeStds.push(s)
  })

  // 3. 查该设备在该月内的所有执行记录
  const dailyStart = dailyKeys[0]
  const dailyEnd = dailyKeys[dailyKeys.length - 1]

  const records = await DeviceMaintenanceRecord.findAll({
    where: {
      device_id,
      [Op.or]: [
        // daily: period_key 落在这个月
        { trigger_mode: 'daily', period_key: { [Op.gte]: dailyStart, [Op.lte]: dailyEnd } },
        // weekly: period_key = YYYY-Www，取这个月里覆盖到的周
        { trigger_mode: 'weekly', period_key: { [Op.in]: weekKeys } },
        // monthly: period_key = YYYY-MM
        { trigger_mode: 'monthly', period_key: ym },
      ],
    },
    attributes: ['record_id', 'standard_id', 'trigger_mode', 'period_key',
      'status', 'result', 'actual_value', 'executor_name', 'executor_id',
      'start_time', 'end_time', 'duration_min', 'abnormal_desc'],
  })

  // 构建 recordsMap: (trigger_mode, period_key, standard_id) → record
  const recordsMap = new Map<string, any>()
  records.forEach((r: any) => {
    const raw = r.toJSON()
    const key = `${raw.trigger_mode}|${raw.period_key}|${raw.standard_id}`
    recordsMap.set(key, raw)
  })

  // 4. 组装矩阵
  const buildMatrixRecords = (std: any, mode: string, periodKeys: string[]): Record<string, any> => {
    const out: Record<string, any> = {}
    periodKeys.forEach(pk => {
      const rec = recordsMap.get(`${mode}|${pk}|${std.getDataValue('standard_id')}`)
      out[pk] = rec ? {
        record_id: rec.record_id,
        status: rec.status,
        result: rec.result,
        actual_value: rec.actual_value,
        executor: rec.executor_name,
        start_time: rec.start_time,
        end_time: rec.end_time,
        duration_min: rec.duration_min,
        abnormal_desc: rec.abnormal_desc,
      } : null
    })
    return out
  }

  const resultDaily: any[] = dailyStds.map((s: any) => ({
    standard_id: s.getDataValue('standard_id'),
    maintenance_content: s.getDataValue('maintenance_content'),
    mechanism: s.getDataValue('mechanism'),
    component: s.getDataValue('component'),
    location: s.getDataValue('location'),
    maintenance_method: s.getDataValue('maintenance_method'),
    judge_type: s.getDataValue('judge_type'),
    standard_value: s.getDataValue('standard_value'),
    unit: s.getDataValue('unit'),
    sort_order: s.getDataValue('sort_order'),
    point_count: s.getDataValue('point_count'),
    time_per_point: s.getDataValue('time_per_point'),
    records: buildMatrixRecords(s, 'daily', dailyKeys),
  }))

  const resultWeekly: any[] = weeklyStds.map((s: any) => ({
    standard_id: s.getDataValue('standard_id'),
    maintenance_content: s.getDataValue('maintenance_content'),
    mechanism: s.getDataValue('mechanism'),
    component: s.getDataValue('component'),
    location: s.getDataValue('location'),
    maintenance_method: s.getDataValue('maintenance_method'),
    judge_type: s.getDataValue('judge_type'),
    standard_value: s.getDataValue('standard_value'),
    unit: s.getDataValue('unit'),
    point_count: s.getDataValue('point_count'),
    time_per_point: s.getDataValue('time_per_point'),
    sort_order: s.getDataValue('sort_order'),
    records: buildMatrixRecords(s, 'weekly', weekKeys),
  }))

  const resultMonthly: any[] = monthlyStds.map((s: any) => ({
    standard_id: s.getDataValue('standard_id'),
    maintenance_content: s.getDataValue('maintenance_content'),
    mechanism: s.getDataValue('mechanism'),
    component: s.getDataValue('component'),
    location: s.getDataValue('location'),
    maintenance_method: s.getDataValue('maintenance_method'),
    judge_type: s.getDataValue('judge_type'),
    standard_value: s.getDataValue('standard_value'),
    unit: s.getDataValue('unit'),
    point_count: s.getDataValue('point_count'),
    time_per_point: s.getDataValue('time_per_point'),
    monthly_plan: s.getDataValue('monthly_plan'),
    sort_order: s.getDataValue('sort_order'),
    records: buildMatrixRecords(s, 'monthly', [ym]),
  }))

  // 5. 汇总统计
  const completedCount = (items: any[]) => items.reduce((acc, it) => {
    return acc + Object.values(it.records).filter((v: any) => v && v.status === '已完成').length
  }, 0)
  const pendingCount = (items: any[]) => items.reduce((acc, it) => {
    return acc + Object.values(it.records).filter((v: any) => v === null || v.status === '待执行').length
  }, 0)
  const abnormalCount = (items: any[]) => items.reduce((acc, it) => {
    return acc + Object.values(it.records).filter((v: any) => v && v.result === '异常').length
  }, 0)

  const dailyTotal = resultDaily.length * daysInMonth
  const dailyCompleted = completedCount(resultDaily)
  const weeklyTotal = resultWeekly.length * weekKeys.length
  const weeklyCompleted = completedCount(resultWeekly)
  const monthlyTotal = resultMonthly.length
  const monthlyCompleted = completedCount(resultMonthly)

  // 设备基础信息
  const Device = (await import('../models/index.js')).Device
  const device = await Device.findOne({ where: { device_id } })

  return {
    device_id: Number(device_id),
    device_code: (device as any)?.getDataValue('device_code') || null,
    device_name: (device as any)?.getDataValue('device_name') || null,
    year_month: ym,
    year: yr,
    month: mo,
    days_in_month: daysInMonth,
    week_keys: weekKeys,
    daily: { items: resultDaily },
    weekly: { items: resultWeekly },
    monthly: { items: resultMonthly },
    summary: {
      daily_total: dailyTotal,
      daily_completed: dailyCompleted,
      daily_rate: dailyTotal > 0 ? Math.round((dailyCompleted / dailyTotal) * 100) : 0,
      weekly_total: weeklyTotal,
      weekly_completed: weeklyCompleted,
      weekly_rate: weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0,
      monthly_total: monthlyTotal,
      monthly_completed: monthlyCompleted,
      monthly_rate: monthlyTotal > 0 ? Math.round((monthlyCompleted / monthlyTotal) * 100) : 0,
      abnormal_count: abnormalCount([...resultDaily, ...resultWeekly, ...resultMonthly]),
    },
  }
}
