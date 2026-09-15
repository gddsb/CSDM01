import { Router } from 'express'
import { asyncHandler } from '../middleware/security.js'
import multer from 'multer'
import {
  list as orderList,
  detail as orderDetail,
  create as orderCreate,
  update as orderUpdate,
  remove as orderRemove,
  release,
  close,
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
} from '../controllers/ReportImageController.js'
import { authRequired, permissionRequired } from '../middleware/auth.js'

const router = Router()

const reportImageUpload = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('请上传图片格式的文件'))
    }
    cb(null, true)
  },
})

// 所有生产管理路由都需要登录
router.use(authRequired)

// 生产订单（状态：开立/下发/开工/完工/关闭）
router.get('/orders', asyncHandler(orderList))
router.get('/orders/:id', asyncHandler(orderDetail))
router.post('/orders', asyncHandler(orderCreate))
router.put('/orders/:id', asyncHandler(orderUpdate))
router.delete('/orders/:id', asyncHandler(orderRemove))
router.post('/orders/:id/release', permissionRequired('production:order:release'), asyncHandler(release))
router.post('/orders/:id/close', permissionRequired('production:order:close'), asyncHandler(close))
router.post('/orders/:id/finish', permissionRequired('production:order:finish'), asyncHandler(orderFinish))

// 生产报工单（状态：开工/完工；订单下发后直接创建）
router.get('/report-orders', asyncHandler(roList))
router.get('/report-orders/:id', asyncHandler(roDetail))
router.post('/report-orders', permissionRequired('production:reporting:create'), asyncHandler(roCreate))
router.put('/report-orders/:id', asyncHandler(roUpdate))
router.delete('/report-orders/:id', asyncHandler(roRemove))
router.post('/report-orders/:id/finish', permissionRequired('production:reporting:finish'), asyncHandler(roFinish))
router.post('/report-orders/:id/close', permissionRequired('production:reporting:close'), asyncHandler(roClose))
router.get('/report-orders/:id/processes', asyncHandler(roGetProcesses))

// 人员记录
router.get('/manpower-records', asyncHandler(manpowerList))
router.get('/manpower-records/summary/by-report-order', asyncHandler(manpowerSummary))
router.get('/manpower-records/:id', asyncHandler(manpowerDetail))
router.post('/manpower-records', asyncHandler(manpowerCreate))
router.put('/manpower-records/:id', asyncHandler(manpowerUpdate))
router.delete('/manpower-records/:id', asyncHandler(manpowerRemove))

// 工序不良记录
router.get('/process-defects', asyncHandler(defectList))
router.post('/process-defects', asyncHandler(defectCreate))
router.post('/process-defects/batch-save', asyncHandler(defectBatchSave))
router.put('/process-defects/:id', asyncHandler(defectUpdate))
router.delete('/process-defects/:id', asyncHandler(defectRemove))

// 检验报废记录
router.get('/scrap-defects', asyncHandler(scrapList))
router.post('/scrap-defects', asyncHandler(scrapCreate))
router.put('/scrap-defects/:id', asyncHandler(scrapUpdate))

// 异常工时记录
router.get('/process-exceptions', asyncHandler(exceptionList))
router.post('/process-exceptions', asyncHandler(exceptionCreate))
router.put('/process-exceptions/:id', asyncHandler(exceptionUpdate))
router.delete('/process-exceptions/:id', asyncHandler(exceptionRemove))

// 制程物料记录
router.get('/process-materials', asyncHandler(materialList))
router.post('/process-materials', asyncHandler(materialCreate))
router.put('/process-materials/:id', asyncHandler(materialUpdate))
router.delete('/process-materials/:id', asyncHandler(materialRemove))

// 报工图片
router.get('/report-images', asyncHandler(reportImageList))
router.delete('/report-images/:id', asyncHandler(reportImageRemove))
router.post('/report-images/:report_no/:category/upload', reportImageUpload.array('files', 10), asyncHandler(uploadReportImages))

export default router
