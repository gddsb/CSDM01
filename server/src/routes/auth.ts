import { Router } from 'express'
import { login, profile, logout } from '../controllers/AuthController.js'
import { authRequired } from '../middleware/auth.js'
import { loginRateLimiter } from '../middleware/security.js'

const router = Router()

// 登录不需要鉴权，但需要严格限流以防止暴力破解
router.post('/login', loginRateLimiter, login)
// 其余接口需要登录
router.get('/profile', authRequired, profile)
router.post('/logout', authRequired, logout)

export default router
