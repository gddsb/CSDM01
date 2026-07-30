import { Op } from 'sequelize'
import { ScheduledTask, SyncTask } from '../models/index.js'

function pad(n: number) { return String(n).padStart(2, '0') }

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
  const prefix = type === 'items' ? 'SCHI' : type === 'customers' ? 'SCHC' : type === 'env_monitor' ? 'SCHE' : 'SCHW'
  const rand = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}${datePart}${rand}`
}

export async function triggerScheduledTaskById(taskId: number) {
  try {
    const task = await ScheduledTask.findByPk(taskId) as any
    if (!task) return
    const type = task.task_type as string

    const activeSame = await SyncTask.findOne({
      where: { task_type: type, status: { [Op.in]: ['pending', 'running'] } },
      order: [['task_id', 'DESC']],
    })
    if (activeSame) {
      console.log(`[Scheduler] 跳过任务 ${task.schedule_biz_id}：已有同类型进行中任务`)
      return
    }

    const taskBizId = generateTaskBizId(type)
    await SyncTask.create({
      task_biz_id: taskBizId,
      task_type: type,
      status: 'running',
      progress: 5,
      current_step: '定时任务已启动',
      steps: [{ time: new Date().toISOString(), message: '定时触发，任务已启动', percent: 5 }],
      started_at: new Date(),
    })

    task.last_run_at = new Date()
    task.last_run_result = '定时触发成功'
    const nextAt = calcNextRunAt(task.exec_mode, task.config)
    if (nextAt) task.next_run_at = nextAt
    else if (task.exec_mode === 'once') task.is_enabled = 0
    await task.save()

    console.log(`[Scheduler] 已触发任务 ${task.schedule_biz_id} (${type}) -> ${taskBizId}`)
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
