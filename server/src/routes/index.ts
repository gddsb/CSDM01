import { Router } from 'express'
import multer from 'multer'
import authRoutes from './auth.js'
import systemRoutes from './system.js'
import basicRoutes from './basic.js'
import productionRoutes from './production.js'
import autoRoutes from './auto.js'
import energyRoutes from './energy.js'
import versionRoutes from './version.js'
// 检验数据统一存储改造（阶段3.1）：样品测量值 CRUD + 自动判定
import sampleValueRoutes from './sample-value.js'
import { uploadImage } from '../controllers/UploadController.js'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/security.js'

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

router.post('/upload/image', authRequired, commonUploadMiddleware.single('file'), asyncHandler(uploadImage))

// 版本信息 — 公开，无需登录（移动端 /tv 端启动时需要立即查询）
router.use('/version', versionRoutes)

// router.use 挂载子路由（Router 实例），不需要 asyncHandler
router.use('/auth', authRoutes) // login 公开，profile/change-password 在 authRoutes 内部已加 authRequired

// 核心业务路由 — 全局鉴权兜底（所有基础数据/生产/系统管理操作都需要登录）
router.use('/system', authRequired, systemRoutes)
router.use('/basic', authRequired, basicRoutes)
// ============ 公开路由（不需要 authRequired）============
// upload-logs — APP 端日志上报（纯日志写，无敏感操作；新 APP / token 过期也能上报）
router.post(
  '/production/report-images/upload-logs',
  asyncHandler(async (req: any, res: any) => {
    const fs = await import('fs')
    const path = await import('path')
    const logger = (await import('../utils/logger.js')).logger

    const logs = Array.isArray(req.body?.logs) ? req.body.logs : []
    if (logs.length === 0) return { success: true, message: '空日志忽略', data: { accepted: 0 } } as any

    const dir = path.resolve(process.cwd(), 'server/data/img_upload_logs')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const now = new Date()
    const fname = now.toISOString().replace(/[:.]/g, '-') + '.json'
    const fpath = path.join(dir, fname)

    const payload = {
      receivedAt: now.toISOString(),
      ua: req.headers['user-agent'],
      ip: (req as any).ip || req.headers['x-forwarded-for'] || '',
      count: logs.length,
      logs,
    }
    fs.writeFileSync(fpath, JSON.stringify(payload, null, 2), 'utf-8')
    logger.info('[ReportImage] UPLOAD_LOGS.SAVED', { fname, count: logs.length })
    return { success: true, data: { fname, accepted: logs.length }, message: '日志已接收' } as any
  }),
)

// ============ 以下生产业务路由需要登录 ============
router.use('/production', authRequired, productionRoutes)

// auto — 路由内部精细控制（dashboard 公开给大屏，task/sync 等需登录）
router.use('/auto', autoRoutes)

// energy — 全公开（大屏轮询用，设计如此）
router.use('/energy', energyRoutes)
// 阶段3.1 样品测量值 CRUD：/api/inspection-items/:item_id/sample-values
router.use('/inspection-items', authRequired, sampleValueRoutes)

export default router
