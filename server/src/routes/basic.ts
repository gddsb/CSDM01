import { Router } from 'express'
import { asyncHandler } from '../middleware/security.js'
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
import ProcessInspectionController from '../controllers/ProcessInspectionController.js'
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
import { requirePerm } from '../framework/permission/func/permissionMiddleware.js'
import { dataScope } from '../framework/permission/datascope/dataScopeMiddleware.js'

const router = Router()

// 不良图片上传 multer 配置
const defectUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 20 * 1024 * 1024 },
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
  limits: { fileSize: 20 * 1024 * 1024 },
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
  limits: { fileSize: 20 * 1024 * 1024 },
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
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('请上传图片格式的文件'))
    }
    cb(null, true)
  },
})

// 客诉处理记录附件上传 multer 配置
// 支持：Office（Word/Excel/PPT/PDF）单文件 ≤20MB；压缩包（ZIP/RAR/7z）单文件 ≤50MB
// 单次上传总大小 ≤200MB
const COMPLAINT_OFFICE_EXTS = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf'])
const COMPLAINT_ARCHIVE_EXTS = new Set(['.zip', '.rar', '.7z'])
const COMPLAINT_MAX_TOTAL_SIZE = 200 * 1024 * 1024
const complaintAttachmentUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 最大单文件 50MB
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').substring(file.originalname.lastIndexOf('.')).toLowerCase()
    if (COMPLAINT_OFFICE_EXTS.has(ext)) {
      if (file.size && file.size > 20 * 1024 * 1024) {
        return cb(new Error(`办公文档格式（${ext}）单文件不能超过 20MB`))
      }
      return cb(null, true)
    }
    if (COMPLAINT_ARCHIVE_EXTS.has(ext)) {
      // 压缩包 multer limits 已经限制到 50MB，不再二次校验
      return cb(null, true)
    }
    return cb(new Error('仅支持 Word/Excel/PPT/PDF/ZIP/RAR/7z 格式'))
  },
})

// 客诉附件总大小前置校验中间件（遍历 header 无法得到真实总大小，改用在 controller 内校验）

// 校准证书上传 multer 配置（支持图片与 PDF）
const calibrationUploadMiddleware = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 20 * 1024 * 1024 },
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

// ============ 料品档案 ============
router.get('/materials', requirePerm({ permCode: 'basic:material' }), asyncHandler(list))
router.get('/materials/:id', requirePerm({ permCode: 'basic:material' }), asyncHandler(detail))
router.post('/materials', requirePerm({ permCode: 'basic:material:create' }), asyncHandler(create))
router.put('/materials/:id', requirePerm({ permCode: 'basic:material:update' }), asyncHandler(update))
router.delete('/materials/:id', requirePerm({ permCode: 'basic:material:delete' }), asyncHandler(remove))

// ============ 产线 ============
router.get('/production-lines', requirePerm({ permCode: 'basic:line' }), asyncHandler(lineList))
router.get('/production-lines/:id', requirePerm({ permCode: 'basic:line' }), asyncHandler(lineDetail))
router.post('/production-lines', requirePerm({ permCode: 'basic:line:create' }), asyncHandler(lineCreate))
router.put('/production-lines/:id', requirePerm({ permCode: 'basic:line:update' }), asyncHandler(lineUpdate))
router.delete('/production-lines/:id', requirePerm({ permCode: 'basic:line:delete' }), asyncHandler(lineRemove))

// ============ 产线-工序关联 ============
router.get('/production-lines/:id/processes', requirePerm({ permCode: 'basic:line' }), asyncHandler(getLineProcesses))
router.post('/production-lines/:id/processes', requirePerm({ permCode: 'basic:line:update' }), asyncHandler(addLineProcess))
router.delete('/production-lines/:id/processes/:processId', requirePerm({ permCode: 'basic:line:update' }), asyncHandler(removeLineProcess))
router.put('/production-lines/:id/processes/sort', requirePerm({ permCode: 'basic:line:update' }), asyncHandler(updateLineProcessSort))

// ============ 产线-设备关联 ============
router.get('/production-lines/:id/devices', requirePerm({ permCode: 'basic:line' }), asyncHandler(getLineDevices))
router.post('/production-lines/:id/devices', requirePerm({ permCode: 'basic:line:update' }), asyncHandler(addLineDevice))
router.delete('/production-lines/:id/devices/:deviceId', requirePerm({ permCode: 'basic:line:update' }), asyncHandler(removeLineDevice))
router.put('/production-lines/:id/devices/sort', requirePerm({ permCode: 'basic:line:update' }), asyncHandler(updateLineDeviceSort))

