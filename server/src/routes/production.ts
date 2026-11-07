import { Router } from 'express'
import { asyncHandler } from '../middleware/security.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { logger } from '../utils/logger.js'
import {
  list as orderList,
  detail as orderDetail,
  create as orderCreate,
  update as orderUpdate,
  remove as orderRemove,
  release,
  close,
  preCheck as orderPreCheck,
  finish as orderFinish,
} from '../controllers/OrderController.js'
import {
  list as roList,
  detail as roDetail,
  create as roCreate,
  update as roUpdate,
  remove as roRemove,
  finish as roFinish,
  close as roClose,
  preCheck as roPreCheck,
  getProcesses as roGetProcesses,
} from '../controllers/ReportOrderController.js'
import {
  list as manpowerList,
  detail as manpowerDetail,
  create as manpowerCreate,
  update as manpowerUpdate,
  remove as manpowerRemove,
  summaryByReportOrder as manpowerSummary,
} from '../controllers/ManpowerRecordController.js'
import {
  list as defectList,
  create as defectCreate,
  remove as defectRemove,
  update as defectUpdate,
  batchSave as defectBatchSave,
  scrapList,
  scrapCreate,
  scrapUpdate,
} from '../controllers/ProcessDefectController.js'
import {
  list as exceptionList,
  create as exceptionCreate,
  update as exceptionUpdate,
  remove as exceptionRemove,
} from '../controllers/ProcessExceptionController.js'
import {
  list as materialList,
  create as materialCreate,
  update as materialUpdate,
  remove as materialRemove,
} from '../controllers/ProcessMaterialController.js'
import {
  uploadImages as uploadReportImages,
  list as reportImageList,
  remove as reportImageRemove,
  removeByUrl as reportImageRemoveByUrl,
} from '../controllers/ReportImageController.js'
import {
  list as breakTimeList,
  batchSave as breakTimeBatchSave,
  create as breakTimeCreate,
  remove as breakTimeRemove,
} from '../controllers/BreakTimeController.js'
import {
  list as holidayList,
  batchSave as holidayBatchSave,
  create as holidayCreate,
  remove as holidayRemove,
} from '../controllers/HolidayController.js'
import { authRequired } from '../middleware/auth.js'
import { requirePerm } from '../framework/permission/func/permissionMiddleware.js'
import { dataScope } from '../framework/permission/datascope/dataScopeMiddleware.js'
import { bizStatusCheck } from '../framework/permission/bizstatus/bizStatusMiddleware.js'

const router = Router()

/**
 * 统一 MulterError 处理中间件 —— 413 带清晰 message
 * multer 抛的错误在 busboy 层，asyncHandler 捕获后返回 500 裸 JSON
 * 这里单独识别 LIMIT_FILE_SIZE / LIMIT_FILE_COUNT / LIMIT_FIELD_KEY / 非图片
 */
function multerErrorHandler(err: any, _req: any, res: any, next: any) {
  if (err?.name === 'MulterError') {
    const code = err.code
    const msg = ({
      LIMIT_FILE_SIZE: `图片过大：单张请不超过 ${Math.round(UPLOAD_MAX_MB)}MB，建议压缩后重试`,
      LIMIT_FILE_COUNT: `上传张数过多（最多 ${UPLOAD_MAX_COUNT} 张）`,
      LIMIT_FIELD_KEY: '上传字段名不合法',
      LIMIT_FIELD_COUNT: '上传字段过多',
    } as any)[code] || `上传失败 (${code})`
    logger.warn('[ReportImage] MulterError', { code, field: err.field, msg })
    return res.status(413).json({ success: false, message: msg, code })
  }
  // 非 MulterError（如 fileFilter 里抛的 Error）
  if (err?.message?.includes('图片格式')) {
    logger.warn('[ReportImage] Rejected non-image mimetype')
    return res.status(400).json({ success: false, message: err.message })
  }
  next(err) // 其他错误交给全局 error handler
}

/** 移动端单张拍照常见 8~15MB，留足余量 */
const UPLOAD_MAX_MB = 30
const UPLOAD_MAX_COUNT = 10

const reportImageUpload = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('只支持 jpg/png/webp 等图片格式'))
    }
    cb(null, true)
  },
})

// ============ 以下路由都需要登录 ============
router.use(authRequired)

// 生产订单（状态：开立/下发/开工/完工/关闭）
router.get('/orders', requirePerm({ permCode: 'production:order' }), dataScope({ businessObj: 'production_order' }), asyncHandler(orderList))
router.get('/orders/:id', requirePerm({ permCode: 'production:order' }), asyncHandler(orderDetail))
router.post('/orders', requirePerm({ permCode: 'production:order:create' }), asyncHandler(orderCreate))
router.put('/orders/:id', requirePerm({ permCode: 'production:order:update' }), asyncHandler(orderUpdate))
router.delete('/orders/:id', requirePerm({ permCode: 'production:order:delete' }), bizStatusCheck({ businessObj: 'production_order', operateKey: 'delete' }), asyncHandler(orderRemove))
router.post('/orders/:id/release', requirePerm({ permCode: 'production:order:release' }), bizStatusCheck({ businessObj: 'production_order', operateKey: 'start' }), asyncHandler(release))
router.post('/orders/:id/close', requirePerm({ permCode: 'production:order:close' }), bizStatusCheck({ businessObj: 'production_order', operateKey: 'close' }), asyncHandler(close))
router.get('/orders/:id/pre-check', requirePerm({ permCode: 'production:order' }), asyncHandler(orderPreCheck))
router.post('/orders/:id/finish', requirePerm({ permCode: 'production:order:finish' }), bizStatusCheck({ businessObj: 'production_order', operateKey: 'finish' }), asyncHandler(orderFinish))

