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

/**
 * Dashboard todos 10s 内存缓存
 * 同一用户 10s 内重复请求（Dashboard 30s 轮询 + 多 Tab 同时打开）共享一份结果，
 * 避免瞬间 6 条 COUNT 全表占满连接池。
 * 失效策略：纯 TTL（10s 后自然过期），不需要主动失效钩子。
 * 对于"数据刚变更用户立刻刷新 Dashboard"的场景，最多有 10s 延迟，业务可接受。
 */
interface CacheEntry { at: number; value: DashboardTodos }
const _todosCache = new Map<string, CacheEntry>()
const TODOS_CACHE_TTL = 10_000  // 10s
function cacheKey(uid: number, hasWildcard: boolean, hasMaintView: boolean) {
  return `${uid}_${hasWildcard ? 1 : 0}_${hasMaintView ? 1 : 0}`
}

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

  const permCodes: Set<string> = user?.permCodes ?? new Set()
  const hasWildcard = permCodes.has('*')
  const hasMaintView = hasWildcard || permCodes.has('device:maintenance') || permCodes.has('device:maintenance:view')

  // L1 缓存：10s TTL，key 包含 uid + 权限维度
  const key = cacheKey(uid, hasWildcard, hasMaintView)
  const cached = _todosCache.get(key)
  if (cached && Date.now() - cached.at < TODOS_CACHE_TTL) {
    return cached.value
  }

  const now = new Date()
  const today = todayStr()
  const weekKey = getISOWeek(now)
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // 超级管理员（有 * 权限码）跳过负责人过滤，看全部；普通维护员只看自己负责/检查的
  const ownerFilter: any = (!hasWildcard && uid > 0)
    ? { [Op.or]: [{ responsible_user_id: uid }, { inspector_user_id: uid }] }
    : {}

  const unfinished = { status: { [Op.in]: [0, 1] } }

  const [
    pendingOrders, pendingMaintenanceDevices,
    pendingFaults, pendingCalibration, pendingIncoming, pendingEnv,
  ] = await Promise.all([
    Order.count({ where: { status: 2 } }),
    hasMaintView ? DeviceMaintenanceRecord.count({
      where: {
        ...unfinished,
        ...ownerFilter,
        trigger_mode: { [Op.in]: ['daily', 'weekly', 'monthly'] },
        period_key: { [Op.in]: [today, weekKey, monthKey] },
      },
      distinct: true,
      col: 'device_id',
    }) : Promise.resolve(0),
    DeviceFault.count({ where: { status: { [Op.in]: [0, 1, 2] } } }),
    DeviceCalibrationPlan.count({ where: { status: 0 } }),
    IncomingInspection.count({ where: { status: 0 } }),
    QualityEnvInspection.count({ where: { status: 0 } }),
  ])

  const result: DashboardTodos = {
    pendingOrders,
    pendingMaintenanceDevices,
    pendingFaults,
    pendingCalibration,
    pendingIncoming,
    pendingEnv,
  }

  // 写入缓存（简单 TTL 策略，不过期的 entry 下次访问自动清）
  try { _todosCache.set(key, { at: Date.now(), value: result }) } catch { /* ignore */ }

  return result
}
