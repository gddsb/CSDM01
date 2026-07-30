import { Router } from 'express'
import {
  listAvailableDashboards,
  listConfigs,
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  listDashboardUsers,
  createShare,
  listShares,
  deleteShare,
  getShareByToken,
} from '../controllers/DashboardController.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

// 可用看板列表
router.get('/dashboards/available', authRequired, listAvailableDashboards)

// 看板配置 CRUD
router.get('/dashboards/configs', authRequired, listConfigs)
router.get('/dashboards/configs/:id', authRequired, getConfig)
router.post('/dashboards/configs', authRequired, createConfig)
router.put('/dashboards/configs/:id', authRequired, updateConfig)
router.delete('/dashboards/configs/:id', authRequired, deleteConfig)

// 看板用户（角色为"看板查看者"的用户）
router.get('/dashboards/users', authRequired, listDashboardUsers)

// 分享链接
router.get('/dashboards/shares', authRequired, listShares)
router.post('/dashboards/shares', authRequired, createShare)
router.delete('/dashboards/shares/:id', authRequired, deleteShare)

// 公开接口 - 通过token获取看板配置（无需登录）
router.get('/dashboards/share/:token', getShareByToken)

export default router