// ============ 工序 ============
router.get('/processes', requirePerm({ permCode: 'basic:process' }), asyncHandler(processList))
router.get('/processes/:id', requirePerm({ permCode: 'basic:process' }), asyncHandler(processDetail))
router.post('/processes', requirePerm({ permCode: 'basic:process:create' }), asyncHandler(processCreate))
router.put('/processes/:id', requirePerm({ permCode: 'basic:process:update' }), asyncHandler(processUpdate))
router.delete('/processes/:id', requirePerm({ permCode: 'basic:process:delete' }), asyncHandler(processRemove))

// ============ 设备 ============
router.get('/devices', requirePerm({ permCode: 'all:device:list:view' }), asyncHandler(deviceList))
router.get('/devices/:id', requirePerm({ permCode: 'all:device:list:view' }), asyncHandler(deviceDetail))
router.post('/devices', requirePerm({ permCode: 'pc:device:list:create' }), asyncHandler(deviceCreate))
router.put('/devices/:id', requirePerm({ permCode: 'pc:device:list:update' }), asyncHandler(deviceUpdate))
router.delete('/devices/:id', requirePerm({ permCode: 'pc:device:list:delete' }), asyncHandler(deviceRemove))

// ============ 不良分类 ============
router.get('/defect-types', requirePerm({ permCode: 'basic:defect' }), asyncHandler(defectList))
router.get('/defect-types/next-code', requirePerm({ permCode: 'basic:defect' }), asyncHandler(defectNextCode))
router.get('/defect-types/:id', requirePerm({ permCode: 'basic:defect' }), asyncHandler(defectDetail))
router.post('/defect-types', requirePerm({ permCode: 'basic:defect:create' }), asyncHandler(defectCreate))
router.put('/defect-types/:id', requirePerm({ permCode: 'basic:defect:update' }), asyncHandler(defectUpdate))
router.delete('/defect-types/:id', requirePerm({ permCode: 'basic:defect:delete' }), asyncHandler(defectRemove))

// ============ 不良图片 ============
router.get('/defect-types/:id/images', requirePerm({ permCode: 'basic:defect' }), asyncHandler(defectImageList))
router.post('/defect-types/:id/images', requirePerm({ permCode: 'basic:defect:update' }), defectUploadMiddleware.array('images', 10), asyncHandler(defectImageUpload))
router.delete('/defect-types/:id/images/:imageId', requirePerm({ permCode: 'basic:defect:update' }), asyncHandler(defectImageDelete))

// ============ 客户档案 ============
router.get('/customers', requirePerm({ permCode: 'basic:customer' }), asyncHandler(customerList))
router.get('/customers/:id', requirePerm({ permCode: 'basic:customer' }), asyncHandler(customerDetail))
router.post('/customers', requirePerm({ permCode: 'basic:customer:create' }), asyncHandler(customerCreate))
router.put('/customers/:id', requirePerm({ permCode: 'basic:customer:update' }), asyncHandler(customerUpdate))
router.delete('/customers/:id', requirePerm({ permCode: 'basic:customer:delete' }), asyncHandler(customerRemove))

// ============ 供应商档案 ============
router.get('/suppliers', requirePerm({ permCode: 'basic:supplier' }), asyncHandler(SupplierController.list))
router.get('/suppliers/:id', requirePerm({ permCode: 'basic:supplier' }), asyncHandler(SupplierController.detail))
router.post('/suppliers', requirePerm({ permCode: 'basic:supplier:create' }), logOperation('供应商档案'), asyncHandler(SupplierController.create))
router.put('/suppliers/:id', requirePerm({ permCode: 'basic:supplier:update' }), logOperation('供应商档案'), asyncHandler(SupplierController.update))
router.delete('/suppliers/:id', requirePerm({ permCode: 'basic:supplier:delete' }), logOperation('供应商档案'), asyncHandler(SupplierController.remove))
router.post('/suppliers/seed', requirePerm({ permCode: 'basic:supplier:create' }), asyncHandler(SupplierController.seed))

