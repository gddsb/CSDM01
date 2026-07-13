import { Router } from 'express'
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
import { list as exceptionList, create as exceptionCreate } from '../controllers/ExceptionRecordController.js'
import { list as defectList, create as defectCreate, remove as defectRemove, update as defectUpdate, batchSave as defectBatchSave } from '../controllers/ProcessDefectController.js'
import { list as exceptionTimeList, create as exceptionTimeCreate, remove as exceptionTimeRemove } from '../controllers/ProcessExceptionController.js'
import { list as materialList, create as materialCreate, remove as materialRemove } from '../controllers/ProcessMaterialController.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

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

// 工序不良记录
router.get('/process-defects', defectList)
router.post('/process-defects', defectCreate)
router.post('/process-defects/batch-save', defectBatchSave)
router.put('/process-defects/:id', defectUpdate)
router.delete('/process-defects/:id', defectRemove)

// 异常工时记录
router.get('/process-exceptions', exceptionTimeList)
router.post('/process-exceptions', exceptionTimeCreate)
router.delete('/process-exceptions/:id', exceptionTimeRemove)

// 制程物料记录
router.get('/process-materials', materialList)
router.post('/process-materials', materialCreate)
router.delete('/process-materials/:id', materialRemove)

export default router
