import { Router } from 'express'
import { login, profile, logout, changePassword, updateProfile } from '../controllers/AuthController.js'
import { authRequired } from '../middleware/auth.js'
import { loginRateLimiter } from '../middleware/security.js'
import { validateBody } from '../middleware/validate.js'
import { loginSchema, changePasswordSchema, profileUpdateSchema } from '../validators/auth.schema.js'

const router = Router()

// 登录不需要鉴权，但需要严格限流以防止暴力破解
router.post('/login', loginRateLimiter, validateBody(loginSchema), login)
// 其余接口需要登录
router.get('/profile', authRequired, profile)
router.post('/logout', authRequired, logout)
router.put('/profile', authRequired, validateBody(profileUpdateSchema), updateProfile)
router.post('/change-password', authRequired, validateBody(changePasswordSchema), changePassword)

export default router