// ============ 编号规则（编码管理） ============
router.get('/number-rules', requirePerm({ permCode: 'basic:number-rule' }), asyncHandler(ruleList))
router.get('/number-rules/:id', requirePerm({ permCode: 'basic:number-rule' }), asyncHandler(ruleDetail))
router.post('/number-rules', requirePerm({ permCode: 'basic:number-rule:create' }), logOperation('编码管理'), asyncHandler(ruleCreate))
router.put('/number-rules/:id', requirePerm({ permCode: 'basic:number-rule:update' }), logOperation('编码管理'), asyncHandler(ruleUpdate))
router.delete('/number-rules/:id', requirePerm({ permCode: 'basic:number-rule:delete' }), logOperation('编码管理'), asyncHandler(ruleRemove))
router.post('/number-rules/:id/toggle', requirePerm({ permCode: 'basic:number-rule:update' }), logOperation('编码管理'), asyncHandler(ruleToggle))
router.post('/number-rules/:id/audit', requirePerm({ permCode: 'basic:number-rule:audit' }), logOperation('编码管理'), asyncHandler(ruleAudit))
router.get('/number-rules/:id/preview', requirePerm({ permCode: 'basic:number-rule' }), asyncHandler(rulePreview))

// ============ 产品检测 ============
router.get('/product-inspections', requirePerm({ permCode: 'quality:product' }), dataScope({ businessObj: 'product_inspection' }), asyncHandler(ProductInspectionController.list))
router.get('/product-inspections/:id', requirePerm({ permCode: 'quality:product' }), asyncHandler(ProductInspectionController.detail))
router.post('/product-inspections', requirePerm({ permCode: 'quality:product:create' }), logOperation('产品检测'), asyncHandler(ProductInspectionController.create))
router.put('/product-inspections/:id', requirePerm({ permCode: 'quality:product:update' }), logOperation('产品检测'), asyncHandler(ProductInspectionController.update))
router.put('/product-inspections/:id/submit', requirePerm({ permCode: 'quality:product:update' }), logOperation('产品检测报审'), asyncHandler(ProductInspectionController.submit))
router.put('/product-inspections/:id/start', requirePerm({ permCode: 'quality:product:update' }), logOperation('产品检测开检'), asyncHandler(ProductInspectionController.start))
router.put('/product-inspections/:id/review', requirePerm({ permCode: 'quality:product:update' }), logOperation('产品检测审核'), asyncHandler(ProductInspectionController.review))
router.delete('/product-inspections/:id', requirePerm({ permCode: 'quality:product:delete' }), logOperation('产品检测'), asyncHandler(ProductInspectionController.delete))

// ============ 来料检验 ============
router.get('/incoming-inspections', requirePerm({ permCode: 'quality:incoming' }), dataScope({ businessObj: 'incoming_inspection' }), asyncHandler(IncomingInspectionController.list))
router.post('/incoming-inspections/sync-purchase-receipts', requirePerm({ permCode: 'quality:incoming:create' }), logOperation('采购入库同步'), asyncHandler(IncomingInspectionController.syncFromPurchaseReceipts))
router.get('/incoming-inspections/:id', requirePerm({ permCode: 'quality:incoming' }), asyncHandler(IncomingInspectionController.detail))
router.post('/incoming-inspections', requirePerm({ permCode: 'quality:incoming:create' }), logOperation('来料检验'), asyncHandler(IncomingInspectionController.create))
router.put('/incoming-inspections/:id', requirePerm({ permCode: 'quality:incoming:update' }), logOperation('来料检验'), asyncHandler(IncomingInspectionController.update))
router.put('/incoming-inspections/:id/submit', requirePerm({ permCode: 'quality:incoming:update' }), logOperation('来料检验报审'), asyncHandler(IncomingInspectionController.submit))
router.put('/incoming-inspections/:id/start', requirePerm({ permCode: 'quality:incoming:update' }), logOperation('来料检验开检'), asyncHandler(IncomingInspectionController.start))
router.put('/incoming-inspections/:id/review', requirePerm({ permCode: 'quality:incoming:update' }), logOperation('来料检验审核'), asyncHandler(IncomingInspectionController.review))
router.delete('/incoming-inspections/:id', requirePerm({ permCode: 'quality:incoming:delete' }), logOperation('来料检验'), asyncHandler(IncomingInspectionController.delete))

