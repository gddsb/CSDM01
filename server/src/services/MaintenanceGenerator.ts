/** MaintenanceGenerator —— 工单生成 + 保养矩阵 */
/**
 * generateRecords: 按月批量生成日/周/月保养执行记录（带 Upsert + Sync DELETE）
 *   - 并发保护：同 (target_month, device_id) 未完成前丢弃后续请求
 *   - Upsert：expected 中存在的 → 同步冗余字段（device_code/name）；不存在的 → 新增
 *   - Sync DELETE：existing 中不在 expected 里的，且为 "待执行" + 未过期 + 非 runtime → 删除
 *   - skip_past：默认 true，已过期 daily 不参与 Upsert，也不参与 DELETE 边界
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

// ===== 并发锁（模块级 Map）=====
// lockKey = `${target_month}|${device_id ?? 'ALL'}`
// 同 (target_month, device_id) 只允许一个 generateRecords 在执行
const genLocks = new Map<string, number>()

/** DELETE 安全边界：只允许删 status='待执行' 的记录 */
const DELETABLE_STATUSES = ['待执行'] as const

/** generateRecords —— 按月批量生成（带并发锁 + Upsert + Sync DELETE） */
export async function generateRecords(body: any) {
  const { target_month, device_id, skip_past } = body || {}

  // 1. 参数校验
  if (!target_month || !/^\d{4}-\d{2}$/.test(String(target_month))) {
    throw new AppError('target_month 格式错误，应为 YYYY-MM', ErrorCode.PARAM_INVALID)
  }
  const [yr, mo] = String(target_month).split('-').map(Number)
  const isCurrentMonth = target_month === todayStr().slice(0, 7)
  const skipPast = skip_past !== false  // 默认 true
  const lockKey = `${target_month}|${device_id ?? 'ALL'}`

  // 2. 并发锁校验 + 占位
  if (genLocks.has(lockKey)) {
    throw new AppError('正在生成执行记录中，请稍候再试', ErrorCode.DUPLICATE_REQUEST)
  }
  genLocks.set(lockKey, Date.now())

  // DEBUG 日志
  const _dbg = (msg: string, obj?: any) => {
    console.log(`[GEN_DEBUG][${target_month}] ${msg}`, obj !== undefined ? obj : '')
  }

  const t = await DeviceMaintenanceRecord.sequelize.transaction()
  try {
    // 3. 查生效设备档案
    const effectiveProfiles = await DeviceMaintenanceProfile.findAll({
      where: { status: '生效' },
      attributes: ['device_id'],
      transaction: t,
    })
    let effectiveDeviceIds = effectiveProfiles.map((p: any) => p.getDataValue('device_id'))
    _dbg('Step3 effectiveDeviceIds count=', effectiveDeviceIds.length)
    _dbg('Step3 effectiveDeviceIds sample=', effectiveDeviceIds.slice(0, 5))
    _dbg('Step3 effectiveDeviceIds types=', effectiveDeviceIds.slice(0, 3).map(id => typeof id))
    if (device_id) effectiveDeviceIds = effectiveDeviceIds.filter(id => id === Number(device_id))
    _dbg('Step3 after filter device_id=', effectiveDeviceIds.length)
    if (effectiveDeviceIds.length === 0) {
      _dbg('Step3 → effectiveDeviceIds 为空，直接 return 0')
      await t.commit()
      return { created: 0, updated: 0, deleted: 0, skipped: 0, records: [] }
    }

    // 4. 查日/周/月三种模式的保养标准（不含 runtime）
    const standards = await DeviceMaintenanceStandard.findAll({
      where: {
        trigger_mode: { [Op.in]: ['daily', 'weekly', 'monthly'] },
        status: 1,
        device_id: { [Op.in]: effectiveDeviceIds },
      },
      transaction: t,
    })
    _dbg('Step4 standards total=', standards.length)
    const modeCnt: Record<string, number> = {}
    standards.forEach((s: any) => { modeCnt[s.getDataValue('trigger_mode')] = (modeCnt[s.getDataValue('trigger_mode')] || 0) + 1 })
    _dbg('Step4 standards by trigger_mode=', modeCnt)

    // monthly 标准的 monthly_plan 可能只在某些月份生效
    const activeStandards = standards.filter((s: any) => {
      const tm = s.getDataValue('trigger_mode')
      if (tm === 'monthly') return monthlyStandardActive(s.getDataValue('monthly_plan'), mo)
      return true
    })
    _dbg('Step4 activeStandards after monthlyPlan filter=', activeStandards.length)
    const activeModeCnt: Record<string, number> = {}
    activeStandards.forEach((s: any) => { activeModeCnt[s.getDataValue('trigger_mode')] = (activeModeCnt[s.getDataValue('trigger_mode')] || 0) + 1 })
    _dbg('Step4 activeStandards by trigger_mode=', activeModeCnt)

    if (activeStandards.length === 0) {
      _dbg('Step4 → activeStandards 为空，直接 return 0')
      await t.commit()
      return { created: 0, updated: 0, deleted: 0, skipped: 0, records: [] }
    }

    // 5. 计算每种模式的 period_keys（expected 全集）
    const dailyKeys = dailyPeriodKeys(yr, mo)
    const weekKeys = weeklyPeriodKeys(yr, mo)
    // 本月 + skipPast → daily 只取今天及以后（过期的不参与 Upsert，也参与不了 DELETE 边界）
    const effectiveDailyKeys = (isCurrentMonth && skipPast)
      ? dailyKeys.filter(pk => pk >= todayStr())
      : dailyKeys
    _dbg('Step5 dailyKeys count=', dailyKeys.length)
    _dbg('Step5 weekKeys=', weekKeys)
    _dbg('Step5 effectiveDailyKeys count=', effectiveDailyKeys.length)

    // 构建 stdPeriodMap: standard_id → period_key[]
    const stdPeriodMap: Record<number, string[]> = {}
    for (const s of activeStandards) {
      const sid = s.getDataValue('standard_id')
      const tm = s.getDataValue('trigger_mode')
      let keys: string[] = []
      if (tm === 'daily') keys = effectiveDailyKeys
      else if (tm === 'weekly') keys = weekKeys
      else if (tm === 'monthly') keys = [target_month]
      stdPeriodMap[sid] = keys
    }
    _dbg('Step5 stdPeriodMap entries=', Object.keys(stdPeriodMap).length)

    // 查 DB 中该 device_id 集合 + 该月 涉及的所有执行记录（含 status 做 DELETE 安全边界）
    // daily: period_key 落在 dailyKeys 范围内；weekly: weekKeys；monthly: = target_month
    const allPeriodKeys = new Set<string>()
    Object.values(stdPeriodMap).forEach(keys => keys.forEach(k => allPeriodKeys.add(k)))

    _dbg('Step5 查询 existingRecords: device_id IN count=', effectiveDeviceIds.length)
    _dbg('Step5 查询 weekly period_key IN=', weekKeys)
    _dbg('Step5 查询 monthly period_key=', target_month)

    const existingRecords: any[] = await DeviceMaintenanceRecord.findAll({
      where: {
        device_id: { [Op.in]: effectiveDeviceIds },
        [Op.or]: [
          { trigger_mode: 'daily', period_key: { [Op.gte]: dailyKeys[0], [Op.lte]: dailyKeys[dailyKeys.length - 1] } },
          { trigger_mode: 'weekly', period_key: { [Op.in]: weekKeys } },
          { trigger_mode: 'monthly', period_key: target_month },
        ],
      },
      attributes: ['record_id', 'standard_id', 'period_key', 'trigger_mode', 'status', 'device_code', 'device_name'],
      transaction: t,
    })
    _dbg('Step5 existingRecords total=', existingRecords.length)
    const existModeCnt: Record<string, number> = {}
    existingRecords.forEach((r: any) => { existModeCnt[r.getDataValue('trigger_mode')] = (existModeCnt[r.getDataValue('trigger_mode')] || 0) + 1 })
    _dbg('Step5 existingRecords by trigger_mode=', existModeCnt)
    if (existingRecords.length > 0) {
        const firstFew = existingRecords.slice(0, 3).map((r: any) => ({
            tm: r.getDataValue('trigger_mode'),
            pk: r.getDataValue('period_key'),
            stdId: r.getDataValue('standard_id'),
            status: r.getDataValue('status'),
        }))
        _dbg('Step5 existingRecords first 3 sample=', firstFew)
    }

    // 6. 分类处理：expected ∩ existing / expected - existing / existing - expected
    const expectedKeys = new Map<string, string>()  // key = "standard_id|period_key" → period_key（用于反查）
    Object.entries(stdPeriodMap).forEach(([sid, pks]) => {
      pks.forEach(pk => expectedKeys.set(`${sid}|${pk}`, pk))
    })
    _dbg('Step6 expectedKeys total=', expectedKeys.size)

    // 按 trigger_mode 统计 expectedKeys
    let expDaily = 0, expWeekly = 0, expMonthly = 0
    for (const s of activeStandards) {
        const keys = stdPeriodMap[s.getDataValue('standard_id')] || []
        if (s.getDataValue('trigger_mode') === 'daily') expDaily += keys.length
        else if (s.getDataValue('trigger_mode') === 'weekly') expWeekly += keys.length
        else if (s.getDataValue('trigger_mode') === 'monthly') expMonthly += keys.length
    }
    _dbg('Step6 expectedKeys by trigger_mode:', { daily: expDaily, weekly: expWeekly, monthly: expMonthly })

    const existingMap = new Map<string, any>()
    existingRecords.forEach(r => {
      const key = `${r.getDataValue('standard_id')}|${r.getDataValue('period_key')}`
      existingMap.set(key, r)
    })
    _dbg('Step6 existingMap size=', existingMap.size)

    const todayKey = todayStr()  // 'YYYY-MM-DD'
    let created = 0, updated = 0, deleted = 0

    // 6a. expected 与 existing 的交集 → UPSERT（更新 device_code/name 冗余字段）
    let upsertHit = 0
    for (const [key, pk] of expectedKeys) {
      const exist = existingMap.get(key)
      if (!exist) continue
      upsertHit++
      const sid = Number(key.split('|')[0])
      const std = activeStandards.find((s: any) => s.getDataValue('standard_id') === sid)
      if (!std) continue
      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(
        std.getDataValue('device_id'),
        std.getDataValue('device_code'),
        std.getDataValue('device_name'),
        t,
      )
      // 只在冗余字段有变化时才 UPDATE，减少写操作
      const curCode = exist.getDataValue('device_code')
      const curName = exist.getDataValue('device_name')
      if (curCode !== finalDeviceCode || curName !== finalDeviceName) {
        await DeviceMaintenanceRecord.update(
          { device_code: finalDeviceCode, device_name: finalDeviceName },
          { where: { record_id: exist.getDataValue('record_id') }, transaction: t },
        )
        updated++
      }
    }
    _dbg('Step6a upsert hit (expected ∩ existing)=' + upsertHit + ', updated=' + updated)

    // 6b. expected - existing → CREATE（新增缺少的）
    const createdList: any[] = []
    for (const [key, pk] of expectedKeys) {
      if (existingMap.has(key)) continue
      const sid = Number(key.split('|')[0])
      const std = activeStandards.find((s: any) => s.getDataValue('standard_id') === sid)
      if (!std) continue
      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(
        std.getDataValue('device_id'),
        std.getDataValue('device_code'),
        std.getDataValue('device_name'),
        t,
      )
      const recordNo = await generateDeviceRecordNo()
      const r = await DeviceMaintenanceRecord.create({
        record_no: recordNo,
        standard_id: sid,
        device_id: std.getDataValue('device_id'),
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        trigger_mode: std.getDataValue('trigger_mode'),
        period_key: pk,
        status: 0,
        remarks: '',
      }, { transaction: t })
      created++
      createdList.push(r)
    }

    // 6c. existing - expected → DELETE（清理已失效的）
    // 三保险：仅删 status='待执行' + 未过期 daily + 非 runtime
    for (const exist of existingRecords) {
      const key = `${exist.getDataValue('standard_id')}|${exist.getDataValue('period_key')}`
      if (expectedKeys.has(key)) continue  // 在 expected 里的不动
      const tm = exist.getDataValue('trigger_mode')
      const pk = exist.getDataValue('period_key')
      // 已过期 daily 不删
      if (tm === 'daily' && pk < todayKey) continue
      // runtime 不碰
      if (tm === 'runtime') continue
      // 只有"待执行"状态能删，已完成/执行中/跳过的保留历史
      if (!DELETABLE_STATUSES.includes(exist.getDataValue('status'))) continue
      await exist.destroy({ transaction: t })
      deleted++
    }

    await t.commit()
    return {
      created, updated, deleted,
      records: createdList.map((r: any) => ({ record_id: r.record_id, record_no: r.record_no })),
    }
  } catch (err: any) {
    if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
    throw new AppError(err.message || '生成失败', ErrorCode.SYSTEM_ERROR)
  } finally {
    // 释放并发锁（无论成功/失败）
    genLocks.delete(lockKey)
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
