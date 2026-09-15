/**
 * 自动任务 Service（AutoTaskController 下沉）
 *
 * 业务域：
 *   1. TaskSetting — 任务设置 CRUD（update 时 params 需要 merge + encrypt）
 *   2. SyncTask — 同步任务日志查询（仅失败可删）
 *   3. ScheduledTask — 定时任务 CRUD + trigger（手动触发=创建 SyncTask）
 *   4. testTaskSetting — 启动真实采集（创建 SyncTask + 异步 executeRealTask）
 *   5. listArchiveData — 档案浏览（多 Model 动态切换）
 *   6. handleAlarm — env_alarm 标记已处理
 *
 *   纯函数：calcDewPoint（Magnus 公式）、generateTaskBizId（前缀+时间+随机）
 *
 * 已 import 的底层服务：taskScheduler/calcNextRunAt、taskExecutor/executeRealTask、
 * u9Service/fetchU9Orgs + DEFAULT_U9_CONFIG、u9Exporter
 */
import { Op } from 'sequelize'
import {
  TaskSetting, SyncTask, ScheduledTask, U9Item, U9Customer, U9ProductionOrder, U9PurchaseReceipt,
  EnvMonitor, EnvAlarm, WeatherInfo, EnergyMeterData,
} from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { encryptParamsObj } from '../utils/crypto.js'
import { calcNextRunAt } from './taskScheduler.js'
import { executeRealTask } from './taskExecutor.js'
import { nowBeijingStr, nowBeijingDate } from '../utils/date.js'
import { AppError } from '../utils/error.js'

// -------- 纯工具 --------

/** 露点温度计算（考虑大气压的增强版 Magnus 公式） */
export function calcDewPoint(T: number, RH: number, P: number = 1013.25): number | null {
  if (T == null || RH == null || Number.isNaN(T) || Number.isNaN(RH)) return null
  const es = 6.112 * Math.exp((17.67 * T) / (T + 243.5))
  const fw = 1.0016 + 3.15e-6 * P - 0.074 / P
  const ew = fw * es
  const e = ew * RH / 100
  if (e <= 0 || e >= ew) {
    const es2 = 6.112 * Math.exp((17.67 * T) / (T + 243.5))
    const e2 = es2 * Math.min(100, Math.max(0, RH)) / 100
    if (e2 <= 0) return null
    const lnE2 = Math.log(e2 / 6.112)
    const Td2 = (243.5 * lnE2) / (17.67 - lnE2)
    if (Number.isNaN(Td2) || !isFinite(Td2)) return null
    return Math.round(Td2 * 10) / 10
  }
  const lnE = Math.log(e / 6.112)
  const Td = (243.5 * lnE) / (17.67 - lnE)
  if (Number.isNaN(Td) || !isFinite(Td)) return null
  return Math.round(Td * 10) / 10
}

/** 生成任务业务 ID（前缀+日期+5位时间戳+2位随机） */
export function generateTaskBizId(type: string): string {
  const now = nowBeijingDate()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const prefix: Record<string, string> = {
    items: 'SCHI', customers: 'SCHC', env_monitor: 'SCHE', weather: 'SCHW',
    energy_meter: 'SCHM', production_orders: 'SCHP', purchase_receipts: 'SCHR',
  }
  const p = prefix[type] || 'SCHX'
  return `${p}${datePart}${String(Date.now()).slice(-5)}${String(Math.floor(Math.random() * 90) + 10)}`
}

/** 生成定时任务 schedule_biz_id */
function generateScheduleId(): string {
  const now = nowBeijingDate()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `PLAN-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}-${String(Math.floor(Math.random() * 900) + 100)}`
}

function activePendingRunningSameType(taskType: string, excludeTaskId?: number) {
  return SyncTask.findOne({
    where: { task_type: taskType, status: { [Op.in]: ['pending', 'running'] }, ...(excludeTaskId ? { task_id: { [Op.ne]: excludeTaskId } } : {}) },
    order: [['task_id', 'DESC']],
  })
}

