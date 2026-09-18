/** MaintenanceGenerator —— 工单生成 + 保养矩阵 */
/**
 * DeviceMaintenanceProfileService — 保养档案 + 执行工单 + 矩阵 + 运行时长
 * 从 origin/main 的 DeviceMaintenanceController.ts 抽取
 * uploadImage / processImage 涉及 fs/sharp，保留在 Controller
 */
import { Op, QueryTypes } from 'sequelize'
import sequelize from 'sequelize'
import {
  DeviceMaintenanceProfile, DeviceMaintenanceRecord, DeviceMaintenanceStandard,
  DeviceRuntimeLog, Device, DeviceFault, DeviceImage,
} from '../models/index.js'
import { generateDeviceFaultNo, generateDeviceRecordNo } from '../utils/sequence.js'
import { ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE } from '../models/DeviceMaintenanceRecord.js'
import {
  todayStr, dateOnlyStr, getISOWeek, buildPeriodKey, parseMultiStatus,
  dailyPeriodKeys, weeklyPeriodKeys, parseMonthlyPlan, monthlyStandardActive,
} from '../utils/maintenanceMatrix.js'
import { UNFINISHED_STATUS, rawStatus, loadDeviceFields, getLatestRuntime } from './MaintenanceProfileCrud.js'
export async function generateRecords(body: any) {
const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { mode, target_date, device_id } = body || {}
      const targetDate = target_date ? new Date(target_date) : new Date()
      const today = todayStr()
      const targetModes: string[] = mode
        ? (Array.isArray(mode) ? mode : [mode])
        : ['daily', 'weekly', 'monthly', 'runtime']

      const createdList: any[] = []

      // 仅对档案状态=生效的设备生成执行记录
      const effectiveProfiles = await DeviceMaintenanceProfile.findAll({
        where: { status: '生效' },
        attributes: ['device_id'],
        transaction: t,
      })
      let effectiveDeviceIds = effectiveProfiles.map((p: any) => p.getDataValue('device_id'))
      // 若限定单台设备，进一步取交集
      if (device_id) {
        effectiveDeviceIds = effectiveDeviceIds.filter(id => id === Number(device_id))
      }
      if (effectiveDeviceIds.length === 0) {
        await t.commit()
        return { created: 0, total: 0, records: [] }
      }

      for (const m of targetModes) {
        if (!['daily', 'weekly', 'monthly', 'runtime'].includes(m)) continue

        const stdWhere: any = { trigger_mode: m, status: 1, device_id: { [Op.in]: effectiveDeviceIds } }

        const standards = await DeviceMaintenanceStandard.findAll({ where: stdWhere, transaction: t })

        // 预先查已有未完成的执行记录（runtime 模式用 period_key 不固定，所以按 (standard_id, status != 2) 查）
        const activeStandards: any[] = []

        if (m === 'runtime') {
          // runtime 模式：查已有未完成的执行记录
          const unfinished = await DeviceMaintenanceRecord.findAll({
            where: {
              standard_id: { [Op.in]: standards.map((s: any) => s.getDataValue('standard_id')) },
              status: { [Op.in]: UNFINISHED_STATUS },
            },
            attributes: ['standard_id'],
            transaction: t,
          })
          const unfinishedSet = new Set(unfinished.map((r: any) => r.getDataValue('standard_id')))

          for (const s of standards) {
            const sid = s.getDataValue('standard_id')
            if (unfinishedSet.has(sid)) continue
            const threshold = Number(s.getDataValue('runtime_threshold')) || 0
            if (!threshold) continue
            const currentRuntime = await getLatestRuntime(s.getDataValue('device_id'), t)
            const lastVal = Number(s.getDataValue('last_trigger_value')) || 0
            if (currentRuntime - lastVal < threshold) continue
            activeStandards.push({ s, currentRuntime })
          }
        } else {
          // daily/weekly/monthly：按 period_key 去重
          const periodKeys: string[] = []
          const stdPeriodMap: Record<number, string> = {}
          for (const s of standards) {
            const pk = buildPeriodKey(m, targetDate)
            periodKeys.push(pk)
            stdPeriodMap[s.getDataValue('standard_id')] = pk
          }
          if (periodKeys.length > 0) {
            const existing = await DeviceMaintenanceRecord.findAll({
              where: {
                standard_id: { [Op.in]: standards.map((s: any) => s.getDataValue('standard_id')) },
                period_key: { [Op.in]: periodKeys },
              },
              attributes: ['standard_id', 'period_key'],
              transaction: t,
            })
            const existSet = new Set(existing.map((r: any) => `${r.getDataValue('standard_id')}|${r.getDataValue('period_key')}`))
            for (const s of standards) {
              const sid = s.getDataValue('standard_id')
              const pk = stdPeriodMap[sid]
              if (existSet.has(`${sid}|${pk}`)) continue
              activeStandards.push({ s, periodKey: pk })
            }
          }
        }

        // 批量创建
        for (const { s, periodKey, currentRuntime } of activeStandards) {
          const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(
            s.getDataValue('device_id'),
            s.getDataValue('device_code'),
            s.getDataValue('device_name'),
            t,
          )
          let finalPeriodKey = periodKey
          if (m === 'runtime') {
            finalPeriodKey = buildPeriodKey('runtime', new Date(), s.getDataValue('standard_id'), s.getDataValue('device_id'), Number(s.getDataValue('runtime_threshold')))
          }

          const recordNo = await generateDeviceRecordNo()
          const created = await DeviceMaintenanceRecord.create({
            record_no: recordNo,
            standard_id: s.getDataValue('standard_id'),
            device_id: s.getDataValue('device_id'),
            device_code: finalDeviceCode,
            device_name: finalDeviceName,
            trigger_mode: m,
            period_key: finalPeriodKey,
            status: 0,
            remarks: m === 'runtime'
              ? `运行时长${currentRuntime}h 达阈值${s.getDataValue('runtime_threshold')}h，自动生成`
              : '自动生成',
          }, { transaction: t })
          createdList.push(created)

          // runtime 模式推进 last_trigger_value
          if (m === 'runtime') {
            await s.update({ last_trigger_value: String(currentRuntime) }, { transaction: t })
          }
        }
      }

      await t.commit()
      return {
        created: createdList.length,
        total: createdList.length,
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