// 生产报工单（状态：未开工/开工/已提交/完工）
router.get('/report-orders', requirePerm({ permCode: 'production:reporting' }), dataScope({ businessObj: 'process_report' }), asyncHandler(roList))
router.get('/report-orders/:id', requirePerm({ permCode: 'production:reporting' }), asyncHandler(roDetail))
router.post('/report-orders', requirePerm({ permCode: 'production:reporting:create' }), asyncHandler(roCreate))
router.put('/report-orders/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(roUpdate))
router.delete('/report-orders/:id', requirePerm({ permCode: 'production:reporting:delete' }), asyncHandler(roRemove))
router.post('/report-orders/:id/finish', requirePerm({ permCode: 'production:reporting:finish' }), bizStatusCheck({ businessObj: 'process_report', operateKey: 'finish' }), asyncHandler(roFinish))
router.post('/report-orders/:id/close', requirePerm({ permCode: 'production:reporting:close' }), asyncHandler(roClose))
router.get('/report-orders/:id/pre-check', requirePerm({ permCode: 'production:reporting' }), asyncHandler(roPreCheck))
router.get('/report-orders/:id/processes', requirePerm({ permCode: 'production:reporting' }), asyncHandler(roGetProcesses))

// 人员记录（关联 process_report，复用其数据权限）
router.get('/manpower-records', requirePerm({ permCode: 'production:reporting' }), dataScope({ businessObj: 'process_report' }), asyncHandler(manpowerList))
router.get('/manpower-records/summary/by-report-order', requirePerm({ permCode: 'production:reporting' }), asyncHandler(manpowerSummary))
router.get('/manpower-records/:id', requirePerm({ permCode: 'production:reporting' }), asyncHandler(manpowerDetail))
router.post('/manpower-records', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(manpowerCreate))
router.put('/manpower-records/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(manpowerUpdate))
router.delete('/manpower-records/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(manpowerRemove))

// 工序不良记录
router.get('/process-defects', requirePerm({ permCode: 'production:reporting' }), dataScope({ businessObj: 'process_report' }), asyncHandler(defectList))
router.post('/process-defects', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(defectCreate))
router.post('/process-defects/batch-save', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(defectBatchSave))
router.put('/process-defects/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(defectUpdate))
router.delete('/process-defects/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(defectRemove))

// 检验报废记录
router.get('/scrap-defects', requirePerm({ permCode: 'production:reporting' }), dataScope({ businessObj: 'process_report' }), asyncHandler(scrapList))
router.post('/scrap-defects', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(scrapCreate))
router.put('/scrap-defects/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(scrapUpdate))

// 异常工时记录
router.get('/process-exceptions', requirePerm({ permCode: 'production:reporting' }), dataScope({ businessObj: 'process_report' }), asyncHandler(exceptionList))
router.post('/process-exceptions', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(exceptionCreate))
router.put('/process-exceptions/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(exceptionUpdate))
router.delete('/process-exceptions/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(exceptionRemove))

// 制程物料记录
router.get('/process-materials', requirePerm({ permCode: 'production:reporting' }), dataScope({ businessObj: 'process_report' }), asyncHandler(materialList))
router.post('/process-materials', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(materialCreate))
router.put('/process-materials/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(materialUpdate))
router.delete('/process-materials/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(materialRemove))

// 报工图片 —— 单独路由级 MulterError handler，返回 HTTP 413 + 清晰 message
// 注意：字面路由 by-url 必须在参数路由 :id 之前注册，否则 Express 会优先匹配 :id
router.get('/report-images', requirePerm({ permCode: 'production:reporting' }), dataScope({ businessObj: 'process_report' }), asyncHandler(reportImageList))
router.delete('/report-images/by-url', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(reportImageRemoveByUrl))
router.delete('/report-images/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(reportImageRemove))
router.post(
  '/report-images/:report_no/:category/upload',
  requirePerm({ permCode: 'production:reporting:update' }),
  reportImageUpload.array('files', UPLOAD_MAX_COUNT),
  multerErrorHandler,
  asyncHandler(uploadReportImages),
)

// ============ 休息时间段 ============
router.get('/break-times', requirePerm({ permCode: 'production:reporting' }), asyncHandler(breakTimeList))
router.post('/break-times/batch', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(breakTimeBatchSave))
router.post('/break-times', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(breakTimeCreate))
router.delete('/break-times/:id', requirePerm({ permCode: 'production:reporting:update' }), asyncHandler(breakTimeRemove))

// ============ 休息日/节假日字典（维保跳过用） ============
router.get('/holidays', requirePerm({ permCode: 'production:settings' }), asyncHandler(holidayList))
router.post('/holidays/batch', requirePerm({ permCode: 'production:settings' }), asyncHandler(holidayBatchSave))
router.post('/holidays', requirePerm({ permCode: 'production:settings' }), asyncHandler(holidayCreate))
router.delete('/holidays/:date', requirePerm({ permCode: 'production:settings' }), asyncHandler(holidayRemove))

export default router
