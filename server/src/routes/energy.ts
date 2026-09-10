import { Router } from 'express'
import { overview, trend, meterList, online } from '../controllers/EnergyController.js'

const router = Router()

// 能源看板公开接口（供大屏轮询，无需登录也可访问，由应用层统一处理）
router.get('/overview', overview)
router.get('/trend', trend)
router.get('/meter-list', meterList)
router.get('/online', online)

export default router
