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
import DeviceFaultController from '../controllers/DeviceFaultController.js'
import DeviceMaintenanceController from '../controllers/DeviceMaintenanceController.js'
import DeviceCalibrationController from '../controllers/DeviceCalibrationController.js'
import DeviceSparePartController from '../controllers/DeviceSparePartController.js'
import DeviceDocumentController from '../controllers/DeviceDocumentController.js'
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

// 故障图片上传 multer 配置（与不良图片相同规则，复用一份配置）
const deviceFaultUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('请上传图片格式的文件'))
    }
    cb(null, true)
  },
})

// 点检图片上传 multer 配置（同上规则）
const inspectionUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('请上传图片格式的文件'))
    }
    cb(null, true)
  },
})

// 维护图片上传 multer 配置（同上规则）
const deviceMaintenanceUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('请上传图片格式的文件'))
    }
    cb(null, true)
  },
})

// 校准证书上传 multer 配置（支持图片与 PDF）
const calibrationUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf')) {
      return cb(new Error('请上传图片或PDF格式的文件'))
    }
    cb(null, true)
  },
})

// 设备电子档案上传 multer 配置（支持 PDF/Office/图片/压缩包，单文件最大 50MB）
const deviceDocumentUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
    ]
    const isImage = file.mimetype && file.mimetype.startsWith('image/')
    const isOffice = file.mimetype && allowed.includes(file.mimetype)
    // 允许部分 octet-stream（某些环境下 doc/xls 会被识别为此类型）
    if (file.mimetype === 'application/octet-stream') return cb(null, true)
    if (!file.mimetype || (!isImage && !isOffice)) {
      return cb(new Error('请上传 PDF/Word/Excel/PowerPoint/图片/压缩包格式文件'))
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

// 设备故障管理
router.get('/device-faults', DeviceFaultController.list)
router.get('/device-faults/:id', DeviceFaultController.detail)
router.post('/device-faults', logOperation('设备故障上报'), DeviceFaultController.create)
router.put('/device-faults/:id/assign', logOperation('故障派工'), DeviceFaultController.assign)
router.put('/device-faults/:id/repair', logOperation('提交维修'), DeviceFaultController.submitRepair)
router.put('/device-faults/:id/approve', logOperation('故障审批'), DeviceFaultController.approve)
router.put('/device-faults/:id/close', logOperation('关闭故障'), DeviceFaultController.close)
router.delete('/device-faults/:id', logOperation('删除故障'), DeviceFaultController.delete)
// 故障图片
router.get('/device-faults/:id/images', DeviceFaultController.getImages)
router.post('/device-faults/:id/images', deviceFaultUploadMiddleware.array('images', 10), logOperation('上传故障图片'), DeviceFaultController.uploadImage)

// 设备保养标准（统一版，合并旧点检标准+维护标准）
router.get('/device-standards', DeviceMaintenanceController.listStandards)
router.post('/device-standards', logOperation('保养标准'), DeviceMaintenanceController.createStandard)
router.put('/device-standards/:id', logOperation('保养标准'), DeviceMaintenanceController.updateStandard)
router.delete('/device-standards/:id', logOperation('保养标准'), DeviceMaintenanceController.deleteStandard)

// 设备维护标准档案（设备级，承载编制/生效/停用状态）
// 注意：available-devices 必须在 :deviceId 之前，避免被参数路由匹配
router.get('/device-maintenance-profiles', DeviceMaintenanceController.listProfiles)
router.get('/device-maintenance-profiles/available-devices', DeviceMaintenanceController.listAvailableDevices)
router.get('/device-maintenance-profiles/:deviceId', DeviceMaintenanceController.detailProfile)
router.post('/device-maintenance-profiles', logOperation('维护标准档案'), DeviceMaintenanceController.createProfile)
router.put('/device-maintenance-profiles/:deviceId/status', logOperation('档案状态'), DeviceMaintenanceController.updateProfileStatus)
router.delete('/device-maintenance-profiles/:deviceId', logOperation('维护标准档案'), DeviceMaintenanceController.deleteProfile)

// 设备保养执行记录（统一版，合并旧点检计划/记录+维护工单）
router.post('/device-records/generate', logOperation('生成保养执行'), DeviceMaintenanceController.generateRecords)
router.get('/device-records/matrix', DeviceMaintenanceController.getMatrix)
router.get('/device-records', DeviceMaintenanceController.listRecords)
router.get('/device-records/:id', DeviceMaintenanceController.detailRecord)
router.put('/device-records/:id/start', logOperation('开始保养'), DeviceMaintenanceController.startRecord)
router.put('/device-records/:id/submit', logOperation('提交保养'), DeviceMaintenanceController.submitRecord)
router.post('/device-records/batch-submit', logOperation('批量提交保养'), DeviceMaintenanceController.batchSubmit)
router.put('/device-records/:id/skip', DeviceMaintenanceController.skipRecord)
router.delete('/device-records/:id', logOperation('删除保养记录'), DeviceMaintenanceController.deleteRecord)
router.get('/device-records/:id/images', DeviceMaintenanceController.getImages)
router.post('/device-records/:id/images', deviceMaintenanceUploadMiddleware.array('images', 10), logOperation('上传保养图片'), DeviceMaintenanceController.uploadImage)

// 设备运行时长
router.post('/device-runtime-logs', logOperation('录入运行时长'), DeviceMaintenanceController.logRuntime)
router.get('/device-runtime-logs', DeviceMaintenanceController.getRuntimeLog)

// 设备备件管理
router.get('/device-spare-parts', DeviceSparePartController.list)
router.get('/device-spare-parts/low-stock/list', DeviceSparePartController.getLowStock)
router.get('/device-spare-parts/:id', DeviceSparePartController.detail)
router.post('/device-spare-parts', logOperation('备件管理'), DeviceSparePartController.create)
router.put('/device-spare-parts/:id', logOperation('备件管理'), DeviceSparePartController.update)
router.delete('/device-spare-parts/:id', logOperation('备件管理'), DeviceSparePartController.delete)
router.post('/device-spare-parts/:id/stock-in', logOperation('备件入库'), DeviceSparePartController.stockIn)
router.post('/device-spare-parts/:id/stock-out', logOperation('备件出库'), DeviceSparePartController.stockOut)
router.post('/device-spare-parts/:id/adjust', logOperation('库存调整'), DeviceSparePartController.stockAdjust)
router.get('/device-spare-part-logs', DeviceSparePartController.listLogs)

// 设备校准管理
router.get('/device-calibration-plans', DeviceCalibrationController.listPlans)
router.get('/device-calibration-plans/expiring/list', DeviceCalibrationController.getExpiringSoon)
router.get('/device-calibration-plans/overdue/list', DeviceCalibrationController.getOverdue)
router.get('/device-calibration-plans/:id', DeviceCalibrationController.detailPlan)
router.post('/device-calibration-plans', logOperation('校准计划'), DeviceCalibrationController.createPlan)
router.put('/device-calibration-plans/:id', logOperation('校准计划'), DeviceCalibrationController.updatePlan)
router.delete('/device-calibration-plans/:id', logOperation('校准计划'), DeviceCalibrationController.deletePlan)
router.put('/device-calibration-plans/:id/submit', logOperation('提交校准'), DeviceCalibrationController.submitCalibration)
router.post('/device-calibration-plans/:id/certificate', calibrationUploadMiddleware.array('images', 10), logOperation('上传证书'), DeviceCalibrationController.uploadCertificate)
router.get('/device-calibration-records', DeviceCalibrationController.listRecords)

// 设备电子档案管理
router.get('/device-documents', DeviceDocumentController.list)
router.get('/device-documents/by-device/:deviceId', DeviceDocumentController.listByDevice)
router.get('/device-documents/:id/download', DeviceDocumentController.download)
router.get('/device-documents/:id', DeviceDocumentController.detail)
router.post('/device-documents', deviceDocumentUploadMiddleware.array('files', 10), logOperation('上传设备文档'), DeviceDocumentController.upload)
router.put('/device-documents/:id', logOperation('更新设备文档'), DeviceDocumentController.update)
router.delete('/device-documents/:id', logOperation('删除设备文档'), DeviceDocumentController.delete)

export default router
