import { Router } from 'express'
import multer from 'multer'
import { getLatest, list, create, update, remove, uploadPackage, downloadPackage } from '../controllers/AppVersionController.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

// 版本检查（无需鉴权，APP 启动时即可调用）
router.get('/version/latest', getLatest)
// APK 下载（无需鉴权，方便用户点击链接直接下载）
router.get('/version/download/:id', downloadPackage)

// 以下接口需要登录
router.get('/versions', authRequired, list)
router.post('/versions', authRequired, create)
router.put('/versions/:id', authRequired, update)
router.delete('/versions/:id', authRequired, remove)

// APK 安装包上传（需登录，仅管理员调用）
// 文件大小限制 200MB，仅允许 apk/ipa
const apkUpload = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase()
    if (!ext.endsWith('.apk') && !ext.endsWith('.ipa')) {
      return cb(new Error('请上传 .apk 或 .ipa 格式的安装包文件'))
    }
    cb(null, true)
  },
})
router.post('/version/upload', authRequired, apkUpload.single('package'), uploadPackage)

export default router