// ============ 过程检验（移动端优先，简化版：在制品列表 + 一步提交） ============
router.get('/process-inspections/wip', requirePerm({ permCode: 'quality:process' }), dataScope({ businessObj: 'process_inspection' }), asyncHandler(ProcessInspectionController.listWip))
router.get('/process-inspections', requirePerm({ permCode: 'quality:process' }), dataScope({ businessObj: 'process_inspection' }), asyncHandler(ProcessInspectionController.list))
router.get('/process-inspections/:id', requirePerm({ permCode: 'quality:process' }), asyncHandler(ProcessInspectionController.detail))
router.post('/process-inspections', requirePerm({ permCode: 'quality:process:create' }), logOperation('过程检验'), asyncHandler(ProcessInspectionController.create))
router.post('/process-inspections/submit', requirePerm({ permCode: 'quality:process:update' }), logOperation('过程检验提交'), asyncHandler(ProcessInspectionController.submit))
router.put('/process-inspections/:id', requirePerm({ permCode: 'quality:process:update' }), logOperation('过程检验'), asyncHandler(ProcessInspectionController.update))
router.delete('/process-inspections/:id', requirePerm({ permCode: 'quality:process:delete' }), logOperation('过程检验'), asyncHandler(ProcessInspectionController.delete))

// ============ 检验标准 ============
router.get('/standards', requirePerm({ permCode: 'quality:standard' }), asyncHandler(InspectionStandardController.list))
router.get('/standards/generate/no', requirePerm({ permCode: 'quality:standard' }), asyncHandler(InspectionStandardController.generateNo))
router.get('/standards/:id', requirePerm({ permCode: 'quality:standard' }), asyncHandler(InspectionStandardController.detail))
router.post('/standards', requirePerm({ permCode: 'quality:standard:create' }), logOperation('检验标准'), asyncHandler(InspectionStandardController.create))
router.put('/standards/:id', requirePerm({ permCode: 'quality:standard:update' }), logOperation('检验标准'), asyncHandler(InspectionStandardController.update))
router.delete('/standards/:id', requirePerm({ permCode: 'quality:standard:delete' }), logOperation('检验标准'), asyncHandler(InspectionStandardController.remove))
router.post('/standards/:id/copy', requirePerm({ permCode: 'quality:standard:copy' }), logOperation('检验标准'), asyncHandler(InspectionStandardController.copy))
router.post('/standards/:id/revise', requirePerm({ permCode: 'quality:standard:revise' }), logOperation('检验标准'), asyncHandler(InspectionStandardController.revise))
router.get('/standards/:standardId/items', requirePerm({ permCode: 'quality:standard' }), asyncHandler(InspectionStandardController.listItems))

// ============ 微生物检验 ============
router.get('/microbe-inspections', requirePerm({ permCode: 'quality:microbe' }), dataScope({ businessObj: 'microbe_inspection' }), asyncHandler(MicrobeInspectionController.list))
router.get('/microbe-inspections/:id', requirePerm({ permCode: 'quality:microbe' }), asyncHandler(MicrobeInspectionController.detail))
router.post('/microbe-inspections', requirePerm({ permCode: 'quality:microbe:create' }), logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.create))
router.put('/microbe-inspections/:id', requirePerm({ permCode: 'quality:microbe:update' }), logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.update))
router.delete('/microbe-inspections/:id', requirePerm({ permCode: 'quality:microbe:delete' }), logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.delete))

// ============ 环境检验 ============
router.get('/env-inspections', requirePerm({ permCode: 'quality:environment' }), dataScope({ businessObj: 'env_inspection' }), asyncHandler(EnvInspectionController.list))
router.get('/env-inspections/:id', requirePerm({ permCode: 'quality:environment' }), asyncHandler(EnvInspectionController.detail))
router.post('/env-inspections', requirePerm({ permCode: 'quality:environment:create' }), logOperation('环境检验'), asyncHandler(EnvInspectionController.create))
router.put('/env-inspections/:id', requirePerm({ permCode: 'quality:environment:update' }), logOperation('环境检验'), asyncHandler(EnvInspectionController.update))
router.delete('/env-inspections/:id', requirePerm({ permCode: 'quality:environment:delete' }), logOperation('环境检验'), asyncHandler(EnvInspectionController.delete))

// ============ 环境检验区域 ============
router.get('/env-areas', requirePerm({ permCode: 'quality:environment' }), asyncHandler(EnvInspectionController.listAreas))
router.post('/env-areas', requirePerm({ permCode: 'quality:environment:create' }), logOperation('环境区域'), asyncHandler(EnvInspectionController.createArea))
router.put('/env-areas/:id', requirePerm({ permCode: 'quality:environment:update' }), logOperation('环境区域'), asyncHandler(EnvInspectionController.updateArea))
router.delete('/env-areas/:id', requirePerm({ permCode: 'quality:environment:delete' }), logOperation('环境区域'), asyncHandler(EnvInspectionController.deleteArea))

