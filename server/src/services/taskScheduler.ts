import { Op } from 'sequelize'
import { ScheduledTask, SyncTask, TaskSetting } from '../models/index.js'
import { executeRealTask } from './taskExecutor.js'

function pad(n: number) { return String(n).padStart(2, '0') }

const TEST_STEPS_MAP: Record<string, { message: string; percent: number }[]> = {
  items: [
    { message: '连接U9系统', percent: 15 },
    { message: '获取料品列表', percent: 35 },
    { message: '解析料品数据', percent: 55 },
    { message: '同步到本地数据库', percent: 80 },
    { message: '同步完成', percent: 100 },
  ],
  customers: [
    { message: '连接U9系统', percent: 15 },
    { message: '获取客户列表', percent: 35 },
    { message: '解析客户数据', percent: 55 },
    { message: '同步到本地数据库', percent: 80 },
    { message: '同步完成', percent: 100 },
  ],
  env_monitor: [
    { message: '连接环境监测设备', percent: 20 },
    { message: '采集温湿度数据', percent: 50 },
    { message: '检测异常阈值', percent: 75 },
    { message: '数据入库完成', percent: 100 },
  ],
  weather: [
    { message: '连接气象数据源', percent: 20 },
    { message: '获取实时气象信息', percent: 50 },
    { message: '解析气象数据', percent: 75 },
    { message: '数据入库完成', percent: 100 },
  ],
  energy_meter: [
    { message: '连接能源平台', percent: 10 },
    { message: '正在登录', percent: 25 },
    { message: '登录成功', percent: 40 },
    { message: '获取电能数据', percent: 60 },
    { message: '数据获取成功', percent: 85 },
    { message: '数据入库完成', percent: 100 },
  ],
}

export async function updateTaskProgress(taskId: number, step: { message: string; percent: number }, status: string = 'running', totalRecords?: number) {
  try {
    const task = await SyncTask.findByPk(taskId) as any
    if (!task) return
    const steps = Array.isArray(task.steps) ? [...task.steps] : []
    steps.push({ time: new Date().toISOString(), message: step.message, percent: step.percent })
    task.progress = step.percent
    task.current_step = step.message
    task.steps = steps
    task.status = status
    if (totalRecords !== undefined) task.total_records = totalRecords
    if (status === 'completed') task.finished_at = new Date()
    if (status === 'failed') task.finished_at = new Date()
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
    case 'energy_meter': return Math.floor(50 + Math.random() * 100)
    default: return Math.floor(10 + Math.random() * 20)
  }
}

export function calcNextRunAt(execMode: string, config: any, from: Date = new Date()): Date | null {
  if (!config) return null
  const base = new Date(from.getTime() + 1000)

  if (execMode === 'periodic') {
    const { interval, intervalUnit } = config
    if (!interval || !intervalUnit) return null
    const ms = intervalUnit === 'minute' ? interval * 60 * 1000
      : intervalUnit === 'hour' ? interval * 60 * 60 * 1000
      : interval * 24 * 60 * 60 * 1000
    return new Date(base.getTime() + ms)
  }

  if (execMode === 'scheduled') {
    const { fixedTime, fixedDays } = config
    if (!fixedTime || !fixedDays || fixedDays.length === 0) return null
    const [h, m] = fixedTime.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null
    for (let i = 0; i < 8; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, h, m, 0, 0)
      const dow = d.getDay() === 0 ? 7 : d.getDay()
      if (fixedDays.includes(dow) && d.getTime() > base.getTime()) {
        return d
      }
    }
    return null
  }

  if (execMode === 'once') {
    const { onceAt } = config
    if (!onceAt) return null
    const d = new Date(onceAt)
    if (isNaN(d.getTime())) return null
    if (d.getTime() > base.getTime()) return d
    return null
  }

  return null
}

