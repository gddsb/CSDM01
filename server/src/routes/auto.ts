import { Router } from 'express'
import { authRequired, logOperation } from '../middleware/auth.js'
import * as autoController from '../controllers/AutoTaskController.js'
import { syncToMasterData, syncProductionOrdersFull } from '../modules/auto/SyncTaskController.js'
import {
  dashboardOverview, dashboardTrend,
  productionDashboard, qualityDashboard, managementDashboard,
} from '../modules/auto/DashboardController.js'

const router = Router()

// 公开的看板API（大屏展示，无需登录）
router.get('/dashboard/overview', dashboardOverview)
router.get('/dashboard/trend', dashboardTrend)
router.get('/dashboard/production', productionDashboard)
router.get('/dashboard/quality', qualityDashboard)
router.get('/dashboard/management', managementDashboard)

router.use(authRequired)

// 任务设置
router.get('/task-settings', autoController.listTaskSettings)
router.put('/task-settings/:taskType', logOperation('自动任务设置'), autoController.updateTaskSetting)
router.post('/task-settings/:taskType/test', logOperation('任务测试'), autoController.testTaskSetting)
router.get('/u9-orgs', autoController.getU9Orgs)

// 同步任务
router.get('/sync-tasks', autoController.listSyncTasks)
router.get('/sync-tasks/:id', autoController.getSyncTask)
router.delete('/sync-tasks/:id', logOperation('删除同步任务'), autoController.deleteSyncTask)

// 定时任务
router.get('/scheduled-tasks', autoController.listScheduledTasks)
router.post('/scheduled-tasks', logOperation('定时任务'), autoController.createScheduledTask)
router.post('/scheduled-tasks/:id/trigger', logOperation('定时任务触发'), autoController.triggerScheduledTask)
router.put('/scheduled-tasks/:id', logOperation('定时任务'), autoController.updateScheduledTask)
router.delete('/scheduled-tasks/:id', logOperation('定时任务'), autoController.deleteScheduledTask)

// 档案数据浏览
router.get('/archive/:type', autoController.listArchiveData)
router.put('/env-alarm/:id/handle', logOperation('环境报警处理'), autoController.handleAlarm)

// 采集数据 → 业务主数据迁移（task_item→bas_material、task_production_order→production_order）
router.post('/sync-master', logOperation('采集数据同步主数据'), syncToMasterData)

// 生产订单一键同步：触发 task_生产订单同步 采集 → 完成后迁移到 production_order 业务表
router.post('/sync-production-orders', logOperation('生产订单同步'), syncProductionOrdersFull)

export default router
