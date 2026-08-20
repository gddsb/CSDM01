import { Router } from 'express'
import multer from 'multer'
import { list, detail, create, update, remove } from '../controllers/MaterialController.js'
import {
  list as lineList,
  detail as lineDetail,
  create as lineCreate,
  update as lineUpdate,
  remove as lineRemove,
} from '../controllers/ProductionLineController.js'
import {
  getLineProcesses,
  addLineProcess,
  removeLineProcess,
  updateLineProcessSort,
  getLineDevices,
  addLineDevice,
  removeLineDevice,
  updateLineDeviceSort,
} from '../controllers/LineRelationController.js'
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
  nextCode as defectNextCode,
} from '../controllers/DefectTypeController.js'
import {
  listImages as defectImageList,
  uploadImages as defectImageUpload,
  deleteImage as defectImageDelete,
} from '../controllers/DefectImageController.js'
import {
  list as customerList,
  detail as customerDetail,
  create as customerCreate,
  update as customerUpdate,
  remove as customerRemove,
} from '../controllers/CustomerController.js'
import SupplierController from '../controllers/SupplierController.js'
import {
  list as ruleList,
  detail as ruleDetail,
  create as ruleCreate,
  update as ruleUpdate,
  remove as ruleRemove,
  toggle as ruleToggle,
  audit as ruleAudit,
  preview as rulePreview,
} from '../controllers/NumberRuleController.js'
import {
  list as instrumentList,
  detail as instrumentDetail,
  create as instrumentCreate,
  update as instrumentUpdate,
  remove as instrumentRemove,
} from '../controllers/InstrumentController.js'
import ProductInspectionController from '../controllers/ProductInspectionController.js'
import IncomingInspectionController from '../controllers/IncomingInspectionController.js'
import InspectionStandardController from '../controllers/InspectionStandardController.js'
import MicrobeInspectionController from '../controllers/MicrobeInspectionController.js'
import EnvInspectionController from '../controllers/EnvInspectionController.js'
import ComplaintController from '../controllers/ComplaintController.js'
import SupplierComplaintController from '../controllers/SupplierComplaintController.js'
import { authRequired, logOperation } from '../middleware/auth.js'

const router = Router()

// 不良图片上传 multer 配置
const defectUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('请上传图片格式的文件'))
    }
    cb(null, true)
  },
})

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

// 产线-工序关联
router.get('/production-lines/:id/processes', getLineProcesses)
router.post('/production-lines/:id/processes', addLineProcess)
router.delete('/production-lines/:id/processes/:processId', removeLineProcess)
router.put('/production-lines/:id/processes/sort', updateLineProcessSort)

// 产线-设备关联
router.get('/production-lines/:id/devices', getLineDevices)
router.post('/production-lines/:id/devices', addLineDevice)
router.delete('/production-lines/:id/devices/:deviceId', removeLineDevice)
router.put('/production-lines/:id/devices/sort', updateLineDeviceSort)

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
router.get('/defect-types/next-code', defectNextCode)
router.get('/defect-types/:id', defectDetail)
router.post('/defect-types', defectCreate)
router.put('/defect-types/:id', defectUpdate)
router.delete('/defect-types/:id', defectRemove)

// 不良图片
router.get('/defect-types/:id/images', defectImageList)
router.post('/defect-types/:id/images', defectUploadMiddleware.array('images', 10), defectImageUpload)
router.delete('/defect-types/:id/images/:imageId', defectImageDelete)

// 客户档案
router.get('/customers', customerList)
router.get('/customers/:id', customerDetail)
router.post('/customers', customerCreate)
router.put('/customers/:id', customerUpdate)
router.delete('/customers/:id', customerRemove)

// 供应商档案
router.get('/suppliers', SupplierController.list)
router.get('/suppliers/:id', SupplierController.detail)
router.post('/suppliers', logOperation('供应商档案'), SupplierController.create)
router.put('/suppliers/:id', logOperation('供应商档案'), SupplierController.update)
router.delete('/suppliers/:id', logOperation('供应商档案'), SupplierController.remove)
router.post('/suppliers/seed', SupplierController.seed)

// 编号规则（编码管理）
router.get('/number-rules', ruleList)
router.get('/number-rules/:id', ruleDetail)
router.post('/number-rules', logOperation('编码管理'), ruleCreate)
router.put('/number-rules/:id', logOperation('编码管理'), ruleUpdate)
router.delete('/number-rules/:id', logOperation('编码管理'), ruleRemove)
router.post('/number-rules/:id/toggle', logOperation('编码管理'), ruleToggle)
router.post('/number-rules/:id/audit', logOperation('编码管理'), ruleAudit)
router.get('/number-rules/:id/preview', rulePreview)

// 产品检测
router.get('/product-inspections', ProductInspectionController.list)
router.get('/product-inspections/:id', ProductInspectionController.detail)
router.post('/product-inspections', logOperation('产品检测'), ProductInspectionController.create)
router.put('/product-inspections/:id', logOperation('产品检测'), ProductInspectionController.update)
router.put('/product-inspections/:id/submit', logOperation('产品检测报审'), ProductInspectionController.submit)
router.put('/product-inspections/:id/start', logOperation('产品检测开检'), ProductInspectionController.start)
router.put('/product-inspections/:id/review', logOperation('产品检测审核'), ProductInspectionController.review)
router.delete('/product-inspections/:id', logOperation('产品检测'), ProductInspectionController.delete)

