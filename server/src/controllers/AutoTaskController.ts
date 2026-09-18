/**
 * 自动任务 Controller — CRUD 下沉 AutoTaskService
 * routes/auto.ts 以 import * as autoController 方式使用
 * generateTaskBizId 被 modules/auto/SyncTaskController.ts re-export
 */
import AutoTaskService, { generateTaskBizId } from '../services/AutoTaskService.js'
import { fetchU9Orgs, DEFAULT_U9_CONFIG } from '../services/u9Service.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

// ---------- TaskSetting ----------
export const listTaskSettings = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await AutoTaskService.listTaskSettings()
  return success(res, rows, '查询成功', rows.length)
})

export const updateTaskSetting = asyncHandler(async (req: Request, res: Response) => {
  const s = await AutoTaskService.updateTaskSetting(String(req.params.taskType), req.body)
  return success(res, s, '修改成功')
})

export const getU9Orgs = asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.query
  if (!username) return fail(res, '请输入用户名', ErrorCode.PARAM_INVALID)
  const orgs = await fetchU9Orgs({ ...DEFAULT_U9_CONFIG, username: String(username) })
  return success(res, orgs, '获取成功', orgs.length)
})

// ---------- SyncTask ----------
export const listSyncTasks = asyncHandler(async (req: Request, res: Response) => {
  const rows = await AutoTaskService.listSyncTasks(req.query)
  return success(res, rows, '查询成功', rows.length)
})

export const getSyncTask = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await AutoTaskService.getSyncTask(String(req.params.id)))
})

export const deleteSyncTask = asyncHandler(async (req: Request, res: Response) => {
  await AutoTaskService.deleteSyncTask(String(req.params.id))
  return success(res, null, '删除成功')
})

// ---------- ScheduledTask ----------
export const listScheduledTasks = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await AutoTaskService.listScheduledTasks()
  return success(res, rows, '查询成功', rows.length)
})

export const createScheduledTask = asyncHandler(async (req: Request, res: Response) => {
  const t = await AutoTaskService.createScheduledTask(req.body)
  return success(res, t, '创建成功')
})

export const updateScheduledTask = asyncHandler(async (req: Request, res: Response) => {
  const t = await AutoTaskService.updateScheduledTask(String(req.params.id), req.body)
  return success(res, t, '修改成功')
})

export const deleteScheduledTask = asyncHandler(async (req: Request, res: Response) => {
  await AutoTaskService.deleteScheduledTask(String(req.params.id))
  return success(res, null, '删除成功')
})

export const triggerScheduledTask = asyncHandler(async (req: Request, res: Response) => {
  const r = await AutoTaskService.triggerScheduledTask(String(req.params.id))
  return success(res, r, '已手动触发')
})

/** Re-export generateTaskBizId for modules/auto/SyncTaskController.ts */
export { generateTaskBizId }

export const testTaskSetting = asyncHandler(async (req: Request, res: Response) => {
  const r = await AutoTaskService.testTaskSetting(String(req.params.taskType))
  return success(res, r, '任务已启动，正在采集中...')
})

// ---------- Archive + Alarm ----------
export const listArchiveData = asyncHandler(async (req: Request, res: Response) => {
  const r = await AutoTaskService.listArchiveData(String(req.params.type), req.query)
  return success(res, { list: r.list, pagination: r.pagination })
})

export const handleAlarm = asyncHandler(async (req: Request, res: Response) => {
  const a = await AutoTaskService.handleAlarm(Number(req.params.id), req.body.handle_msg)
  return success(res, a, '已处理')
})

export default {
  listTaskSettings, updateTaskSetting, getU9Orgs,
  listSyncTasks, getSyncTask, deleteSyncTask,
  listScheduledTasks, createScheduledTask, updateScheduledTask, deleteScheduledTask, triggerScheduledTask,
  testTaskSetting, listArchiveData, handleAlarm,
}
