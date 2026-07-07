import { Router } from 'express'
import { getLatest, list, create, update, remove } from '../controllers/AppVersionController.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

router.get('/version/latest', getLatest)
router.get('/versions', authRequired, list)
router.post('/versions', authRequired, create)
router.put('/versions/:id', authRequired, update)
router.delete('/versions/:id', authRequired, remove)

export default router