// 来料检验
router.get('/incoming-inspections', IncomingInspectionController.list)
router.post('/incoming-inspections/sync-purchase-receipts', logOperation('采购入库同步'), IncomingInspectionController.syncFromPurchaseReceipts)
router.get('/incoming-inspections/:id', IncomingInspectionController.detail)
router.post('/incoming-inspections', logOperation('来料检验'), IncomingInspectionController.create)
router.put('/incoming-inspections/:id', logOperation('来料检验'), IncomingInspectionController.update)
router.put('/incoming-inspections/:id/submit', logOperation('来料检验报审'), IncomingInspectionController.submit)
router.put('/incoming-inspections/:id/start', logOperation('来料检验开检'), IncomingInspectionController.start)
router.put('/incoming-inspections/:id/review', logOperation('来料检验审核'), IncomingInspectionController.review)
router.delete('/incoming-inspections/:id', logOperation('来料检验'), IncomingInspectionController.delete)

// 检验标准
router.get('/standards', InspectionStandardController.list)
router.get('/standards/generate/no', InspectionStandardController.generateNo)
router.get('/standards/:id', InspectionStandardController.detail)
router.post('/standards', logOperation('检验标准'), InspectionStandardController.create)
router.put('/standards/:id', logOperation('检验标准'), InspectionStandardController.update)
router.delete('/standards/:id', logOperation('检验标准'), InspectionStandardController.remove)
router.post('/standards/:id/copy', logOperation('检验标准'), InspectionStandardController.copy)
router.post('/standards/:id/revise', logOperation('检验标准'), InspectionStandardController.revise)
router.get('/standards/:standardId/items', InspectionStandardController.listItems)

// 微生物检验
router.get('/microbe-inspections', MicrobeInspectionController.list)
router.get('/microbe-inspections/:id', MicrobeInspectionController.detail)
router.post('/microbe-inspections', logOperation('微生物检验'), MicrobeInspectionController.create)
router.put('/microbe-inspections/:id', logOperation('微生物检验'), MicrobeInspectionController.update)
router.delete('/microbe-inspections/:id', logOperation('微生物检验'), MicrobeInspectionController.delete)

// 环境检验路由
router.get('/env-inspections', EnvInspectionController.list)
router.get('/env-inspections/:id', EnvInspectionController.detail)
router.post('/env-inspections', logOperation('环境检验'), EnvInspectionController.create)
router.put('/env-inspections/:id', logOperation('环境检验'), EnvInspectionController.update)
router.delete('/env-inspections/:id', logOperation('环境检验'), EnvInspectionController.delete)
// 环境检验区域
router.get('/env-areas', EnvInspectionController.listAreas)
router.post('/env-areas', logOperation('环境区域'), EnvInspectionController.createArea)
router.put('/env-areas/:id', logOperation('环境区域'), EnvInspectionController.updateArea)
router.delete('/env-areas/:id', logOperation('环境区域'), EnvInspectionController.deleteArea)
// 环境检验模板
router.get('/env-templates', EnvInspectionController.listTemplates)
router.post('/env-templates', logOperation('环境模板'), EnvInspectionController.createTemplate)
router.put('/env-templates/:id', logOperation('环境模板'), EnvInspectionController.updateTemplate)
router.delete('/env-templates/:id', logOperation('环境模板'), EnvInspectionController.deleteTemplate)
// 根据区域获取模板
router.get('/env-templates/area/:areaId', EnvInspectionController.getTemplatesByArea)

// 检测仪器
router.get('/instruments', instrumentList)
router.get('/instruments/:id', instrumentDetail)
router.post('/instruments', logOperation('检测仪器'), instrumentCreate)
router.put('/instruments/:id', logOperation('检测仪器'), instrumentUpdate)
router.delete('/instruments/:id', logOperation('检测仪器'), instrumentRemove)

// 客诉管理路由
router.get('/complaints', ComplaintController.list)
router.get('/complaints/:id', ComplaintController.detail)
router.post('/complaints', logOperation('客诉管理'), ComplaintController.create)
router.put('/complaints/:id', logOperation('客诉管理'), ComplaintController.update)
router.delete('/complaints/:id', logOperation('客诉管理'), ComplaintController.delete)
router.post('/complaints/:id/records', logOperation('客诉记录'), ComplaintController.addRecord)
router.put('/complaints/:id/close', logOperation('关闭客诉'), ComplaintController.close)

// 供应商投诉管理路由
router.get('/supplier-complaints', SupplierComplaintController.list)
router.get('/supplier-complaints/:id', SupplierComplaintController.detail)
router.post('/supplier-complaints', logOperation('供应商投诉'), SupplierComplaintController.create)
router.put('/supplier-complaints/:id', logOperation('供应商投诉'), SupplierComplaintController.update)
router.delete('/supplier-complaints/:id', logOperation('供应商投诉'), SupplierComplaintController.delete)
router.put('/supplier-complaints/:id/issue', logOperation('发出投诉'), SupplierComplaintController.issue)
router.put('/supplier-complaints/:id/reply', logOperation('供应商回复'), SupplierComplaintController.reply)
router.put('/supplier-complaints/:id/close', logOperation('关闭投诉'), SupplierComplaintController.close)
router.get('/supplier-complaints/:id/pdf', SupplierComplaintController.generatePdf)

export default router
