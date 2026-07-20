import { Router } from 'express'
import multer from 'multer'
import authRoutes from './auth.js'
import systemRoutes from './system.js'
import basicRoutes from './basic.js'
import productionRoutes from './production.js'
import { uploadImage } from '../controllers/UploadController.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

const commonUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('请上传图片格式的文件'))
    }
    cb(null, true)
  },
})

router.post('/upload/image', authRequired, commonUploadMiddleware.single('file'), uploadImage)

router.use('/auth', authRoutes)
router.use('/system', systemRoutes)
router.use('/basic', basicRoutes)
router.use('/production', productionRoutes)

export default router
