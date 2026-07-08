import { Router } from 'express'
import { login, profile, logout } from '../controllers/AuthController.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

// 登录不需要鉴权
router.post('/login', login)
// 其余接口需要登录
router.get('/profile', authRequired, profile)
router.post('/logout', authRequired, logout)

export default router
