/**
 * 自动任务 Controller — 业务逻辑下沉 AutoTaskService
 * routes/auto.ts 以 `import * as autoController` 方式使用
 * modules/auto/SyncTaskController.ts 还 re-imports { generateTaskBizId }
 */
import AutoTaskService, { generateTaskBizId } from '../services/AutoTaskService.js'
import { fetchU9Orgs, DEFAULT_U9_CONFIG } from '../services/u9Service.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

const paramStr = (v: any): string => (Array.isArray(v) ? v[0] : v) || ''
const catchErr = (res: Response, err: any) => {
  if (err instanceof AppError) return fail(res, err.message, err.code || 10001, err.statusCode || 400)
  return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
}

// ---------- TaskSetting ----------
export const listTaskSettings = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await AutoTaskService.listTaskSettings()
  return success(res, rows, '查询成功', rows.length)
})
export const updateTaskSetting = async (req: Request, res: Response) => {
  try { const s = await AutoTaskService.updateTaskSetting(paramStr(req.params.taskType), req.body); return success(res, s, '修改成功') } catch (err: any) { return catchErr(res, err) }
}
export const getU9Orgs = async (req: Request, res: Response) => {
  try {
    const { username } = req.query
    if (!username) return fail(res, '请输入用户名', ErrorCode.PARAM_INVALID)
    const orgs = await fetchU9Orgs({ ...DEFAULT_U9_CONFIG, username: paramStr(username) })
    return success(res, orgs, '获取成功', orgs.length)
  } catch (err: any) { logger.error('[AutoTask] getU9Orgs:', err.message); return fail(res, err.message || '获取组织列表失败', ErrorCode.SYSTEM_ERROR) }
}

// ---------- SyncTask ----------
export const listSyncTasks = asyncHandler(async (req: Request, res: Response) => {
  const rows = await AutoTaskService.listSyncTasks(req.query)
  return success(res, rows, '查询成功', rows.length)
})
export const getSyncTask = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await AutoTaskService.getSyncTask(paramStr(req.params.id)))
})
export const deleteSyncTask = async (req: Request, res: Response) => {
  try { await AutoTaskService.deleteSyncTask(paramStr(req.params.id)); return success(res, null, '删除成功') } catch (err: any) { return catchErr(res, err) }
}

// ---------- ScheduledTask ----------
export const listScheduledTasks = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await AutoTaskService.listScheduledTasks()
  return success(res, rows, '查询成功', rows.length)
})
export const createScheduledTask = async (req: Request, res: Response) => {
  try { const t = await AutoTaskService.createScheduledTask(req.body); return success(res, t, '创建成功') } catch (err: any) { return catchErr(res, err) }
}
export const updateScheduledTask = async (req: Request, res: Response) => {
  try { const t = await AutoTaskService.updateScheduledTask(paramStr(req.params.id), req.body); return success(res, t, '修改成功') } catch (err: any) { return catchErr(res, err) }
}
export const deleteScheduledTask = async (req: Request, res: Response) => {
  try { await AutoTaskService.deleteScheduledTask(paramStr(req.params.id)); return success(res, null, '删除成功') } catch (err: any) { return catchErr(res, err) }
}
export const triggerScheduledTask = async (req: Request, res: Response) => {
  try { const r = await AutoTaskService.triggerScheduledTask(paramStr(req.params.id)); return success(res, r, '已手动触发') } catch (err: any) { return catchErr(res, err) }
}
/** Re-export generateTaskBizId for modules/auto/SyncTaskController.ts */
export { generateTaskBizId }

export const testTaskSetting = async (req: Request, res: Response) => {
  try { const r = await AutoTaskService.testTaskSetting(paramStr(req.params.taskType)); return success(res, r, '任务已启动，正在采集中...') } catch (err: any) { return catchErr(res, err) }
}

// ---------- Archive + Alarm ----------
export const listArchiveData = asyncHandler(async (req: Request, res: Response) => {
  const r = await AutoTaskService.listArchiveData(paramStr(req.params.type), req.query)
  return success(res, { list: r.list, pagination: r.pagination })
})
export const handleAlarm = async (req: Request, res: Response) => {
  try { const a = await AutoTaskService.handleAlarm(Number(req.params.id), req.body.handle_msg); return success(res, a, '已处理') } catch (err: any) { return catchErr(res, err) }
}

export default {
  listTaskSettings, updateTaskSetting, getU9Orgs,
  listSyncTasks, getSyncTask, deleteSyncTask,
  listScheduledTasks, createScheduledTask, updateScheduledTask, deleteScheduledTask, triggerScheduledTask,
  testTaskSetting, listArchiveData, handleAlarm,
}