// -------- 档案浏览常量 --------
const ARCHIVE_MODELS: Record<string, any> = {
  items: U9Item, customers: U9Customer, production_orders: U9ProductionOrder, purchase_receipts: U9PurchaseReceipt,
  env_monitor: EnvMonitor, env_alarm: EnvAlarm, weather: WeatherInfo, energy_meter: EnergyMeterData,
}
const ARCHIVE_SEARCH_FIELDS: Record<string, string[]> = {
  items: ['item_code', 'item_name', 'specification'],
  customers: ['customer_code', 'customer_name', 'short_name'],
  production_orders: ['order_no', 'material_code', 'material_name', 'status'],
  purchase_receipts: ['receipt_no', 'material_code', 'material_name', 'supplier_code', 'supplier_name'],
  env_monitor: ['factor_id', 'factor_name', 'device_name'],
  env_alarm: ['factor_id', 'factor_name', 'device_name', 'alarm_info'],
  weather: ['city', 'source'],
  energy_meter: ['device_addr', 'device_name'],
}
const ARCHIVE_ORDER: Record<string, any> = {
  items: [['item_id', 'DESC']],
  customers: [['customer_id', 'DESC']],
  production_orders: [['order_id', 'DESC']],
  purchase_receipts: [['receipt_id', 'DESC']],
  env_monitor: [['collect_time', 'DESC']],
  env_alarm: [['alarm_time', 'DESC']],
  weather: [['weather_time', 'DESC']],
  energy_meter: [['reading_date', 'DESC']],
}

