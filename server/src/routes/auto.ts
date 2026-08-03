import { Router } from 'express'
import { authRequired, logOperation } from '../middleware/auth.js'
import {
  listTaskSettings, updateTaskSetting, getU9Orgs, testTaskSetting,
  listSyncTasks, getSyncTask, deleteSyncTask,
  listScheduledTasks, createScheduledTask, updateScheduledTask, deleteScheduledTask, triggerScheduledTask,
  listArchiveData, handleAlarm,
  dashboardOverview,
  dashboardTrend,
  productionDashboard,
  qualityDashboard,
  managementDashboard,
} from '../controllers/AutoTaskController.js'

const router = Router()

// 公开的看板API（大屏展示，无需登录）
router.get('/dashboard/overview', dashboardOverview)
router.get('/dashboard/trend', dashboardTrend)
router.get('/dashboard/production', productionDashboard)
router.get('/dashboard/quality', qualityDashboard)
router.get('/dashboard/management', managementDashboard)

router.use(authRequired)

// 任务设置
router.get('/task-settings', listTaskSettings)
router.put('/task-settings/:taskType', logOperation('自动任务设置'), updateTaskSetting)
router.post('/task-settings/:taskType/test', logOperation('任务测试'), testTaskSetting)
router.get('/u9-orgs', getU9Orgs)

// 同步任务
router.get('/sync-tasks', listSyncTasks)
router.get('/sync-tasks/:id', getSyncTask)
router.delete('/sync-tasks/:id', logOperation('删除同步任务'), deleteSyncTask)

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

// 三个业务看板API
router.get('/dashboard/production', productionDashboard)
router.get('/dashboard/quality', qualityDashboard)
router.get('/dashboard/management', managementDashboard)

export default router