// ============ 环境检验模板 ============
router.get('/env-templates', requirePerm({ permCode: 'quality:environment' }), asyncHandler(EnvInspectionController.listTemplates))
router.post('/env-templates', requirePerm({ permCode: 'quality:environment:create' }), logOperation('环境模板'), asyncHandler(EnvInspectionController.createTemplate))
router.put('/env-templates/:id', requirePerm({ permCode: 'quality:environment:update' }), logOperation('环境模板'), asyncHandler(EnvInspectionController.updateTemplate))
router.delete('/env-templates/:id', requirePerm({ permCode: 'quality:environment:delete' }), logOperation('环境模板'), asyncHandler(EnvInspectionController.deleteTemplate))
router.get('/env-templates/area/:areaId', requirePerm({ permCode: 'quality:environment' }), asyncHandler(EnvInspectionController.getTemplatesByArea))

// ============ 检测仪器 ============
router.get('/instruments', requirePerm({ permCode: 'quality:instrument' }), asyncHandler(instrumentList))
router.get('/instruments/:id', requirePerm({ permCode: 'quality:instrument' }), asyncHandler(instrumentDetail))
router.post('/instruments', requirePerm({ permCode: 'quality:instrument:create' }), logOperation('检测仪器'), asyncHandler(instrumentCreate))
router.put('/instruments/:id', requirePerm({ permCode: 'quality:instrument:update' }), logOperation('检测仪器'), asyncHandler(instrumentUpdate))
router.delete('/instruments/:id', requirePerm({ permCode: 'quality:instrument:delete' }), logOperation('检测仪器'), asyncHandler(instrumentRemove))

// ============ 客诉管理 ============
router.get('/complaints', requirePerm({ permCode: 'quality:complaint' }), dataScope({ businessObj: 'customer_complaint' }), asyncHandler(ComplaintController.list))
router.get('/complaints/:id', requirePerm({ permCode: 'quality:complaint' }), asyncHandler(ComplaintController.detail))
router.post('/complaints', requirePerm({ permCode: 'quality:complaint:create' }), logOperation('客诉管理'), asyncHandler(ComplaintController.create))
router.put('/complaints/:id', requirePerm({ permCode: 'quality:complaint:update' }), logOperation('客诉管理'), asyncHandler(ComplaintController.update))
router.delete('/complaints/:id', requirePerm({ permCode: 'quality:complaint:delete' }), logOperation('客诉管理'), asyncHandler(ComplaintController.delete))
router.post('/complaints/:id/records', requirePerm({ permCode: 'quality:complaint:update' }), logOperation('客诉记录'), asyncHandler(ComplaintController.addRecord))
router.post('/complaints/:id/attachments', requirePerm({ permCode: 'quality:complaint:update' }), complaintAttachmentUploadMiddleware.array('files', 10), logOperation('上传客诉附件'), asyncHandler(ComplaintController.uploadAttachment))
router.put('/complaints/:id/close', requirePerm({ permCode: 'quality:complaint:update' }), logOperation('关闭客诉'), asyncHandler(ComplaintController.close))

// ============ 供应商投诉 ============
router.get('/supplier-complaints', requirePerm({ permCode: 'quality:complaint:view' }), dataScope({ businessObj: 'supplier_complaint' }), asyncHandler(SupplierComplaintController.list))
router.get('/supplier-complaints/:id', requirePerm({ permCode: 'quality:complaint:supplier' }), asyncHandler(SupplierComplaintController.detail))
router.post('/supplier-complaints', requirePerm({ permCode: 'quality:complaint:create' }), logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.create))
router.put('/supplier-complaints/:id', requirePerm({ permCode: 'quality:complaint:update' }), logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.update))
router.delete('/supplier-complaints/:id', requirePerm({ permCode: 'quality:complaint:delete' }), logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.delete))
router.put('/supplier-complaints/:id/issue', requirePerm({ permCode: 'quality:complaint:update' }), logOperation('发出投诉'), asyncHandler(SupplierComplaintController.issue))
router.put('/supplier-complaints/:id/reply', requirePerm({ permCode: 'quality:complaint:update' }), logOperation('供应商回复'), asyncHandler(SupplierComplaintController.reply))
router.put('/supplier-complaints/:id/close', requirePerm({ permCode: 'quality:complaint:update' }), logOperation('关闭投诉'), asyncHandler(SupplierComplaintController.close))
router.get('/supplier-complaints/:id/pdf', requirePerm({ permCode: 'quality:complaint:supplier' }), asyncHandler(SupplierComplaintController.generatePdf))

