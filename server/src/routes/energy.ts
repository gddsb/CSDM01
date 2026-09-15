import { Router } from 'express'
import { asyncHandler } from '../middleware/security.js'
import { overview, trend, monthTrend, meterList, online } from '../controllers/EnergyController.js'

const router = Router()

// 能源看板公开接口（供大屏轮询，无需登录也可访问，由应用层统一处理）
router.get('/overview', asyncHandler(overview))
router.get('/trend', asyncHandler(trend))
router.get('/month-trend', asyncHandler(monthTrend))
router.get('/meter-list', asyncHandler(meterList))
router.get('/online', asyncHandler(online))

export default router
