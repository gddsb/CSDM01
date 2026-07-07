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
import { list as reportList, create as reportCreate } from '../controllers/ProcessReportController.js'
import { list as manpowerList, create as manpowerCreate } from '../controllers/ManpowerRecordController.js'
import { list as exceptionList, create as exceptionCreate } from '../controllers/ExceptionRecordController.js'
import { list as defectList, create as defectCreate, remove as defectRemove } from '../controllers/ProcessDefectController.js'
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

// 人员投入
router.get('/manpower-records', manpowerList)
router.post('/manpower-records', manpowerCreate)

// 异常记录
router.get('/exceptions', exceptionList)
router.post('/exceptions', exceptionCreate)

// 工序不良记录
router.get('/process-defects', defectList)
router.post('/process-defects', defectCreate)
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
