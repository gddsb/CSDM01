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
} from '../controllers/OrderController.js'
import {
  list as woList,
  detail as woDetail,
  create as woCreate,
  update as woUpdate,
  remove as woRemove,
  start,
  finish,
} from '../controllers/WorkOrderController.js'
import { list as reportList, create as reportCreate, update as reportUpdate, start as reportStart, finish as reportFinish } from '../controllers/ProcessReportController.js'
import { list as manpowerList, detail as manpowerDetail, create as manpowerCreate, update as manpowerUpdate, remove as manpowerRemove, summaryByWorkOrder as manpowerSummary } from '../controllers/ManpowerRecordController.js'
import { list as exceptionList, create as exceptionCreate, update as exceptionUpdate } from '../controllers/ExceptionRecordController.js'
import { list as defectList, create as defectCreate, remove as defectRemove, update as defectUpdate, batchSave as defectBatchSave, scrapList, scrapCreate, scrapUpdate } from '../controllers/ProcessDefectController.js'
import { list as exceptionTimeList, create as exceptionTimeCreate, update as exceptionTimeUpdate, remove as exceptionTimeRemove } from '../controllers/ProcessExceptionController.js'
import { list as materialList, create as materialCreate, update as materialUpdate, remove as materialRemove } from '../controllers/ProcessMaterialController.js'
import { uploadImages as uploadReportImages } from '../controllers/ReportImageController.js'
import { authRequired } from '../middleware/auth.js'

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

// 生产订单
router.get('/orders', orderList)
router.get('/orders/:id', orderDetail)
router.post('/orders', orderCreate)
router.put('/orders/:id', orderUpdate)
router.delete('/orders/:id', orderRemove)
router.post('/orders/:id/release', release)
router.post('/orders/:id/close', close)

// 工单
router.get('/work-orders', woList)
router.get('/work-orders/:id', woDetail)
router.post('/work-orders', woCreate)
router.put('/work-orders/:id', woUpdate)
router.delete('/work-orders/:id', woRemove)
router.post('/work-orders/:id/start', start)
router.post('/work-orders/:id/finish', finish)

// 工序报工
router.get('/process-reports', reportList)
router.post('/process-reports', reportCreate)
router.put('/process-reports/:id', reportUpdate)
router.post('/process-reports/:id/start', reportStart)
router.post('/process-reports/:id/finish', reportFinish)

// 人员记录
router.get('/manpower-records', manpowerList)
router.get('/manpower-records/summary/by-work-order', manpowerSummary)
router.get('/manpower-records/:id', manpowerDetail)
router.post('/manpower-records', manpowerCreate)
router.put('/manpower-records/:id', manpowerUpdate)
router.delete('/manpower-records/:id', manpowerRemove)

// 异常记录
router.get('/exceptions', exceptionList)
router.post('/exceptions', exceptionCreate)
router.put('/exceptions/:id', exceptionUpdate)

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
router.get('/process-exceptions', exceptionTimeList)
router.post('/process-exceptions', exceptionTimeCreate)
router.put('/process-exceptions/:id', exceptionTimeUpdate)
router.delete('/process-exceptions/:id', exceptionTimeRemove)

// 制程物料记录
router.get('/process-materials', materialList)
router.post('/process-materials', materialCreate)
router.put('/process-materials/:id', materialUpdate)
router.delete('/process-materials/:id', materialRemove)

// 报工图片上传
router.post('/report-images/:report_no/:category/upload', reportImageUpload.array('files', 10), uploadReportImages)

export default router