function generateTaskBizId(type: string): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = pad(now.getMonth() + 1)
  const d = pad(now.getDate())
  const datePart = `${y}${m}${d}`
  const prefix = type === 'items' ? 'SCHI' : type === 'customers' ? 'SCHC' : type === 'env_monitor' ? 'SCHE' : type === 'weather' ? 'SCHW' : type === 'energy_meter' ? 'SCHEM' : 'SCHX'
  const rand = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}${datePart}${rand}`
}

export async function triggerScheduledTaskById(taskId: number) {
  try {
    const task = await ScheduledTask.findByPk(taskId) as any
    if (!task) return
    const type = task.task_type as string
    const execMode = task.exec_mode as string
    const cfg = task.config

    const activeSame = await SyncTask.findOne({
      where: { task_type: type, status: { [Op.in]: ['pending', 'running'] } },
      order: [['task_id', 'DESC']],
    })
    if (activeSame) {
      console.log(`[Scheduler] 跳过任务 ${task.schedule_biz_id}：已有同类型进行中任务`)
      return
    }

    const taskBizId = generateTaskBizId(type)
    const syncTask = await SyncTask.create({
      task_biz_id: taskBizId,
      task_type: type,
      status: 'running',
      progress: 5,
      current_step: '定时任务已启动',
      steps: [{ time: new Date().toISOString(), message: '定时触发，任务已启动', percent: 5 }],
      started_at: new Date(),
    })
    const syncTaskId = (syncTask as any).task_id

    const nextAt = calcNextRunAt(execMode, cfg)
    const updateData: any = {
      last_run_at: new Date(),
      last_run_result: '定时触发成功',
    }
    if (nextAt) updateData.next_run_at = nextAt
    else if (execMode === 'once') updateData.is_enabled = 0
    await ScheduledTask.update(updateData, { where: { schedule_id: taskId } })

    console.log(`[Scheduler] 已触发任务 ${task.schedule_biz_id} (${type}) -> ${taskBizId}`)

    // 获取任务设置参数
    let taskParams: Record<string, any> = {}
    try {
      const setting = await TaskSetting.findOne({ where: { task_type: type } })
      if (setting) taskParams = (setting as any).params || {}
    } catch (e) {
      console.warn('[Scheduler] 读取任务设置失败，使用默认参数:', e)
    }

    // 异步执行真实采集任务
    ;(async () => {
      await executeRealTask(type, taskBizId, syncTaskId, taskParams)
    })()
  } catch (err) {
    console.error('[Scheduler] 触发任务失败:', err)
  }
}

let schedulerTimer: NodeJS.Timeout | null = null

export async function startTaskScheduler() {
  if (schedulerTimer) return
  console.log('⏰ 定时任务调度器已启动（每30秒扫描）')

  try {
    const pending = await ScheduledTask.findAll({
      where: { is_enabled: 1, next_run_at: null },
    })
    for (const t of pending) {
      const task = t as any
      const nextAt = calcNextRunAt(task.exec_mode, task.config)
      if (nextAt) {
        task.next_run_at = nextAt
        await task.save()
        console.log(`[Scheduler] 修复任务 ${task.schedule_biz_id} next_run_at -> ${nextAt.toISOString()}`)
      }
    }
  } catch (err) {
    console.error('[Scheduler] 修复缺失 next_run_at 失败:', err)
  }

  const tick = async () => {
    try {
      const now = new Date()

      // 1. 超时检查：超过3分钟未完成的任务自动终止
      const threeMinAgo = new Date(now.getTime() - 3 * 60 * 1000)
      const timeoutTasks = await SyncTask.findAll({
        where: {
          status: { [Op.in]: ['pending', 'running'] },
          started_at: { [Op.lte]: threeMinAgo },
        },
      })
      for (const t of timeoutTasks) {
        const task = t as any
        const steps = Array.isArray(task.steps) ? [...task.steps] : []
        steps.push({ time: new Date().toISOString(), message: '任务执行超时（超过3分钟），已自动终止', percent: task.progress || 0 })
        await SyncTask.update(
          {
            status: 'failed',
            error_msg: '任务执行超时（超过3分钟），已自动终止',
            steps,
            finished_at: new Date(),
          },
          { where: { task_id: task.task_id } }
        )
        console.log(`[Scheduler] 超时终止任务 ${task.task_biz_id}`)
      }

      // 2. 触发到期任务
      const dueTasks = await ScheduledTask.findAll({
        where: {
          is_enabled: 1,
          next_run_at: { [Op.lte]: now },
        },
      })
      if (dueTasks.length > 0) {
        console.log(`[Scheduler] 发现 ${dueTasks.length} 个到期任务`)
        for (const t of dueTasks) {
          await triggerScheduledTaskById((t as any).schedule_id)
        }
      }
    } catch (err) {
      console.error('[Scheduler] 扫描失败:', err)
    }
  }

  tick()
  schedulerTimer = setInterval(tick, 30 * 1000)
}

export function stopTaskScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
    console.log('⏹ 定时任务调度器已停止')
  }
}
