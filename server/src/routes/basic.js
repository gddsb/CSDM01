import { Router } from 'express'
import { list, detail, create, update, remove } from '../controllers/MaterialController.js'
import {
  list as lineList,
  detail as lineDetail,
  create as lineCreate,
  update as lineUpdate,
  remove as lineRemove,
} from '../controllers/ProductionLineController.js'
import {
  list as processList,
  detail as processDetail,
  create as processCreate,
  update as processUpdate,
  remove as processRemove,
} from '../controllers/ProcessController.js'
import {
  list as deviceList,
  detail as deviceDetail,
  create as deviceCreate,
  update as deviceUpdate,
  remove as deviceRemove,
} from '../controllers/DeviceController.js'
import {
  list as defectList,
  detail as defectDetail,
  create as defectCreate,
  update as defectUpdate,
  remove as defectRemove,
} from '../controllers/DefectTypeController.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

// 所有基础数据路由都需要登录
router.use(authRequired)

// 料品档案
router.get('/materials', list)
router.get('/materials/:id', detail)
router.post('/materials', create)
router.put('/materials/:id', update)
router.delete('/materials/:id', remove)

// 产线
router.get('/production-lines', lineList)
router.get('/production-lines/:id', lineDetail)
router.post('/production-lines', lineCreate)
router.put('/production-lines/:id', lineUpdate)
router.delete('/production-lines/:id', lineRemove)

// 工序
router.get('/processes', processList)
router.get('/processes/:id', processDetail)
router.post('/processes', processCreate)
router.put('/processes/:id', processUpdate)
router.delete('/processes/:id', processRemove)

// 设备
router.get('/devices', deviceList)
router.get('/devices/:id', deviceDetail)
router.post('/devices', deviceCreate)
router.put('/devices/:id', deviceUpdate)
router.delete('/devices/:id', deviceRemove)

// 不良分类
router.get('/defect-types', defectList)
router.get('/defect-types/:id', defectDetail)
router.post('/defect-types', defectCreate)
router.put('/defect-types/:id', defectUpdate)
router.delete('/defect-types/:id', defectRemove)

export default router
