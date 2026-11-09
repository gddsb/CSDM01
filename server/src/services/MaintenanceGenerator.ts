/** MaintenanceGenerator —— 工单生成 + 保养矩阵 */
/**
 * generateRecords: 按月批量生成日/周/月保养维保计划（带 Upsert + Sync DELETE）
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
  DeviceImage, DeviceFault, User,
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

/** DELETE 安全边界：只允许删 status=0 待执行的记录（用数字，与 getDataValue 返回值一致） */
const DELETABLE_STATUS_VALUES = [0]

/** 休息日判断：显式 dic_holiday 优先 → 否则周六周日默认休息 */
function isRestDate(dateStr: string, holidayMap: Map<string, number>): boolean {
  const explicit = holidayMap.get(dateStr)
  if (explicit !== undefined) return explicit === 0  // 0=休息日, 1=调休上班(不是休息日)
  // 默认：周六周日休息
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay()
  return dow === 0 || dow === 6
}

/** 构建某月 holidayMap（日期字符串 → is_workday: 0=休息/1=上班） */
async function buildHolidayMap(yr: number, mo: number, t?: any): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const DicHoliday = (await import('../models/DicHoliday.js')).default
    const holidays = await DicHoliday.findAll({
      where: sequelize.where(
        sequelize.fn('DATE_FORMAT', sequelize.col('holiday_date'), '%Y-%m'),
        `${String(yr).padStart(4, '0')}-${String(mo).padStart(2, '0')}`,
      ),
      attributes: ['holiday_date', 'is_workday'],
      transaction: t,
    })
    for (const h of holidays) {
      const d = h.getDataValue('holiday_date')
      map.set(dateOnlyStr(new Date(d)), Number(h.getDataValue('is_workday') || 0))
    }
  } catch { /* dic_holiday 表不存在时静默 */ }
  return map
}

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
    throw new AppError('正在生成维保计划中，请稍候再试', ErrorCode.DUPLICATE_REQUEST)
  }
  genLocks.set(lockKey, Date.now())

  const t = await DeviceMaintenanceRecord.sequelize.transaction()
  try {
    // 3. 查生效设备档案
    const effectiveProfiles = await DeviceMaintenanceProfile.findAll({
      where: { status: '生效' },
      attributes: ['device_id'],
      transaction: t,
    })
    let effectiveDeviceIds = effectiveProfiles.map((p: any) => p.getDataValue('device_id'))
    if (device_id) effectiveDeviceIds = effectiveDeviceIds.filter(id => id === Number(device_id))
    if (effectiveDeviceIds.length === 0) {
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

    // monthly 标准的 monthly_plan 可能只在某些月份生效
    const activeStandards = standards.filter((s: any) => {
      const tm = s.getDataValue('trigger_mode')
      if (tm === 'monthly') return monthlyStandardActive(s.getDataValue('monthly_plan'), mo)
      return true
    })
    if (activeStandards.length === 0) {
      await t.commit()
      return { created: 0, updated: 0, deleted: 0, skipped: 0, records: [] }
    }

    // 4a. 一次性查 sys_user 建 userMap（user_id → real_name），
    //     避免 device_standard.assigned_user_name / inspector_user_name 为 NULL 时冗余字段也是 NULL
    const allUserIds = new Set<number>()
    for (const s of activeStandards) {
      const aids = (s.getDataValue('assigned_user_ids') as any[]) || []
      const iids = (s.getDataValue('inspector_user_ids') as any[]) || []
      aids.forEach((id: number) => id && allUserIds.add(Number(id)))
      iids.forEach((id: number) => id && allUserIds.add(Number(id)))
    }
    const userMap = new Map<number, string>()
    if (allUserIds.size > 0) {
      const users = await User.findAll({
        where: { user_id: { [Op.in]: Array.from(allUserIds) } },
        attributes: ['user_id', 'real_name'],
      })
      users.forEach((u: any) => userMap.set(u.user_id, u.real_name))
    }

    // 5. 计算每种模式的 period_keys（expected 全集）
    const dailyKeys = dailyPeriodKeys(yr, mo)
    const weekKeys = weeklyPeriodKeys(yr, mo)

    // 5a. 查 dic_holiday + 默认周六周日 → 过滤掉休息日（daily 模式）
    // 只有 daily 模式按具体日期跳过；weekly/monthly 不受影响
    const holidayMap = await buildHolidayMap(yr, mo, t)
    const filteredDailyKeys = dailyKeys.filter(pk => !isRestDate(pk, holidayMap))

    // 本月 + skipPast → daily 只取今天及以后（过期的不参与 Upsert，也参与不了 DELETE 边界）
    const effectiveDailyKeys = (isCurrentMonth && skipPast)
      ? filteredDailyKeys.filter(pk => pk >= todayStr())
      : filteredDailyKeys

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

    // 查 DB 中该 device_id 集合 + 该月 涉及的所有执行记录（含 status 做 DELETE 安全边界）
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

    // 6. 分类处理：expected ∩ existing / expected - existing / existing - expected
    const expectedKeys = new Map<string, string>()  // key = "standard_id|period_key" → period_key（用于反查）
    Object.entries(stdPeriodMap).forEach(([sid, pks]) => {
      pks.forEach(pk => expectedKeys.set(`${sid}|${pk}`, pk))
    })

    const existingMap = new Map<string, any>()
    existingRecords.forEach(r => {
      const key = `${r.getDataValue('standard_id')}|${r.getDataValue('period_key')}`
      existingMap.set(key, r)
    })

    const todayKey = todayStr()  // 'YYYY-MM-DD'
    let created = 0, updated = 0, deleted = 0

    // 6a. expected 与 existing 的交集 → UPSERT（更新 device_code/name 冗余字段）
    for (const [key, pk] of expectedKeys) {
      const exist = existingMap.get(key)
      if (!exist) continue
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

      // 从 standard 展开责任人/检查人
      const assignedUserIds: number[] = (std.getDataValue('assigned_user_ids') as any[]) || []
      const inspectorUserIds: number[] = (std.getDataValue('inspector_user_ids') as any[]) || []
      const respId = assignedUserIds[0] ?? null
      const inspId = inspectorUserIds[0] ?? null
      const respName = std.getDataValue('assigned_user_name') || (respId ? userMap.get(respId) ?? null : null)
      const inspName = std.getDataValue('inspector_user_name') || (inspId ? userMap.get(inspId) ?? null : null)

      const r = await DeviceMaintenanceRecord.create({
        record_no: recordNo,
        standard_id: sid,
        device_id: std.getDataValue('device_id'),
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        trigger_mode: std.getDataValue('trigger_mode'),
        period_key: pk,
        status: 0,
        responsible_user_id: respId,
        responsible_user_name: respName,
        inspector_user_id: inspId,
        inspector_user_name: inspName,
        remarks: '',
      }, { transaction: t })
      created++
      createdList.push(r)
    }

    // 6c. existing - expected → UPDATE status=3 '跳过'（休息日/已失效）
    // 三保险：仅改 status='待执行' + 未过期 daily + 非 runtime
    // 改为"跳过"比物理删除更友好：保留历史追溯 + 不破坏已关联数据
    for (const exist of existingRecords) {
      const key = `${exist.getDataValue('standard_id')}|${exist.getDataValue('period_key')}`
      if (expectedKeys.has(key)) continue  // 在 expected 里的不动
      const tm = exist.getDataValue('trigger_mode')
      const pk = exist.getDataValue('period_key')
      // 已过期 daily 不改（历史已生成的不动）
      if (tm === 'daily' && pk < todayKey) continue
      // runtime 不碰
      if (tm === 'runtime') continue
      // 只有"待执行"状态能改跳过，已完成/执行中/跳过的保留历史
      if (!DELETABLE_STATUS_VALUES.includes(Number(exist.getDataValue('status')))) continue
      await exist.update({ status: 3 }, { transaction: t })  // 3 = '跳过'
      deleted++  // 变量名沿用，语义：被移出 expected 的数量
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

  // 休息日计算（显式 dic_holiday + 默认周六周日）
  const holidayMap = await buildHolidayMap(yr, mo)
  const restDays = dailyKeys.filter(pk => isRestDate(pk, holidayMap))

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
      'start_time', 'end_time', 'duration_min', 'abnormal_desc',
      'inspector_user_id', 'inspector_user_name',
      'inspector_executor_id', 'inspector_executor_name', 'inspected_at'],
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
        executor_id: rec.executor_id,
        start_time: rec.start_time,
        end_time: rec.end_time,
        duration_min: rec.duration_min,
        abnormal_desc: rec.abnormal_desc,
        // 检查人信息
        inspector_user_id: rec.inspector_user_id,
        inspector_user_name: rec.inspector_user_name,
        inspector_executor_id: rec.inspector_executor_id,
        inspector_executor_name: rec.inspector_executor_name,
        inspected_at: rec.inspected_at,
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

  const dailyTotal = resultDaily.length * (daysInMonth - restDays.length)
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
    rest_days: restDays,
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

/** cleanupAndRegenerate —— 清空指定月份所有维保记录（含级联）后重建
 *
 *  清理范围（同一事务内原子执行）：
 *    1. DeviceFault  (related_inspection_id IN 本月 record_ids) — 保养异常自动生成的故障单
 *    2. DeviceImage  (doc_type='maintenance', doc_id IN 本月 record_ids) — 保养图片
 *    3. DeviceMaintenanceRecord (本月全部 period_key) — 维保执行记录（不论状态，含已完成）
 *
 *  重建：调用 generateRecords 按当前生效标准重新生成
 *
 *  安全机制：先查出 record_id 列表，再用 IN 查询级联清理，避免逐条 N+1
 */
export async function cleanupAndRegenerate(body: any) {
  const { target_month, device_id } = body || {}

  if (!target_month || !/^\d{4}-\d{2}$/.test(String(target_month))) {
    throw new AppError('target_month 格式错误，应为 YYYY-MM', ErrorCode.PARAM_INVALID)
  }

  const [yr, mo] = String(target_month).split('-').map(Number)
  const dailyKeys = dailyPeriodKeys(yr, mo)
  const weekKeys = weeklyPeriodKeys(yr, mo)
  const dailyStart = dailyKeys[0]
  const dailyEnd = dailyKeys[dailyKeys.length - 1]

  // 1. 查出本月所有 record_id
  const monthRecordCond: any = [
    { trigger_mode: 'daily', period_key: { [Op.gte]: dailyStart, [Op.lte]: dailyEnd } },
    { trigger_mode: 'weekly', period_key: { [Op.in]: weekKeys } },
    { trigger_mode: 'monthly', period_key: target_month },
  ]
  if (device_id) {
    monthRecordCond.forEach(c => { (c as any).device_id = device_id })
  }

  const existingIds: any[] = await DeviceMaintenanceRecord.findAll({
    where: { [Op.or]: monthRecordCond },
    attributes: ['record_id'],
  })
  const recordIds = existingIds.map(r => Number(r.getDataValue('record_id')))

  if (recordIds.length === 0) {
    // 本月没有记录，直接走生成
    const gen = await generateRecords(body)
    return { ...gen, cleaned: { records: 0, faults: 0, images: 0 }, regenerated: true }
  }

  // 2. 级联清理（同一事务）
  const t = await DeviceMaintenanceRecord.sequelize.transaction()
  try {
    const faultResult = await DeviceFault.destroy({
      where: { related_inspection_id: { [Op.in]: recordIds } },
      transaction: t,
    })

    const imageResult = await DeviceImage.destroy({
      where: { doc_type: 'maintenance', doc_id: { [Op.in]: recordIds } },
      transaction: t,
    })

    const recordResult = await DeviceMaintenanceRecord.destroy({
      where: { [Op.or]: monthRecordCond },
      transaction: t,
    })

    await t.commit()

    // 3. 重新生成（新事务，由 generateRecords 自行管理）
    const gen = await generateRecords(body)

    return {
      cleaned: { records: recordResult, faults: faultResult, images: imageResult },
      regenerated: true,
      ...gen,
    }
  } catch (err: any) {
    if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
    throw new AppError(err.message || '清理重建失败', ErrorCode.SYSTEM_ERROR)
  }
}