export const AutoTaskService = {
  // ---------- TaskSetting ----------
  async listTaskSettings() {
    return await TaskSetting.findAll({ order: [['setting_id', 'ASC']] })
  },

  async updateTaskSetting(taskType: string, body: any) {
    const setting = await TaskSetting.findOne({ where: { task_type: taskType } })
    if (!setting) throw new AppError('任务设置不存在', 10002, 404)
    const { name, description, source_url, field_count, is_active, params } = body
    if (name !== undefined) (setting as any).name = name
    if (description !== undefined) (setting as any).description = description
    if (source_url !== undefined) (setting as any).source_url = source_url
    if (field_count !== undefined) (setting as any).field_count = field_count
    if (is_active !== undefined) (setting as any).is_active = is_active
    if (params !== undefined) {
      const existingParams = (setting as any).params || {}
      const newParams: Record<string, any> = { ...existingParams }
      for (const [k, v] of Object.entries(params as Record<string, any>)) {
        if (v === undefined || v === '') delete newParams[k]
        else newParams[k] = v
      }
      (setting as any).params = encryptParamsObj(newParams)
    }
    await setting.save()
    return setting
  },

  // ---------- SyncTask ----------
  async listSyncTasks(query: any) {
    const limit = Math.min(Number(query.limit) || 50, MAX_PAGE_SIZE)
    const where: any = {}
    if (query.taskType) where.task_type = query.taskType
    return await SyncTask.findAll({ where, order: [['task_id', 'DESC']], limit })
  },

  async getSyncTask(id: string | number) {
    const task = await SyncTask.findOne({ where: { task_biz_id: id } }) || await SyncTask.findByPk(id)
    if (!task) throw new AppError('任务不存在', 10002, 404)
    return task
  },

  async deleteSyncTask(id: string | number) {
    const task = await SyncTask.findOne({ where: { task_biz_id: id } }) || await SyncTask.findByPk(id)
    if (!task) throw new AppError('任务不存在', 10002, 404)
    if ((task as any).status !== 'failed') throw new AppError('仅失败状态的任务可删除', 30001, 409)
    await task.destroy()
    return true
  },

  // ---------- ScheduledTask ----------
  async listScheduledTasks() {
    return await ScheduledTask.findAll({ order: [['schedule_id', 'DESC']] })
  },

  async createScheduledTask(body: any) {
    const { name, task_type, exec_mode, config, is_enabled } = body
    if (!name || !task_type) throw new AppError('名称和任务类型不能为空', 10001, 400)
    const existing = await ScheduledTask.findOne({ where: { task_type, is_enabled: 1 } })
    if (existing) throw new AppError(`该任务类型「${task_type}」已存在启用的定时任务，不能重复添加`, 10001, 400)
    const mode = exec_mode || 'periodic'
    const cfg = config || {}
    const nextAt = calcNextRunAt(mode, cfg)
    return await ScheduledTask.create({
      schedule_biz_id: generateScheduleId(), name, task_type, exec_mode: mode, config: cfg,
      next_run_at: nextAt, is_enabled: is_enabled !== false,
    } as any)
  },

  async updateScheduledTask(id: string | number, body: any) {
    const task = await ScheduledTask.findByPk(id) || await ScheduledTask.findOne({ where: { schedule_biz_id: id } })
    if (!task) throw new AppError('定时任务不存在', 10002, 404)
    for (const k of ['name', 'exec_mode', 'config', 'is_enabled']) {
      if (body[k] !== undefined) (task as any)[k] = body[k]
    }
    const nextAt = calcNextRunAt((task as any).exec_mode, (task as any).config)
    if (nextAt) (task as any).next_run_at = nextAt
    await task.save()
    return task
  },

  async deleteScheduledTask(id: string | number) {
    const task = await ScheduledTask.findByPk(id) || await ScheduledTask.findOne({ where: { schedule_biz_id: id } })
    if (!task) throw new AppError('定时任务不存在', 10002, 404)
    await task.destroy()
    return true
  },

  /** 手动触发定时任务 → 创建 SyncTask（异步实际执行由 taskExecutor 完成） */
  async triggerScheduledTask(id: string | number) {
    const task = await ScheduledTask.findByPk(id) || await ScheduledTask.findOne({ where: { schedule_biz_id: id } })
    if (!task) throw new AppError('定时任务不存在', 10002, 404)
    const type = (task as any).task_type as string

    const activeSame = await activePendingRunningSameType(type)
    if (activeSame) throw new AppError(`存在相同类型的进行中任务（${(activeSame as any).task_biz_id}），请稍后再试`, 30001, 409)

    const taskBizId = generateTaskBizId(type)
    const syncTask = await SyncTask.create({
      task_biz_id: taskBizId, task_type: type, status: 'pending', progress: 0,
      current_step: '任务已创建，等待执行...',
      steps: [{ time: nowBeijingStr(), message: '手动触发，任务已创建', percent: 0 }],
      started_at: nowBeijingDate(),
    } as any)

    ;(task as any).last_run_at = nowBeijingDate()
    ;(task as any).last_run_result = '手动触发成功'
    await task.save()
    return { task_biz_id: taskBizId, sync_task: syncTask }
  },

  async testTaskSetting(taskType: string) {
    const setting = await TaskSetting.findOne({ where: { task_type: taskType } })
    if (!setting) throw new AppError('任务设置不存在', 10002, 404)

    const activeSame = await activePendingRunningSameType(taskType)
    if (activeSame) throw new AppError(`存在相同类型的进行中任务（${(activeSame as any).task_biz_id}），请稍后再试`, 30001, 409)

    const taskBizId = generateTaskBizId(taskType)
    const syncTask = await SyncTask.create({
      task_biz_id: taskBizId, task_type: taskType, status: 'running', progress: 5,
      current_step: '任务已启动，准备采集...',
      steps: [{ time: nowBeijingStr(), message: '任务已启动，准备采集...', percent: 5 }],
      started_at: nowBeijingDate(),
    } as any)

    const taskId = (syncTask as any).task_id
    const settingParams = (setting as any).params || {}

    // 异步执行真实采集任务
    ;(async () => { await executeRealTask(taskType, taskBizId, taskId, settingParams) })()
    return { task_biz_id: taskBizId, sync_task: syncTask }
  },

  // ---------- Archive Data ----------
  async listArchiveData(type: string, query: any) {
    const Model = ARCHIVE_MODELS[type]
    if (!Model) throw new AppError('未知档案类型', 10001, 400)
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize) || 20))
    const keyword = (query.keyword as string) || ''
    const where: any = {}
    const searchFields = ARCHIVE_SEARCH_FIELDS[type]
    if (keyword && searchFields) where[Op.or] = searchFields.map(f => ({ [f]: { [Op.like]: `%${keyword}%` } }))
    if (type === 'env_alarm') {
      if (query.is_handled !== undefined) where.is_handled = query.is_handled === 'true'
      if (query.alarm_level !== undefined) where.alarm_level = Number(query.alarm_level)
    }
    const { count, rows } = await Model.findAndCountAll({ where, order: ARCHIVE_ORDER[type], limit: pageSize, offset: (page - 1) * pageSize })
    return { list: rows, pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) } }
  },

  async handleAlarm(id: number | string, handleMsg?: string) {
    const alarm = await EnvAlarm.findByPk(Number(id))
    if (!alarm) throw new AppError('报警记录不存在', 10002, 404)
    ;(alarm as any).is_handled = 1
    ;(alarm as any).handle_msg = handleMsg || ''
    await alarm.save()
    return alarm
  },
}

export default AutoTaskService
