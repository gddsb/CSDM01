import { Router } from 'express'
import { authRequired, logOperation } from '../middleware/auth.js'
import {
  listTaskSettings, updateTaskSetting, getU9Orgs, testTaskSetting,
  listSyncTasks, getSyncTask,
  listScheduledTasks, createScheduledTask, updateScheduledTask, deleteScheduledTask, triggerScheduledTask,
  listArchiveData, handleAlarm,
  dashboardOverview,
  dashboardTrend,
} from '../controllers/AutoTaskController.js'

const router = Router()

router.use(authRequired)

// 任务设置
router.get('/task-settings', listTaskSettings)
router.put('/task-settings/:taskType', logOperation('自动任务设置'), updateTaskSetting)
router.post('/task-settings/:taskType/test', logOperation('任务测试'), testTaskSetting)
router.get('/u9-orgs', getU9Orgs)

// 同步任务
router.get('/sync-tasks', listSyncTasks)
router.get('/sync-tasks/:id', getSyncTask)

// 定时任务
router.get('/scheduled-tasks', listScheduledTasks)
router.post('/scheduled-tasks', logOperation('定时任务'), createScheduledTask)
router.post('/scheduled-tasks/:id/trigger', logOperation('定时任务触发'), triggerScheduledTask)
router.put('/scheduled-tasks/:id', logOperation('定时任务'), updateScheduledTask)
router.delete('/scheduled-tasks/:id', logOperation('定时任务'), deleteScheduledTask)

// 档案数据浏览
router.get('/archive/:type', listArchiveData)
router.put('/env-alarm/:id/handle', logOperation('环境报警处理'), handleAlarm)

// 环境监测仪表盘
router.get('/dashboard/overview', dashboardOverview)
router.get('/dashboard/trend', dashboardTrend)

export default router