// ============ 设备故障管理 ============
router.get('/device-faults', requirePerm({ permCode: 'all:device:fault:view' }), dataScope({ businessObj: 'device_fault' }), asyncHandler(DeviceFaultController.list))
router.get('/device-faults/stats', requirePerm({ permCode: 'all:device:fault:view' }), asyncHandler(DeviceFaultController.stats))
router.get('/device-faults/:id', requirePerm({ permCode: 'all:device:fault:view' }), asyncHandler(DeviceFaultController.detail))
router.post('/device-faults', requirePerm({ permCode: 'pc:device:fault:create' }), logOperation('设备故障上报'), asyncHandler(DeviceFaultController.create))
router.put('/device-faults/:id/assign', requirePerm({ permCode: 'pc:device:fault:assign' }), logOperation('故障派工'), asyncHandler(DeviceFaultController.assign))
router.put('/device-faults/:id/repair', requirePerm({ permCode: 'pc:device:fault:submit_repair' }), logOperation('提交维修'), asyncHandler(DeviceFaultController.submitRepair))
router.put('/device-faults/:id/approve', requirePerm({ permCode: 'pc:device:fault:approve' }), logOperation('故障审批'), asyncHandler(DeviceFaultController.approve))
router.put('/device-faults/:id/close', requirePerm({ permCode: 'pc:device:fault:close' }), logOperation('关闭故障'), asyncHandler(DeviceFaultController.close))
router.delete('/device-faults/:id', requirePerm({ permCode: 'pc:device:fault:delete' }), logOperation('删除故障'), asyncHandler(DeviceFaultController.delete))
router.get('/device-faults/:id/images', requirePerm({ permCode: 'all:device:fault:view' }), asyncHandler(DeviceFaultController.getImages))
router.post('/device-faults/:id/images', requirePerm({ permCode: 'pc:device:fault:upload_image' }), deviceFaultUploadMiddleware.array('files', 10), logOperation('上传故障图片'), asyncHandler(DeviceFaultController.uploadImage))
router.delete('/device-faults/:id/images/:imageId', requirePerm({ permCode: 'pc:device:fault:upload_image' }), logOperation('删除故障图片'), asyncHandler(DeviceFaultController.deleteImage))

// ============ 设备保养标准 ============
// ⚠️ batch-assign 必须放在 :id 之前，否则会被 :id 路由吞掉
router.get('/device-standards', requirePerm({ permCode: 'all:device:maintenance:view' }), asyncHandler(DeviceMaintenanceController.listStandards))
router.post('/device-standards', requirePerm({ permCode: 'pc:device:maintenance:create' }), logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.createStandard))
router.put('/device-standards/batch-assign', requirePerm({ permCode: 'pc:device:maintenance:assign' }), logOperation('批量分配人员'), asyncHandler(DeviceMaintenanceController.batchAssignStandards))
router.put('/device-standards/assign-daily-by-device', requirePerm({ permCode: 'pc:device:maintenance:assign' }), logOperation('批量分配日点检'), asyncHandler(DeviceMaintenanceController.batchAssignByDeviceDaily))
router.put('/device-standards/:id', requirePerm({ permCode: 'pc:device:maintenance:update' }), logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.updateStandard))
router.delete('/device-standards/:id', requirePerm({ permCode: 'pc:device:maintenance:delete' }), logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.deleteStandard))

// ============ 设备维护标准档案 ============
// 注意：available-devices 必须在 :deviceId 之前，避免被参数路由匹配
router.get('/device-maintenance-profiles', requirePerm({ permCode: 'all:device:maintenance:view' }), dataScope({ businessObj: 'device_maintenance_profile' }), asyncHandler(DeviceMaintenanceController.listProfiles))
router.get('/device-maintenance-profiles/available-devices', requirePerm({ permCode: 'all:device:maintenance:view' }), asyncHandler(DeviceMaintenanceController.listAvailableDevices))
router.get('/device-maintenance-profiles/:deviceId', requirePerm({ permCode: 'all:device:maintenance:view' }), asyncHandler(DeviceMaintenanceController.detailProfile))
router.post('/device-maintenance-profiles', requirePerm({ permCode: 'pc:device:maintenance:create' }), logOperation('维护标准档案'), asyncHandler(DeviceMaintenanceController.createProfile))
router.put('/device-maintenance-profiles/:deviceId/status', requirePerm({ permCode: 'pc:device:maintenance:update' }), logOperation('档案状态'), asyncHandler(DeviceMaintenanceController.updateProfileStatus))
router.delete('/device-maintenance-profiles/:deviceId', requirePerm({ permCode: 'pc:device:maintenance:delete' }), logOperation('维护标准档案'), asyncHandler(DeviceMaintenanceController.deleteProfile))

