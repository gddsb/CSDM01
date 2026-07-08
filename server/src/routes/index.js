import { Router } from 'express'
import authRoutes from './auth.js'
import systemRoutes from './system.js'
import basicRoutes from './basic.js'
import productionRoutes from './production.js'
import appRoutes from './app.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/system', systemRoutes)
router.use('/basic', basicRoutes)
router.use('/production', productionRoutes)
router.use('/app', appRoutes)

export default router
