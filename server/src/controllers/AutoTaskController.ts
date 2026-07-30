import { Op } from 'sequelize'
import {
  TaskSetting, SyncTask, ScheduledTask, U9Item, U9Customer,
  EnvMonitor, EnvAlarm, WeatherInfo,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { encryptParamsObj, decryptParamsObj } from '../utils/crypto.js'
import { fetchU9Orgs, DEFAULT_U9_CONFIG } from '../services/u9Service.js'
import { calcNextRunAt } from '../services/taskScheduler.js'
import { executeRealTask } from '../services/taskExecutor.js'

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
        if (v !== undefined && v !== '') {
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
  const now = new Date()
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
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const datePart = `${y}${m}${d}`
  const prefix = type === 'items' ? 'SCHI' : type === 'customers' ? 'SCHC' : type === 'env_monitor' ? 'SCHE' : 'SCHW'
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
      steps: [{ time: new Date().toISOString(), message: '手动触发，任务已创建', percent: 0 }],
      started_at: new Date(),
    })

    ;(task as any).last_run_at = new Date()
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
}

async function updateTaskProgress(taskId: number, step: { message: string; percent: number }, status: string = 'running', totalRecords?: number) {
  try {
    const task = await SyncTask.findByPk(taskId)
    if (!task) return
    const steps = (task as any).steps || []
    steps.push({ time: new Date().toISOString(), message: step.message, percent: step.percent })
    ;(task as any).progress = step.percent
    ;(task as any).current_step = step.message
    ;(task as any).steps = steps
    ;(task as any).status = status
    if (totalRecords !== undefined) {
      ;(task as any).total_records = totalRecords
    }
    if (status === 'completed' || status === 'failed') {
      ;(task as any).ended_at = new Date()
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
    case 'env_monitor': return Math.floor(8 + Math.random() * 5)
    case 'weather': return Math.floor(3 + Math.random() * 6)
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
      steps: [{ time: new Date().toISOString(), message: '任务已启动，准备采集...', percent: 5 }],
      started_at: new Date(),
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
  env_monitor: EnvMonitor,
  env_alarm: EnvAlarm,
  weather: WeatherInfo,
}

const ARCHIVE_SEARCH_FIELDS: Record<string, string[]> = {
  items: ['item_code', 'item_name', 'specification'],
  customers: ['customer_code', 'customer_name', 'short_name'],
  env_monitor: ['factor_id', 'factor_name', 'device_name'],
  env_alarm: ['factor_id', 'factor_name', 'device_name', 'alarm_info'],
  weather: ['city', 'source'],
}

const ARCHIVE_ORDER: Record<string, any> = {
  items: [['item_id', 'DESC']],
  customers: [['customer_id', 'DESC']],
  env_monitor: [['collect_time', 'DESC']],
  env_alarm: [['alarm_time', 'DESC']],
  weather: [['weather_time', 'DESC']],
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

    const totalAlarms = await EnvAlarm.count()
    const unhandledAlarms = await EnvAlarm.count({ where: { is_handled: 0 } })
    const todayStart = new Date()
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
      lastUpdate: latestBatch[0]?.collect_time || null,
    })
  } catch (err) {
    console.error('获取仪表盘数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 趋势数据（最近12小时整点）
export const dashboardTrend = async (req, res) => {
  try {
    const now = new Date()
    const currentHour = new Date(now)
    currentHour.setMinutes(0, 0, 0)
    const startTime = new Date(currentHour)
    startTime.setHours(startTime.getHours() - 11)

    const rows = await EnvMonitor.findAll({
      where: { collect_time: { [Op.gte]: startTime, [Op.lte]: now } },
      order: [['collect_time', 'ASC']],
      raw: true,
    })

    const hourMarks: Date[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentHour)
      d.setHours(d.getHours() - i)
      hourMarks.push(d)
    }
    const times = hourMarks.map((d) => d.toISOString())

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

    function closestValue(recs: any[], target: Date): number | null {
      if (recs.length === 0) return null
      let best = recs[0]
      let bestDiff = Math.abs(best.time.getTime() - target.getTime())
      for (const r of recs as any) {
        const diff = Math.abs(r.time.getTime() - target.getTime())
        if (diff < bestDiff) { best = r; bestDiff = diff }
      }
      return best.value
    }

    const areas = ['workshop', 'warehouse'] as const
    const areaHourly: Record<string, { temp: (number | null)[]; hum: (number | null)[] }> = {}
    for (const area of areas) {
      const tempRecs = (grouped.get(`${area}|temperature`) as any) || []
      const humRecs = (grouped.get(`${area}|humidity`) as any) || []
      const temp: (number | null)[] = []
      const hum: (number | null)[] = []
      for (const mark of hourMarks) {
        const tv = closestValue(tempRecs, mark)
        const hv = closestValue(humRecs, mark)
        temp.push(tv !== null ? Number(Number(tv).toFixed(2)) : null)
        hum.push(hv !== null ? Number(Number(hv).toFixed(2)) : null)
      }
      areaHourly[area] = { temp, hum }
    }

    const seriesDefs = [
      { area: 'workshop', factor: 'temperature', label: '车间温度', color: '#ff4d4f' },
      { area: 'workshop', factor: 'humidity', label: '车间湿度', color: '#1890ff' },
      { area: 'warehouse', factor: 'temperature', label: '仓库温度', color: '#fa8c16' },
      { area: 'warehouse', factor: 'humidity', label: '仓库湿度', color: '#13c2c2' },
    ]

    const series: { name: string; color: string; data: (number | null)[] }[] = []
    for (const s of seriesDefs) {
      const data: (number | null)[] = []
      const hourly = areaHourly[s.area] as any
      for (let i = 0; i < 12; i++) {
        if (s.factor === 'temperature') data.push(hourly.temp[i])
        else if (s.factor === 'humidity') data.push(hourly.hum[i])
      }
      series.push({ name: s.label, color: s.color, data })
    }

    return success(res, { hours: 12, times, series })
  } catch (err) {
    console.error('获取趋势数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}