// ============ 设备保养执行记录 ============
router.post('/device-records/generate', requirePerm({ permCode: 'pc:device:maintenance:generate' }), logOperation('生成保养执行'), asyncHandler(DeviceMaintenanceController.generateRecords))
router.post('/device-records/cleanup-and-regenerate', requirePerm({ permCode: 'pc:device:maintenance:cleanup' }), logOperation('清理并重建保养计划'), asyncHandler(DeviceMaintenanceController.cleanupAndRegenerate))
router.get('/device-records/matrix', requirePerm({ permCode: 'all:device:maintenance:view' }), asyncHandler(DeviceMaintenanceController.getMatrix))
router.get('/device-records', requirePerm({ permCode: 'all:device:maintenance:view' }), dataScope({ businessObj: 'device_maintenance_record' }), asyncHandler(DeviceMaintenanceController.listRecords))
router.get('/device-records/daily-summary', requirePerm({ permCode: 'all:device:maintenance:view' }), asyncHandler(DeviceMaintenanceController.dailySummary))
router.get('/device-records/:id', requirePerm({ permCode: 'all:device:maintenance:view' }), asyncHandler(DeviceMaintenanceController.detailRecord))
router.put('/device-records/:id/start', requirePerm({ permCode: 'pc:device:maintenance:start' }), logOperation('开始保养'), asyncHandler(DeviceMaintenanceController.startRecord))
router.put('/device-records/:id/submit', requirePerm({ permCode: 'pc:device:maintenance:submit' }), deviceMaintenanceUploadMiddleware.array('files', 10), logOperation('提交保养'), asyncHandler(DeviceMaintenanceController.submitRecord))
router.post('/device-records/batch-submit', requirePerm({ permCode: 'pc:device:maintenance:batch_submit' }), logOperation('批量提交保养'), asyncHandler(DeviceMaintenanceController.batchSubmit))
router.put('/device-records/:id/skip', requirePerm({ permCode: 'pc:device:maintenance:skip' }), asyncHandler(DeviceMaintenanceController.skipRecord))
router.delete('/device-records/:id', requirePerm({ permCode: 'pc:device:maintenance:delete' }), logOperation('删除保养记录'), asyncHandler(DeviceMaintenanceController.deleteRecord))
router.get('/device-records/:id/images', requirePerm({ permCode: 'all:device:maintenance:view' }), asyncHandler(DeviceMaintenanceController.getImages))
router.post('/device-records/:id/images', requirePerm({ permCode: 'pc:device:maintenance:upload_image' }), deviceMaintenanceUploadMiddleware.array('files', 10), logOperation('上传保养图片'), asyncHandler(DeviceMaintenanceController.uploadImage))
router.delete('/device-records/:id/images/:imageId', requirePerm({ permCode: 'pc:device:maintenance:upload_image' }), logOperation('删除保养图片'), asyncHandler(DeviceMaintenanceController.deleteImage))

// ============ 设备运行时长 ============
router.post('/device-runtime-logs', requirePerm({ permCode: 'pc:device:maintenance:update' }), logOperation('录入运行时长'), asyncHandler(DeviceMaintenanceController.logRuntime))
router.get('/device-runtime-logs', requirePerm({ permCode: 'all:device:maintenance:view' }), asyncHandler(DeviceMaintenanceController.getRuntimeLog))

