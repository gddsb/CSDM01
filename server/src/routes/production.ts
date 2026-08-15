import { Router } from 'express'
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
router.get('/orders', orderList)
router.get('/orders/:id', orderDetail)
router.post('/orders', orderCreate)
router.put('/orders/:id', orderUpdate)
router.delete('/orders/:id', orderRemove)
router.post('/orders/:id/release', permissionRequired('production:order:release'), release)
router.post('/orders/:id/close', permissionRequired('production:order:close'), close)
router.post('/orders/:id/finish', permissionRequired('production:order:finish'), orderFinish)

// 生产报工单（状态：开工/完工；订单下发后直接创建）
router.get('/report-orders', roList)
router.get('/report-orders/:id', roDetail)
router.post('/report-orders', permissionRequired('production:reporting:create'), roCreate)
router.put('/report-orders/:id', roUpdate)
router.delete('/report-orders/:id', roRemove)
router.post('/report-orders/:id/finish', permissionRequired('production:reporting:finish'), roFinish)
router.post('/report-orders/:id/close', permissionRequired('production:reporting:close'), roClose)
router.get('/report-orders/:id/processes', roGetProcesses)

// 人员记录
router.get('/manpower-records', manpowerList)
router.get('/manpower-records/summary/by-report-order', manpowerSummary)
router.get('/manpower-records/:id', manpowerDetail)
router.post('/manpower-records', manpowerCreate)
router.put('/manpower-records/:id', manpowerUpdate)
router.delete('/manpower-records/:id', manpowerRemove)

// 工序不良记录
router.get('/process-defects', defectList)
router.post('/process-defects', defectCreate)
router.post('/process-defects/batch-save', defectBatchSave)
router.put('/process-defects/:id', defectUpdate)
router.delete('/process-defects/:id', defectRemove)

// 检验报废记录
router.get('/scrap-defects', scrapList)
router.post('/scrap-defects', scrapCreate)
router.put('/scrap-defects/:id', scrapUpdate)

// 异常工时记录
router.get('/process-exceptions', exceptionList)
router.post('/process-exceptions', exceptionCreate)
router.put('/process-exceptions/:id', exceptionUpdate)
router.delete('/process-exceptions/:id', exceptionRemove)

// 制程物料记录
router.get('/process-materials', materialList)
router.post('/process-materials', materialCreate)
router.put('/process-materials/:id', materialUpdate)
router.delete('/process-materials/:id', materialRemove)

// 报工图片
router.get('/report-images', reportImageList)
router.delete('/report-images/:id', reportImageRemove)
router.post('/report-images/:report_no/:category/upload', reportImageUpload.array('files', 10), uploadReportImages)

export default router
