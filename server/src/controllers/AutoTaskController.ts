import { Op } from 'sequelize'
import {
  TaskSetting, SyncTask, ScheduledTask, U9Item, U9Customer,
  EnvMonitor, EnvAlarm, WeatherInfo,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

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
    if (params !== undefined) setting.params = params
    await setting.save()
    return success(res, setting, '修改成功')
  } catch (err) {
    console.error('更新任务设置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
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
    const task = await ScheduledTask.create({
      schedule_biz_id: generateScheduleId(),
      name,
      task_type,
      exec_mode: exec_mode || 'periodic',
      config: config || {},
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
    if (name !== undefined) task.name = name
    if (exec_mode !== undefined) task.exec_mode = exec_mode
    if (config !== undefined) task.config = config
    if (is_enabled !== undefined) task.is_enabled = is_enabled
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