// ============ 设备备件管理 ============
router.get('/device-spare-parts', requirePerm({ permCode: 'all:device:spare-part:view' }), dataScope({ businessObj: 'device_spare_part' }), asyncHandler(DeviceSparePartController.list))
router.get('/device-spare-parts/low-stock/list', requirePerm({ permCode: 'all:device:spare-part:view' }), asyncHandler(DeviceSparePartController.getLowStock))
router.get('/device-spare-parts/:id', requirePerm({ permCode: 'all:device:spare-part:view' }), asyncHandler(DeviceSparePartController.detail))
router.post('/device-spare-parts', requirePerm({ permCode: 'pc:device:spare-part:create' }), logOperation('备件管理'), asyncHandler(DeviceSparePartController.create))
router.put('/device-spare-parts/:id', requirePerm({ permCode: 'pc:device:spare-part:update' }), logOperation('备件管理'), asyncHandler(DeviceSparePartController.update))
router.delete('/device-spare-parts/:id', requirePerm({ permCode: 'pc:device:spare-part:delete' }), logOperation('备件管理'), asyncHandler(DeviceSparePartController.delete))
router.post('/device-spare-parts/:id/stock-in', requirePerm({ permCode: 'pc:device:spare-part:stock_in' }), logOperation('备件入库'), asyncHandler(DeviceSparePartController.stockIn))
router.post('/device-spare-parts/:id/stock-out', requirePerm({ permCode: 'pc:device:spare-part:stock_out' }), logOperation('备件出库'), asyncHandler(DeviceSparePartController.stockOut))
router.post('/device-spare-parts/:id/adjust', requirePerm({ permCode: 'pc:device:spare-part:stock_adjust' }), logOperation('库存调整'), asyncHandler(DeviceSparePartController.stockAdjust))
router.get('/device-spare-part-logs', requirePerm({ permCode: 'all:device:spare-part:view' }), asyncHandler(DeviceSparePartController.listLogs))

// ============ 设备校准管理 ============
router.get('/device-calibration-plans', requirePerm({ permCode: 'all:device:calibration:view' }), dataScope({ businessObj: 'device_calibration_plan' }), asyncHandler(DeviceCalibrationController.listPlans))
router.get('/device-calibration-plans/expiring/list', requirePerm({ permCode: 'all:device:calibration:view' }), asyncHandler(DeviceCalibrationController.getExpiringSoon))
router.get('/device-calibration-plans/overdue/list', requirePerm({ permCode: 'all:device:calibration:view' }), asyncHandler(DeviceCalibrationController.getOverdue))
router.get('/device-calibration-plans/:id', requirePerm({ permCode: 'all:device:calibration:view' }), asyncHandler(DeviceCalibrationController.detailPlan))
router.post('/device-calibration-plans', requirePerm({ permCode: 'pc:device:calibration:create_plan' }), logOperation('校准计划'), asyncHandler(DeviceCalibrationController.createPlan))
router.put('/device-calibration-plans/:id', requirePerm({ permCode: 'pc:device:calibration:update_plan' }), logOperation('校准计划'), asyncHandler(DeviceCalibrationController.updatePlan))
router.delete('/device-calibration-plans/:id', requirePerm({ permCode: 'pc:device:calibration:delete_plan' }), logOperation('校准计划'), asyncHandler(DeviceCalibrationController.deletePlan))
router.put('/device-calibration-plans/:id/submit', requirePerm({ permCode: 'pc:device:calibration:submit' }), logOperation('提交校准'), asyncHandler(DeviceCalibrationController.submitCalibration))
router.post('/device-calibration-plans/:id/certificate', requirePerm({ permCode: 'pc:device:calibration:upload_certificate' }), calibrationUploadMiddleware.array('images', 10), logOperation('上传证书'), asyncHandler(DeviceCalibrationController.uploadCertificate))
router.get('/device-calibration-records', requirePerm({ permCode: 'all:device:calibration:view' }), dataScope({ businessObj: 'device_calibration_record' }), asyncHandler(DeviceCalibrationController.listRecords))

// ============ 设备电子档案管理 ============
router.get('/device-documents', requirePerm({ permCode: 'all:device:document:view' }), dataScope({ businessObj: 'device_document' }), asyncHandler(DeviceDocumentController.list))
router.get('/device-documents/by-device/:deviceId', requirePerm({ permCode: 'all:device:document:view' }), asyncHandler(DeviceDocumentController.listByDevice))
router.get('/device-documents/:id/download', requirePerm({ permCode: 'all:device:document:view' }), asyncHandler(DeviceDocumentController.download))
router.get('/device-documents/:id', requirePerm({ permCode: 'all:device:document:view' }), asyncHandler(DeviceDocumentController.detail))
router.post('/device-documents', requirePerm({ permCode: 'pc:device:document:create' }), deviceDocumentUploadMiddleware.array('files', 10), logOperation('上传设备文档'), asyncHandler(DeviceDocumentController.upload))
router.put('/device-documents/:id', requirePerm({ permCode: 'pc:device:document:update' }), logOperation('更新设备文档'), asyncHandler(DeviceDocumentController.update))
router.delete('/device-documents/:id', requirePerm({ permCode: 'pc:device:document:delete' }), logOperation('删除设备文档'), asyncHandler(DeviceDocumentController.delete))

export default router
