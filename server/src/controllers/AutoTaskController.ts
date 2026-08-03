import { Op, fn, col, where as seqWhere } from 'sequelize'
import {
  TaskSetting, SyncTask, ScheduledTask, U9Item, U9Customer, U9ProductionOrder,
  EnvMonitor, EnvAlarm, WeatherInfo, EnergyMeterData,
  Order, ReportOrder, ReportProcess, ProcessDefect,
  ProductionLine, Device, Material, Process, Customer,
  ProductInspection, IncomingInspection, MicrobeInspection,
  InspectionStandard,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { encryptParamsObj, decryptParamsObj } from '../utils/crypto.js'
import { fetchU9Orgs, DEFAULT_U9_CONFIG } from '../services/u9Service.js'
import { calcNextRunAt } from '../services/taskScheduler.js'
import { executeRealTask } from '../services/taskExecutor.js'
import { formatDateTime, formatDate, nowBeijingStr, nowBeijingDateStr, nowBeijingDate } from '../utils/date.js'

// 露点温度计算（考虑大气压的增强版 Magnus 公式）
// T:摄氏温度, RH:相对湿度%, P:大气压(hPa，默认1013.25)
function calcDewPoint(T: number, RH: number, P: number = 1013.25): number | null {
  if (T == null || RH == null || Number.isNaN(T) || Number.isNaN(RH)) return null
  // 饱和水汽压（Magnus公式）
  const es = 6.112 * Math.exp((17.67 * T) / (T + 243.5))
  // 增强因子（考虑大气压对饱和水汽压的修正）
  const fw = 1.0016 + 3.15e-6 * P - 0.074 / P
  // 修正后的饱和水汽压
  const ew = fw * es
  // 实际水汽压
  const e = ew * RH / 100
  if (e <= 0 || e >= ew) {
    // RH异常时退化为标准Magnus
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

// ============ 任务设置 ============
export const listTaskSettings = async (req, res) => {
  try {
    const rows = await TaskSetting.findAll({ order: [['setting_id', 'ASC']] })
    return success(res, rows, '查询成功', rows.length)
  } catch (err) {
    console.error('查询任务设置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const updateTaskSetting = async (req, res) => {
  try {
    const { taskType } = req.params
    const setting = await TaskSetting.findOne({ where: { task_type: taskType } })
    if (!setting) return fail(res, '任务设置不存在', ErrorCode.RECORD_NOT_FOUND)
    const { name, description, source_url, field_count, is_active, params } = req.body
    if (name !== undefined) setting.name = name
    if (description !== undefined) setting.description = description
    if (source_url !== undefined) setting.source_url = source_url
    if (field_count !== undefined) setting.field_count = field_count
    if (is_active !== undefined) setting.is_active = is_active
    if (params !== undefined) {
      const existingParams = setting.params || {}
      const newParams: Record<string, any> = { ...existingParams }
      for (const [k, v] of Object.entries(params as Record<string, any>)) {
        if (v === undefined || v === '') {
          delete newParams[k]
        } else {
          newParams[k] = v
        }
      }
      setting.params = encryptParamsObj(newParams)
    }
    await setting.save()
    return success(res, setting, '修改成功')
  } catch (err) {
    console.error('更新任务设置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const getU9Orgs = async (req, res) => {
  try {
    const { username } = req.query
    if (!username) return fail(res, '请输入用户名', ErrorCode.PARAM_INVALID)
    const cfg = { ...DEFAULT_U9_CONFIG, username: username as string }
    const orgs = await fetchU9Orgs(cfg)
    return success(res, orgs, '获取成功', orgs.length)
  } catch (err: any) {
    console.error('获取U9组织列表失败:', err)
    return fail(res, err.message || '获取组织列表失败', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 同步任务 ============
export const listSyncTasks = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, MAX_PAGE_SIZE)
    const taskType = req.query.taskType as string
    const where: any = {}
    if (taskType) where.task_type = taskType
    const rows = await SyncTask.findAll({
      where,
      order: [['task_id', 'DESC']],
      limit,
    })
    return success(res, rows, '查询成功', rows.length)
  } catch (err) {
    console.error('查询同步任务失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const getSyncTask = async (req, res) => {
  try {
    const { id } = req.params
    const task = await SyncTask.findOne({ where: { task_biz_id: id } })
      || await SyncTask.findByPk(id)
    if (!task) return fail(res, '任务不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, task)
  } catch (err) {
    console.error('查询任务详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const deleteSyncTask = async (req, res) => {
  try {
    const { id } = req.params
    const task = await SyncTask.findOne({ where: { task_biz_id: id } })
      || await SyncTask.findByPk(id)
    if (!task) return fail(res, '任务不存在', ErrorCode.RECORD_NOT_FOUND)
    if ((task as any).status !== 'failed') {
      return fail(res, '仅失败状态的任务可删除', ErrorCode.BUSINESS_ERROR)
    }
    await task.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除同步任务失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 定时任务 ============
function generateScheduleId(): string {
  const now = nowBeijingDate()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 900) + 100)
  return `PLAN-${y}${m}${d}-${h}${min}${s}-${rand}`
}

export const listScheduledTasks = async (req, res) => {
  try {
    const rows = await ScheduledTask.findAll({ order: [['schedule_id', 'DESC']] })
    return success(res, rows, '查询成功', rows.length)
  } catch (err) {
    console.error('查询定时任务失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const createScheduledTask = async (req, res) => {
  try {
    const { name, task_type, exec_mode, config, is_enabled } = req.body
    if (!name || !task_type) return fail(res, '名称和任务类型不能为空')
    const existing = await ScheduledTask.findOne({ where: { task_type, is_enabled: 1 } })
    if (existing) return fail(res, `该任务类型「${task_type}」已存在启用的定时任务，不能重复添加`, ErrorCode.PARAM_INVALID)
    const mode = exec_mode || 'periodic'
    const cfg = config || {}
    const nextAt = calcNextRunAt(mode, cfg)
    const task = await ScheduledTask.create({
      schedule_biz_id: generateScheduleId(),
      name,
      task_type,
      exec_mode: mode,
      config: cfg,
      next_run_at: nextAt,
      is_enabled: is_enabled !== false,
    })
    return success(res, task, '创建成功')
  } catch (err) {
    console.error('创建定时任务失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const updateScheduledTask = async (req, res) => {
  try {
    const { id } = req.params
    const task = await ScheduledTask.findByPk(id)
      || await ScheduledTask.findOne({ where: { schedule_biz_id: id } })
    if (!task) return fail(res, '定时任务不存在', ErrorCode.RECORD_NOT_FOUND)
    const { name, exec_mode, config, is_enabled } = req.body
    if (name !== undefined) (task as any).name = name
    if (exec_mode !== undefined) (task as any).exec_mode = exec_mode
    if (config !== undefined) (task as any).config = config
    if (is_enabled !== undefined) (task as any).is_enabled = is_enabled
    const nextAt = calcNextRunAt((task as any).exec_mode, (task as any).config)
    if (nextAt) (task as any).next_run_at = nextAt
    await task.save()
    return success(res, task, '修改成功')
  } catch (err) {
    console.error('更新定时任务失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const deleteScheduledTask = async (req, res) => {
  try {
    const { id } = req.params
    const task = await ScheduledTask.findByPk(id)
      || await ScheduledTask.findOne({ where: { schedule_biz_id: id } })
    if (!task) return fail(res, '定时任务不存在', ErrorCode.RECORD_NOT_FOUND)
    await task.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除定时任务失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

function generateTaskBizId(type: string): string {
  const now = nowBeijingDate()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const datePart = `${y}${m}${d}`
  const prefix = type === 'items' ? 'SCHI' : type === 'customers' ? 'SCHC' : type === 'env_monitor' ? 'SCHE' : type === 'weather' ? 'SCHW' : type === 'energy_meter' ? 'SCHEM' : type === 'production_orders' ? 'SCHP' : 'SCHX'
  const rand = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}${datePart}${rand}`
}

export const triggerScheduledTask = async (req, res) => {
  try {
    const { id } = req.params
    const task = await ScheduledTask.findByPk(id)
      || await ScheduledTask.findOne({ where: { schedule_biz_id: id } })
    if (!task) return fail(res, '定时任务不存在', ErrorCode.RECORD_NOT_FOUND)

    const type = (task as any).task_type as string

    const activeSame = await SyncTask.findOne({
      where: {
        task_type: type,
        status: { [Op.in]: ['pending', 'running'] },
      },
      order: [['task_id', 'DESC']],
    })
    if (activeSame) {
      return fail(res, `存在相同类型的进行中任务（${(activeSame as any).task_biz_id}），请稍后再试`, ErrorCode.BUSINESS_ERROR)
    }

    const taskBizId = generateTaskBizId(type)
    const syncTask = await SyncTask.create({
      task_biz_id: taskBizId,
      task_type: type,
      status: 'pending',
      progress: 0,
      current_step: '任务已创建，等待执行...',
      steps: [{ time: nowBeijingStr(), message: '手动触发，任务已创建', percent: 0 }],
      started_at: nowBeijingDate(),
    })

    ;(task as any).last_run_at = nowBeijingDate()
    ;(task as any).last_run_result = '手动触发成功'
    await task.save()

    return success(res, { task_biz_id: taskBizId, sync_task: syncTask }, '已手动触发')
  } catch (err) {
    console.error('触发定时任务失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

const TEST_STEPS_MAP: Record<string, { message: string; percent: number }[]> = {
  items: [
    { message: '验证U9连接参数', percent: 10 },
    { message: '连接U9 ERP系统', percent: 20 },
    { message: '获取组织列表', percent: 35 },
    { message: '读取料品数据', percent: 55 },
    { message: '数据转换处理', percent: 75 },
    { message: '写入数据库', percent: 90 },
    { message: '测试完成', percent: 100 },
  ],
  customers: [
    { message: '验证U9连接参数', percent: 10 },
    { message: '连接U9 ERP系统', percent: 20 },
    { message: '获取组织列表', percent: 35 },
    { message: '读取客户数据', percent: 55 },
    { message: '数据转换处理', percent: 75 },
    { message: '写入数据库', percent: 90 },
    { message: '测试完成', percent: 100 },
  ],
  env_monitor: [
    { message: '验证平台连接参数', percent: 10 },
    { message: '连接环境监测平台', percent: 25 },
    { message: '获取监测点列表', percent: 40 },
    { message: '读取监测数据', percent: 60 },
    { message: '数据清洗与转换', percent: 80 },
    { message: '写入数据库', percent: 92 },
    { message: '测试完成', percent: 100 },
  ],
  weather: [
    { message: '获取城市列表', percent: 15 },
    { message: '调用气象数据API', percent: 35 },
    { message: '解析气象数据', percent: 60 },
    { message: '写入数据库', percent: 85 },
    { message: '测试完成', percent: 100 },
  ],
  energy_meter: [
    { message: '连接能源平台', percent: 10 },
    { message: '正在登录', percent: 25 },
    { message: '登录成功', percent: 40 },
    { message: '获取电能数据', percent: 60 },
    { message: '数据获取成功', percent: 85 },
    { message: '数据入库完成', percent: 100 },
  ],
  production_orders: [
    { message: '验证U9连接参数', percent: 10 },
    { message: '连接U9 ERP系统', percent: 20 },
    { message: '获取组织列表', percent: 35 },
    { message: '读取生产订单数据', percent: 55 },
    { message: '数据转换处理', percent: 75 },
    { message: '写入数据库', percent: 90 },
    { message: '测试完成', percent: 100 },
  ],
}

async function updateTaskProgress(taskId: number, step: { message: string; percent: number }, status: string = 'running', totalRecords?: number) {
  try {
    const task = await SyncTask.findByPk(taskId)
    if (!task) return
    const steps = (task as any).steps || []
    steps.push({ time: nowBeijingStr(), message: step.message, percent: step.percent })
    ;(task as any).progress = step.percent
    ;(task as any).current_step = step.message
    ;(task as any).steps = steps
    ;(task as any).status = status
    if (totalRecords !== undefined) {
      ;(task as any).total_records = totalRecords
    }
    if (status === 'completed' || status === 'failed') {
      ;(task as any).ended_at = nowBeijingDate()
    }
    await task.save()
  } catch (err) {
    console.error('更新任务进度失败:', err)
  }
}

function generateMockRecordCount(taskType: string): number {
  switch (taskType) {
    case 'items': return Math.floor(500 + Math.random() * 100)
    case 'customers': return Math.floor(20 + Math.random() * 10)
    case 'production_orders': return Math.floor(30 + Math.random() * 50)
    case 'env_monitor': return Math.floor(8 + Math.random() * 5)
    case 'weather': return Math.floor(3 + Math.random() * 6)
    case 'energy_meter': return Math.floor(50 + Math.random() * 100)
    default: return Math.floor(10 + Math.random() * 20)
  }
}

export const testTaskSetting = async (req, res) => {
  try {
    const { taskType } = req.params
    const setting = await TaskSetting.findOne({ where: { task_type: taskType } })
    if (!setting) return fail(res, '任务设置不存在', ErrorCode.RECORD_NOT_FOUND)

    const activeSame = await SyncTask.findOne({
      where: {
        task_type: taskType,
        status: { [Op.in]: ['pending', 'running'] },
      },
      order: [['task_id', 'DESC']],
    })
    if (activeSame) {
      return fail(res, `存在相同类型的进行中任务（${(activeSame as any).task_biz_id}），请稍后再试`, ErrorCode.BUSINESS_ERROR)
    }

    const taskBizId = generateTaskBizId(taskType)
    const syncTask = await SyncTask.create({
      task_biz_id: taskBizId,
      task_type: taskType,
      status: 'running',
      progress: 5,
      current_step: '任务已启动，准备采集...',
      steps: [{ time: nowBeijingStr(), message: '任务已启动，准备采集...', percent: 5 }],
      started_at: nowBeijingDate(),
    })

    const taskId = (syncTask as any).task_id
    const settingParams = (setting as any).params || {}

    // 异步执行真实采集任务
    ;(async () => {
      await executeRealTask(taskType, taskBizId, taskId, settingParams)
    })()

    return success(res, { task_biz_id: taskBizId, sync_task: syncTask }, '任务已启动，正在采集中...')
  } catch (err) {
    console.error('启动任务失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 档案数据浏览 ============
const ARCHIVE_MODELS: Record<string, any> = {
  items: U9Item,
  customers: U9Customer,
  production_orders: U9ProductionOrder,
  env_monitor: EnvMonitor,
  env_alarm: EnvAlarm,
  weather: WeatherInfo,
  energy_meter: EnergyMeterData,
}

const ARCHIVE_SEARCH_FIELDS: Record<string, string[]> = {
  items: ['item_code', 'item_name', 'specification'],
  customers: ['customer_code', 'customer_name', 'short_name'],
  production_orders: ['doc_no', 'item_code', 'item_name', 'doc_status'],
  env_monitor: ['factor_id', 'factor_name', 'device_name'],
  env_alarm: ['factor_id', 'factor_name', 'device_name', 'alarm_info'],
  weather: ['city', 'source'],
  energy_meter: ['device_addr', 'device_name'],
}

const ARCHIVE_ORDER: Record<string, any> = {
  items: [['item_id', 'DESC']],
  customers: [['customer_id', 'DESC']],
  production_orders: [['order_id', 'DESC']],
  env_monitor: [['collect_time', 'DESC']],
  env_alarm: [['alarm_time', 'DESC']],
  weather: [['weather_time', 'DESC']],
  energy_meter: [['reading_date', 'DESC']],
}

export const listArchiveData = async (req, res) => {
  try {
    const { type } = req.params
    const Model = ARCHIVE_MODELS[type]
    if (!Model) return fail(res, '未知档案类型', ErrorCode.PARAM_INVALID)

    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20))
    const keyword = (req.query.keyword as string) || ''

    const where: any = {}
    const searchFields = ARCHIVE_SEARCH_FIELDS[type]
    if (keyword && searchFields) {
      where[Op.or] = searchFields.map(f => ({ [f]: { [Op.like]: `%${keyword}%` } }))
    }

    if (type === 'env_alarm') {
      if (req.query.is_handled !== undefined) where.is_handled = req.query.is_handled === 'true'
      if (req.query.alarm_level !== undefined) where.alarm_level = Number(req.query.alarm_level)
    }

    const { count, rows } = await Model.findAndCountAll({
      where,
      order: ARCHIVE_ORDER[type],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })

    return success(res, {
      list: rows,
      pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
    })
  } catch (err) {
    console.error('查询档案数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const handleAlarm = async (req, res) => {
  try {
    const { id } = req.params
    const alarm = await EnvAlarm.findByPk(id)
    if (!alarm) return fail(res, '报警记录不存在', ErrorCode.RECORD_NOT_FOUND)
    alarm.is_handled = 1
    alarm.handle_msg = req.body.handle_msg || ''
    await alarm.save()
    return success(res, alarm, '已处理')
  } catch (err) {
    console.error('处理报警失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 环境监测仪表盘 ============
export const dashboardOverview = async (req, res) => {
  try {
    const latestBatch = await EnvMonitor.findAll({
      order: [['collect_time', 'DESC']],
      limit: 200,
      raw: true,
    })

    const factorLatest = new Map<string, any>()
    for (const r of latestBatch as any[]) {
      if (!factorLatest.has(r.factor_name)) factorLatest.set(r.factor_name, r)
    }

    // 获取最新大气压（task_weather_info 表）
    let pressure = 1013.25
    try {
      const latestWeather = await WeatherInfo.findOne({
        order: [['weather_time', 'DESC']],
        raw: true,
      }) as any
      if (latestWeather && latestWeather.pressure) pressure = Number(latestWeather.pressure)
    } catch (e) {
      console.warn('[dashboardOverview] 读取大气压失败，使用默认值:', (e as any).message)
    }

    // 计算各区域的平均温度、湿度和露点温度（考虑大气压）
    const areaStats: Record<string, { temps: number[]; hums: number[] }> = {}
    for (const f of factorLatest.values()) {
      const name: string = f.factor_name || ''
      if (!name.includes('温度') && !name.includes('湿度')) continue
      const area = name.includes('车间') ? 'workshop' : name.includes('仓库') ? 'warehouse' : null
      if (!area) continue
      if (!areaStats[area]) areaStats[area] = { temps: [], hums: [] }
      if (name.includes('温度') && typeof f.value === 'number') areaStats[area].temps.push(f.value)
      if (name.includes('湿度') && typeof f.value === 'number') areaStats[area].hums.push(f.value)
    }
    const dewPoints: Record<string, number | null> = {}
    for (const [area, s] of Object.entries(areaStats)) {
      const avgT = s.temps.length ? s.temps.reduce((a, b) => a + b, 0) / s.temps.length : NaN
      const avgH = s.hums.length ? s.hums.reduce((a, b) => a + b, 0) / s.hums.length : NaN
      dewPoints[area] = calcDewPoint(avgT, avgH, pressure)
    }

    const totalAlarms = await EnvAlarm.count()
    const unhandledAlarms = await EnvAlarm.count({ where: { is_handled: 0 } })
    const todayStart = nowBeijingDate()
    todayStart.setHours(0, 0, 0, 0)
    const todayAlarms = await EnvAlarm.count({ where: { alarm_time: { [Op.gte]: todayStart } } })

    const recentAlarms = await EnvAlarm.findAll({
      order: [['alarm_time', 'DESC']],
      limit: 15,
      raw: true,
    })

    return success(res, {
      factors: Array.from(factorLatest.values()),
      alarms: { total: totalAlarms, unhandled: unhandledAlarms, today: todayAlarms, recent: recentAlarms },
      dew_points: dewPoints,
      lastUpdate: latestBatch[0]?.collect_time || null,
    })
  } catch (err) {
    console.error('获取仪表盘数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 趋势数据（最近12小时，10分钟间隔）
export const dashboardTrend = async (req, res) => {
  try {
    const now = nowBeijingDate()
    const currentSlot = new Date(now)
    currentSlot.setSeconds(0, 0)
    currentSlot.setMinutes(Math.floor(currentSlot.getMinutes() / 10) * 10)
    const startTime = new Date(currentSlot)
    startTime.setMinutes(startTime.getMinutes() - 11 * 60 - 50)

    const rows = await EnvMonitor.findAll({
      where: { collect_time: { [Op.gte]: startTime, [Op.lte]: now } },
      order: [['collect_time', 'ASC']],
      raw: true,
    })

    const slotMarks: Date[] = []
    for (let i = 71; i >= 0; i--) {
      const d = new Date(currentSlot)
      d.setMinutes(d.getMinutes() - i * 10)
      slotMarks.push(d)
    }
    const times = slotMarks.map((d) => formatDateTime(d))

    const getArea = (factorName: string): 'workshop' | 'warehouse' | 'other' => {
      if (factorName.includes('车间')) return 'workshop'
      if (factorName.includes('仓库')) return 'warehouse'
      return 'other'
    }

    type Rec = { time: Date; value: number }
    const grouped = new Map<string, Rec[]>()
    for (const r of rows as any[]) {
      if (!r.factor_name) continue
      const area = getArea(r.factor_name as string)
      const factorType = (r as any).factor_name.includes('温度') ? 'temperature'
        : (r as any).factor_name.includes('湿度') ? 'humidity' : null
      if (!factorType) continue
      const key = `${area}|${factorType}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push({ time: new Date((r as any).collect_time), value: (r as any).value })
    }

    function bucketAvg(recs: Rec[], target: Date, windowMs: number = 10 * 60 * 1000): number | null {
      if (recs.length === 0) return null
      const targetTs = target.getTime()
      let sum = 0
      let count = 0
      let fallback: Rec | null = null
      let fallbackDiff = Infinity
      for (const r of recs) {
        const diff = Math.abs(r.time.getTime() - targetTs)
        if (diff <= windowMs / 2) {
          sum += r.value
          count++
        }
        if (diff < fallbackDiff) {
          fallback = r
          fallbackDiff = diff
        }
      }
      if (count > 0) return Number((sum / count).toFixed(2))
      if (fallback && fallbackDiff <= windowMs) return Number(Number(fallback.value).toFixed(2))
      return null
    }

    const areas = ['workshop', 'warehouse'] as const
    const areaSlots: Record<string, { temp: (number | null)[]; hum: (number | null)[]; dew: (number | null)[] }> = {}
    for (const area of areas) {
      const tempRecs = grouped.get(`${area}|temperature`) || []
      const humRecs = grouped.get(`${area}|humidity`) || []
      const temp: (number | null)[] = []
      const hum: (number | null)[] = []
      const dew: (number | null)[] = []
      for (const mark of slotMarks) {
        const tv = bucketAvg(tempRecs, mark)
        const hv = bucketAvg(humRecs, mark)
        temp.push(tv)
        hum.push(hv)
        dew.push(tv !== null && hv !== null ? calcDewPoint(tv, hv) : null)
      }
      areaSlots[area] = { temp, hum, dew }
    }

    const seriesDefs = [
      { area: 'workshop', factor: 'temperature', label: '车间温度', color: '#ff4d4f' },
      { area: 'workshop', factor: 'humidity', label: '车间湿度', color: '#1890ff' },
      { area: 'workshop', factor: 'dew', label: '车间露点', color: '#a855f7' },
      { area: 'warehouse', factor: 'temperature', label: '仓库温度', color: '#fa8c16' },
      { area: 'warehouse', factor: 'humidity', label: '仓库湿度', color: '#13c2c2' },
      { area: 'warehouse', factor: 'dew', label: '仓库露点', color: '#f59e0b' },
    ]

    const series: { name: string; color: string; data: (number | null)[] }[] = []
    for (const s of seriesDefs) {
      const data: (number | null)[] = []
      const slots = areaSlots[s.area] as any
      for (let i = 0; i < 72; i++) {
        if (s.factor === 'temperature') data.push(slots.temp[i])
        else if (s.factor === 'humidity') data.push(slots.hum[i])
        else if (s.factor === 'dew') data.push(slots.dew[i])
      }
      series.push({ name: s.label, color: s.color, data })
    }

    return success(res, { hours: 12, intervalMinutes: 10, times, series })
  } catch (err) {
    console.error('获取趋势数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 生产实时看板数据 ============
export const productionDashboard = async (req, res) => {
  try {
    const todayStart = nowBeijingDate()
    todayStart.setHours(0, 0, 0, 0)
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000)
    const now = nowBeijingDate()

    // 1. 基础数据：产线、工序、设备
    const productionLines = await ProductionLine.findAll({ order: [['sort_order', 'ASC']], raw: true })
    const devices = await Device.findAll({ raw: true })
    const processes = await Process.findAll({ order: [['sort_order', 'ASC']], raw: true })
    const materials = await Material.findAll({ limit: 50, raw: true })

    // 2. 订单和报工单（工单元数据）
    const orders = await Order.findAll({
      where: {
        [Op.or]: [
          { created_at: { [Op.gte]: todayStart } },
          { release_time: { [Op.gte]: todayStart } },
          { status: { [Op.in]: [0, 1, 2] } },
        ],
      },
      order: [['created_at', 'DESC']],
      limit: 200,
      raw: true,
    })

    const workOrders = await ReportOrder.findAll({
      where: {
        [Op.or]: [
          { report_time: { [Op.gte]: todayStart } },
          { status: { [Op.in]: [0] } },
        ],
      },
      order: [['report_time', 'DESC']],
      limit: 500,
      raw: true,
    })

    // 3. 工序报工数据（今日）
    const processReports = await ReportProcess.findAll({
      where: { created_at: { [Op.gte]: todayStart } },
      order: [['created_at', 'DESC']],
      limit: 2000,
      raw: true,
    })

    const reportOrderIds = processReports.map(p => p.report_order_id).filter(Boolean)
    const processReportOrders = reportOrderIds.length > 0
      ? await ReportOrder.findAll({
          where: { report_order_id: { [Op.in]: reportOrderIds } },
          raw: true,
        })
      : []

    const roMap = new Map()
    processReportOrders.forEach(ro => roMap.set(ro.report_order_id, ro))
    const processReportsWithQty = processReports.map(pr => {
      const ro = roMap.get(pr.report_order_id)
      return {
        ...pr,
        report_time: ro?.report_time || pr.created_at,
        work_order_id: pr.report_order_id,
        work_order_no: ro?.report_no,
        process_name: pr.process_name,
        input_qty: Number(ro?.report_qty || 0),
        output_qty: Number(ro?.report_qty || 0),
        defect_material: 0,
        defect_process: 0,
        defect_scrap: 0,
      }
    })

    // 4. 不良数据（今日）
    const defects = await ProcessDefect.findAll({
      where: { record_time: { [Op.gte]: todayStart } },
      raw: true,
    })
    defects.forEach(df => {
      const pr = processReportsWithQty.find(p => p.report_order_id === df.report_order_id && p.process_id === df.process_id)
      const qty = Number(df.quantity || 0)
      if (pr) {
        pr.defect_process += qty
      } else if (processReportsWithQty.length > 0) {
        processReportsWithQty[0].defect_material += qty
      }
    })

    // 5. 最近30天：日产线产出数据（趋势图）— 直接从报工单统计
    const reportOrders30d = await ReportOrder.findAll({
      where: { report_time: { [Op.gte]: thirtyDaysAgo } },
      order: [['report_time', 'ASC']],
      limit: 10000,
      raw: true,
    })
    const dailyOutputMap: Record<string, Record<string, number>> = {}
    reportOrders30d.forEach(ro => {
      const t = ro.report_time || ro.created_at
      if (!t) return
      const d = t instanceof Date ? t : new Date(t)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const lineName = ro.line_name || (productionLines[0]?.line_name) || '默认产线'
      if (!dailyOutputMap[dateStr]) dailyOutputMap[dateStr] = {}
      dailyOutputMap[dateStr][lineName] = (dailyOutputMap[dateStr][lineName] || 0) + Number(ro.report_qty || 0)
    })

    const dateList: string[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
      dateList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
    const lineNames = productionLines.map(l => l.line_name).filter(Boolean)
    if (lineNames.length === 0) lineNames.push('默认产线')
    const dailyTrend: any[] = []
    dateList.forEach(dateStr => {
      const item: any = { date: dateStr }
      lineNames.forEach(ln => {
        item[ln] = dailyOutputMap[dateStr]?.[ln] || 0
      })
      dailyTrend.push(item)
    })

    // 6. 最近30天：日能源数据
    const energyData30d = await EnergyMeterData.findAll({
      where: { reading_date: { [Op.gte]: thirtyDaysAgo } },
      order: [['reading_date', 'ASC']],
      raw: true,
    })
    const dailyEnergyMap: Record<string, number> = {}
    energyData30d.forEach(e => {
      const t = e.reading_date
      if (!t) return
      const dateStr = formatDate(t)
      const v = Number(e.forward_active_energy || 0)
      dailyEnergyMap[dateStr] = (dailyEnergyMap[dateStr] || 0) + v
    })
    const dailyEnergy = dateList.map(d => ({ date: d, energy_kwh: Number((dailyEnergyMap[d] || 0).toFixed(2)) }))

    // 7. 最近30天：各工序不良统计（只显示有不良的工序）
    const defects30d = await ProcessDefect.findAll({
      where: { record_time: { [Op.gte]: thirtyDaysAgo } },
      raw: true,
    })
    const processDefectMap: Record<string, { name: string; material: number; process: number; scrap: number; total: number }> = {}
    const processIdToName: Record<string, string> = {}
    processes.forEach(p => { processIdToName[p.process_id] = p.process_name || p.name })
    defects30d.forEach(df => {
      const pname = df.process_name || processIdToName[df.process_id] || '未知工序'
      if (!processDefectMap[pname]) {
        processDefectMap[pname] = { name: pname, material: 0, process: 0, scrap: 0, total: 0 }
      }
      const qty = Number(df.quantity || 0)
      const dtype = String(df.defect_type || df.type || '')
      if (dtype.includes('来料') || dtype.includes('material')) processDefectMap[pname].material += qty
      else if (dtype.includes('报废') || dtype.includes('scrap')) processDefectMap[pname].scrap += qty
      else processDefectMap[pname].process += qty
      processDefectMap[pname].total += qty
    })
    const processDefectList = Object.values(processDefectMap)
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total)

    return success(res, {
      productionLines,
      devices,
      processes,
      materials,
      orders,
      workOrders,
      processReports: processReportsWithQty,
      dailyTrend,
      dailyEnergy,
      processDefectList,
      queryTime: nowBeijingStr(),
      activeDate: formatDate(todayStart),
    })
  } catch (err) {
    console.error('[productionDashboard] 生产看板数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 质量检测中心看板数据 ============
export const qualityDashboard = async (req, res) => {
  try {
    const todayStart = nowBeijingDate()
    todayStart.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 1. 四类检验数据
    const [incomingInspections, productInspections, microbeInspections] = await Promise.all([
      IncomingInspection.findAll({
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        order: [['created_at', 'DESC']],
        limit: 500,
        raw: true,
      }),
      ProductInspection.findAll({
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        order: [['created_at', 'DESC']],
        limit: 500,
        raw: true,
      }),
      MicrobeInspection.findAll({
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        order: [['created_at', 'DESC']],
        limit: 500,
        raw: true,
      }),
    ])

    // 成品/环境检验分开
    const finishedInspections = productInspections.filter(i => i.inspection_type === '成品' || i.inspection_type === '制程')
    const envMicrobe = microbeInspections.filter(i => i.object_type === '来料检验' || true)

    // 拆分微生物和环境检验（基于object_type粗略区分）
    const envInspections = microbeInspections.filter(i => i.object_type === '来料检验' ? false : true)

    // 2. 客诉（暂无对应表，返回空数组）
    const complaints: any[] = []

    // 3. 仪器校准（使用Device近似模拟，设备下次校准日期）
    const instrumentsAll = await Device.findAll({ raw: true })
    const instruments = instrumentsAll.map(d => ({
      instrument_id: d.device_id,
      instrument_name: d.device_name,
      instrument_code: d.device_code,
      next_calibration_date: d.next_inspection_date,
      last_calibration_date: d.last_inspection_date,
      status:
        d.status === '运行' ? '正常' :
        d.next_inspection_date && new Date(d.next_inspection_date) < todayStart ? '已超期' :
        d.next_inspection_date && new Date(d.next_inspection_date).getTime() - todayStart.getTime() < 30 * 86400000 ? '即将到期' : '正常',
    }))

    // 4. 检验标准和料品
    const inspectionStandards = await InspectionStandard.findAll({ where: { status: 1 }, raw: true })
    const materials = await Material.findAll({ limit: 200, raw: true })

    return success(res, {
      incomingInspections,
      finishedInspections,
      microbeInspections,
      envInspections,
      complaints,
      instruments,
      inspectionStandards,
      materials,
    })
  } catch (err) {
    console.error('[qualityDashboard] 质量看板数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 经营管理中心看板数据 ============
export const managementDashboard = async (req, res) => {
  try {
    const todayStart = nowBeijingDate()
    todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)
    const sixMonthsAgo = new Date(todayStart)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)

    // 1. 基础数据
    const [
      orders, workOrders, processReports, productionLines, devices,
      incomingInspections, finishedInspections, microbeInspections, envInspections,
      materials, customers, inspectionStandards,
    ] = await Promise.all([
      Order.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, order: [['created_at', 'DESC']], limit: 1000, raw: true }),
      ReportOrder.findAll({ where: { report_time: { [Op.gte]: sixMonthsAgo } }, order: [['report_time', 'DESC']], limit: 3000, raw: true }),
      ReportProcess.findAll({ where: { created_at: { [Op.gte]: monthStart } }, limit: 3000, raw: true }),
      ProductionLine.findAll({ order: [['sort_order', 'ASC']], raw: true }),
      Device.findAll({ raw: true }),
      IncomingInspection.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, limit: 1000, raw: true }),
      ProductInspection.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, limit: 1000, raw: true }),
      MicrobeInspection.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, limit: 1000, raw: true }),
      MicrobeInspection.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, limit: 500, raw: true }),
      Material.findAll({ limit: 200, raw: true }),
      Customer.findAll({ limit: 100, raw: true }),
      InspectionStandard.findAll({ raw: true }),
    ])

    // 工序报工合并数据
    const reportOrderIds = processReports.map(p => p.report_order_id).filter(Boolean)
    const roMap = new Map()
    if (reportOrderIds.length > 0) {
      const ros = await ReportOrder.findAll({ where: { report_order_id: { [Op.in]: reportOrderIds } }, raw: true })
      ros.forEach(ro => roMap.set(ro.report_order_id, ro))
    }
    const processReportsWithQty = processReports.map(pr => {
      const ro = roMap.get(pr.report_order_id)
      return {
        ...pr,
        report_time: ro?.report_time || pr.created_at,
        work_order_id: pr.report_order_id,
        work_order_no: ro?.report_no,
        process_name: pr.process_name,
        input_qty: Number(ro?.report_qty || 0),
        output_qty: Number(ro?.report_qty || 0),
        defect_material: 0,
        defect_process: 0,
        defect_scrap: 0,
      }
    })

    // 不良数据
    const defects = await ProcessDefect.findAll({ where: { record_time: { [Op.gte]: monthStart } }, raw: true })
    defects.forEach(df => {
      const pr = processReportsWithQty.find(p => p.report_order_id === df.report_order_id && p.process_id === df.process_id)
      const qty = Number(df.quantity || 0)
      if (pr) pr.defect_process += qty
      else if (processReportsWithQty.length > 0) processReportsWithQty[0].defect_material += qty
    })

    // 客诉（暂无对应表）
    const complaints: any[] = []

    // 仪器（设备校准状态）
    const instruments = devices.map(d => ({
      instrument_id: d.device_id,
      instrument_name: d.device_name,
      next_calibration_date: d.next_inspection_date,
      status:
        d.next_inspection_date && new Date(d.next_inspection_date) < todayStart ? '已超期' :
        d.next_inspection_date && new Date(d.next_inspection_date).getTime() - todayStart.getTime() < 30 * 86400000 ? '即将到期' : '正常',
    }))

    return success(res, {
      orders,
      workOrders,
      processReports: processReportsWithQty,
      productionLines,
      devices,
      incomingInspections,
      finishedInspections,
      microbeInspections,
      envInspections,
      complaints,
      instruments,
      materials,
      customers,
      inspectionStandards,
    })
  } catch (err) {
    console.error('[managementDashboard] 经营看板数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}


