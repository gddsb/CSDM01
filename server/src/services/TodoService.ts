/**
 * TodoService —— PC / 移动端待办事项统一口径
 *
 * 口径约定（业务确认 2026-11-09）：
 *  - 移除 dailyInspection / periodicMaintenance，维保相关统一用 pendingMaintenanceDevices
 *  - 待维保设备 = 日/周/月未完成记录的设备台数（去重，本人负责/检查）
 *  - 检验合并口径：前端合并 pendingIncoming + pendingEnv 显示为"待检验任务"
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

  const ownerFilter: any = uid > 0
    ? { [Op.or]: [{ responsible_user_id: uid }, { inspector_user_id: uid }] }
    : {}

  const unfinished = { status: { [Op.in]: [0, 1] } }

  const [
    pendingOrders, pendingMaintenanceDevices,
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
    DeviceFault.count({ where: { status: { [Op.in]: [0, 1, 2] } } }),
    DeviceCalibrationPlan.count({ where: { status: 0 } }),
    IncomingInspection.count({ where: { status: 0 } }),
    QualityEnvInspection.count({ where: { status: 0 } }),
  ])

  return {
    pendingOrders,
    pendingMaintenanceDevices,
    pendingFaults,
    pendingCalibration,
    pendingIncoming,
    pendingEnv,
  }
}
