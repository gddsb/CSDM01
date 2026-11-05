/**
 * TodoService —— PC / 移动端待办事项统一口径
 *
 * 口径约定（业务确认 2026-11）：
 *  - 待维保 / 点检 只统计“本人负责 + 本人检查”的设备
 *    （device_record.responsible_user_id / inspector_user_id）
 *  - 每日待点检 = daily + 今日 period_key + 待执行
 *  - 定期待保养项 = weekly/monthly + 本周/本月 period_key + 待执行/执行中（按项目数计）
 *  - 待维保设备 = 日/周/月未完成记录的设备台数（去重）
 */
import { Op } from 'sequelize'
import {
  Order, DeviceMaintenanceRecord, DeviceFault, DeviceCalibrationPlan,
  IncomingInspection, QualityEnvInspection,
} from '../models/index.js'
import { todayStr, getISOWeek } from '../utils/maintenanceMatrix.js'

export interface DashboardTodos {
  /** 待完工订单（开工中） */
  pendingOrders: number
  /** 待维保设备台数（日/周/月未完成，去重） */
  pendingMaintenanceDevices: number
  /** 每日待点检（今日 daily 待执行） */
  dailyInspection: number
  /** 定期待保养项（本周周保养 + 本月月保养的项目数） */
  periodicMaintenance: number
  /** 设备故障待处理（待派工/维修中/待审批） */
  pendingFaults: number
  /** 校准到期 */
  pendingCalibration: number
  /** 待检验来料 */
  pendingIncoming: number
  /** 待检验环境 */
  pendingEnv: number
}

export async function getDashboardTodos(user: any): Promise<DashboardTodos> {
  const uid = Number(user?.userId ?? user?.user_id ?? 0)
  const now = new Date()
  const today = todayStr()
  const weekKey = getISOWeek(now)
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // 本人负责 or 本人检查；未取到用户 ID 时不加限制（兼容内部调用）
  const ownerFilter: any = uid > 0
    ? { [Op.or]: [{ responsible_user_id: uid }, { inspector_user_id: uid }] }
    : {}

  const unfinished = { status: { [Op.in]: [0, 1] } }

  const [
    pendingOrders, pendingMaintenanceDevices, dailyInspection, periodicMaintenance,
    pendingFaults, pendingCalibration, pendingIncoming, pendingEnv,
  ] = await Promise.all([
    Order.count({ where: { status: 2 } }),
    DeviceMaintenanceRecord.count({
      where: {
        ...unfinished,
        ...ownerFilter,
        trigger_mode: { [Op.in]: ['daily', 'weekly', 'monthly'] },
        period_key: { [Op.in]: [today, weekKey, monthKey] },
      },
      distinct: true,
      col: 'device_id',
    }),
    DeviceMaintenanceRecord.count({
      where: {
        status: 0,
        ...ownerFilter,
        trigger_mode: 'daily',
        period_key: today,
      },
    }),
    DeviceMaintenanceRecord.count({
      where: {
        ...unfinished,
        ...ownerFilter,
        trigger_mode: { [Op.in]: ['weekly', 'monthly'] },
        period_key: { [Op.in]: [weekKey, monthKey] },
      },
    }),
    DeviceFault.count({ where: { status: { [Op.in]: [0, 1, 2] } } }),
    DeviceCalibrationPlan.count({ where: { status: 0 } }),
    IncomingInspection.count({ where: { status: 0 } }),
    QualityEnvInspection.count({ where: { status: 0 } }),
  ])

  return {
    pendingOrders,
    pendingMaintenanceDevices,
    dailyInspection,
    periodicMaintenance,
    pendingFaults,
    pendingCalibration,
    pendingIncoming,
    pendingEnv,
  }
}
