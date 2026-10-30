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
import { authRequired, logOperation, permissionRequired } from '../middleware/auth.js'

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
router.get('/materials', permissionRequired('basic:material'), asyncHandler(list))
router.get('/materials/:id', permissionRequired('basic:material'), asyncHandler(detail))
router.post('/materials', permissionRequired('basic:material:create'), asyncHandler(create))
router.put('/materials/:id', permissionRequired('basic:material:update'), asyncHandler(update))
router.delete('/materials/:id', permissionRequired('basic:material:delete'), asyncHandler(remove))

// ============ 产线 ============
router.get('/production-lines', permissionRequired('basic:line'), asyncHandler(lineList))
router.get('/production-lines/:id', permissionRequired('basic:line'), asyncHandler(lineDetail))
router.post('/production-lines', permissionRequired('basic:line:create'), asyncHandler(lineCreate))
router.put('/production-lines/:id', permissionRequired('basic:line:update'), asyncHandler(lineUpdate))
router.delete('/production-lines/:id', permissionRequired('basic:line:delete'), asyncHandler(lineRemove))

// ============ 产线-工序关联 ============
router.get('/production-lines/:id/processes', permissionRequired('basic:line'), asyncHandler(getLineProcesses))
router.post('/production-lines/:id/processes', permissionRequired('basic:line:update'), asyncHandler(addLineProcess))
router.delete('/production-lines/:id/processes/:processId', permissionRequired('basic:line:update'), asyncHandler(removeLineProcess))
router.put('/production-lines/:id/processes/sort', permissionRequired('basic:line:update'), asyncHandler(updateLineProcessSort))

// ============ 产线-设备关联 ============
router.get('/production-lines/:id/devices', permissionRequired('basic:line'), asyncHandler(getLineDevices))
router.post('/production-lines/:id/devices', permissionRequired('basic:line:update'), asyncHandler(addLineDevice))
router.delete('/production-lines/:id/devices/:deviceId', permissionRequired('basic:line:update'), asyncHandler(removeLineDevice))
router.put('/production-lines/:id/devices/sort', permissionRequired('basic:line:update'), asyncHandler(updateLineDeviceSort))

// ============ 工序 ============
router.get('/processes', permissionRequired('basic:process'), asyncHandler(processList))
router.get('/processes/:id', permissionRequired('basic:process'), asyncHandler(processDetail))
router.post('/processes', permissionRequired('basic:process:create'), asyncHandler(processCreate))
router.put('/processes/:id', permissionRequired('basic:process:update'), asyncHandler(processUpdate))
router.delete('/processes/:id', permissionRequired('basic:process:delete'), asyncHandler(processRemove))

// ============ 设备 ============
router.get('/devices', permissionRequired('device:list'), asyncHandler(deviceList))
router.get('/devices/:id', permissionRequired('device:list'), asyncHandler(deviceDetail))
router.post('/devices', permissionRequired('device:list:create'), asyncHandler(deviceCreate))
router.put('/devices/:id', permissionRequired('device:list:update'), asyncHandler(deviceUpdate))
router.delete('/devices/:id', permissionRequired('device:list:delete'), asyncHandler(deviceRemove))

// ============ 不良分类 ============
router.get('/defect-types', permissionRequired('basic:defect'), asyncHandler(defectList))
router.get('/defect-types/next-code', permissionRequired('basic:defect'), asyncHandler(defectNextCode))
router.get('/defect-types/:id', permissionRequired('basic:defect'), asyncHandler(defectDetail))
router.post('/defect-types', permissionRequired('basic:defect:create'), asyncHandler(defectCreate))
router.put('/defect-types/:id', permissionRequired('basic:defect:update'), asyncHandler(defectUpdate))
router.delete('/defect-types/:id', permissionRequired('basic:defect:delete'), asyncHandler(defectRemove))

// ============ 不良图片 ============
router.get('/defect-types/:id/images', permissionRequired('basic:defect'), asyncHandler(defectImageList))
router.post('/defect-types/:id/images', permissionRequired('basic:defect:update'), defectUploadMiddleware.array('images', 10), asyncHandler(defectImageUpload))
router.delete('/defect-types/:id/images/:imageId', permissionRequired('basic:defect:update'), asyncHandler(defectImageDelete))

// ============ 客户档案 ============
router.get('/customers', permissionRequired('basic:customer'), asyncHandler(customerList))
router.get('/customers/:id', permissionRequired('basic:customer'), asyncHandler(customerDetail))
router.post('/customers', permissionRequired('basic:customer:create'), asyncHandler(customerCreate))
router.put('/customers/:id', permissionRequired('basic:customer:update'), asyncHandler(customerUpdate))
router.delete('/customers/:id', permissionRequired('basic:customer:delete'), asyncHandler(customerRemove))

// ============ 供应商档案 ============
router.get('/suppliers', permissionRequired('basic:supplier'), asyncHandler(SupplierController.list))
router.get('/suppliers/:id', permissionRequired('basic:supplier'), asyncHandler(SupplierController.detail))
router.post('/suppliers', permissionRequired('basic:supplier:create'), logOperation('供应商档案'), asyncHandler(SupplierController.create))
router.put('/suppliers/:id', permissionRequired('basic:supplier:update'), logOperation('供应商档案'), asyncHandler(SupplierController.update))
router.delete('/suppliers/:id', permissionRequired('basic:supplier:delete'), logOperation('供应商档案'), asyncHandler(SupplierController.remove))
router.post('/suppliers/seed', permissionRequired('basic:supplier:create'), asyncHandler(SupplierController.seed))

// ============ 编号规则（编码管理） ============
router.get('/number-rules', permissionRequired('basic:number-rule'), asyncHandler(ruleList))
router.get('/number-rules/:id', permissionRequired('basic:number-rule'), asyncHandler(ruleDetail))
router.post('/number-rules', permissionRequired('basic:number-rule:create'), logOperation('编码管理'), asyncHandler(ruleCreate))
router.put('/number-rules/:id', permissionRequired('basic:number-rule:update'), logOperation('编码管理'), asyncHandler(ruleUpdate))
router.delete('/number-rules/:id', permissionRequired('basic:number-rule:delete'), logOperation('编码管理'), asyncHandler(ruleRemove))
router.post('/number-rules/:id/toggle', permissionRequired('basic:number-rule:update'), logOperation('编码管理'), asyncHandler(ruleToggle))
router.post('/number-rules/:id/audit', permissionRequired('basic:number-rule:audit'), logOperation('编码管理'), asyncHandler(ruleAudit))
router.get('/number-rules/:id/preview', permissionRequired('basic:number-rule'), asyncHandler(rulePreview))

// ============ 产品检测 ============
router.get('/product-inspections', permissionRequired('quality:product'), asyncHandler(ProductInspectionController.list))
router.get('/product-inspections/:id', permissionRequired('quality:product'), asyncHandler(ProductInspectionController.detail))
router.post('/product-inspections', permissionRequired('quality:product:create'), logOperation('产品检测'), asyncHandler(ProductInspectionController.create))
router.put('/product-inspections/:id', permissionRequired('quality:product:update'), logOperation('产品检测'), asyncHandler(ProductInspectionController.update))
router.put('/product-inspections/:id/submit', permissionRequired('quality:product:update'), logOperation('产品检测报审'), asyncHandler(ProductInspectionController.submit))
router.put('/product-inspections/:id/start', permissionRequired('quality:product:update'), logOperation('产品检测开检'), asyncHandler(ProductInspectionController.start))
router.put('/product-inspections/:id/review', permissionRequired('quality:product:update'), logOperation('产品检测审核'), asyncHandler(ProductInspectionController.review))
router.delete('/product-inspections/:id', permissionRequired('quality:product:delete'), logOperation('产品检测'), asyncHandler(ProductInspectionController.delete))

// ============ 来料检验 ============
router.get('/incoming-inspections', permissionRequired('quality:incoming'), asyncHandler(IncomingInspectionController.list))
router.post('/incoming-inspections/sync-purchase-receipts', permissionRequired('quality:incoming:create'), logOperation('采购入库同步'), asyncHandler(IncomingInspectionController.syncFromPurchaseReceipts))
router.get('/incoming-inspections/:id', permissionRequired('quality:incoming'), asyncHandler(IncomingInspectionController.detail))
router.post('/incoming-inspections', permissionRequired('quality:incoming:create'), logOperation('来料检验'), asyncHandler(IncomingInspectionController.create))
router.put('/incoming-inspections/:id', permissionRequired('quality:incoming:update'), logOperation('来料检验'), asyncHandler(IncomingInspectionController.update))
router.put('/incoming-inspections/:id/submit', permissionRequired('quality:incoming:update'), logOperation('来料检验报审'), asyncHandler(IncomingInspectionController.submit))
router.put('/incoming-inspections/:id/start', permissionRequired('quality:incoming:update'), logOperation('来料检验开检'), asyncHandler(IncomingInspectionController.start))
router.put('/incoming-inspections/:id/review', permissionRequired('quality:incoming:update'), logOperation('来料检验审核'), asyncHandler(IncomingInspectionController.review))
router.delete('/incoming-inspections/:id', permissionRequired('quality:incoming:delete'), logOperation('来料检验'), asyncHandler(IncomingInspectionController.delete))

// ============ 过程检验（移动端优先，简化版：在制品列表 + 一步提交） ============
router.get('/process-inspections/wip', permissionRequired('quality:process'), asyncHandler(ProcessInspectionController.listWip))
router.get('/process-inspections', permissionRequired('quality:process'), asyncHandler(ProcessInspectionController.list))
router.get('/process-inspections/:id', permissionRequired('quality:process'), asyncHandler(ProcessInspectionController.detail))
router.post('/process-inspections', permissionRequired('quality:process:create'), logOperation('过程检验'), asyncHandler(ProcessInspectionController.create))
router.post('/process-inspections/submit', permissionRequired('quality:process:update'), logOperation('过程检验提交'), asyncHandler(ProcessInspectionController.submit))
router.put('/process-inspections/:id', permissionRequired('quality:process:update'), logOperation('过程检验'), asyncHandler(ProcessInspectionController.update))
router.delete('/process-inspections/:id', permissionRequired('quality:process:delete'), logOperation('过程检验'), asyncHandler(ProcessInspectionController.delete))

// ============ 检验标准 ============
router.get('/standards', permissionRequired('quality:standard'), asyncHandler(InspectionStandardController.list))
router.get('/standards/generate/no', permissionRequired('quality:standard'), asyncHandler(InspectionStandardController.generateNo))
router.get('/standards/:id', permissionRequired('quality:standard'), asyncHandler(InspectionStandardController.detail))
router.post('/standards', permissionRequired('quality:standard:create'), logOperation('检验标准'), asyncHandler(InspectionStandardController.create))
router.put('/standards/:id', permissionRequired('quality:standard:update'), logOperation('检验标准'), asyncHandler(InspectionStandardController.update))
router.delete('/standards/:id', permissionRequired('quality:standard:delete'), logOperation('检验标准'), asyncHandler(InspectionStandardController.remove))
router.post('/standards/:id/copy', permissionRequired('quality:standard:copy'), logOperation('检验标准'), asyncHandler(InspectionStandardController.copy))
router.post('/standards/:id/revise', permissionRequired('quality:standard:revise'), logOperation('检验标准'), asyncHandler(InspectionStandardController.revise))
router.get('/standards/:standardId/items', permissionRequired('quality:standard'), asyncHandler(InspectionStandardController.listItems))

// ============ 微生物检验 ============
router.get('/microbe-inspections', permissionRequired('quality:microbe'), asyncHandler(MicrobeInspectionController.list))
router.get('/microbe-inspections/:id', permissionRequired('quality:microbe'), asyncHandler(MicrobeInspectionController.detail))
router.post('/microbe-inspections', permissionRequired('quality:microbe:create'), logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.create))
router.put('/microbe-inspections/:id', permissionRequired('quality:microbe:update'), logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.update))
router.delete('/microbe-inspections/:id', permissionRequired('quality:microbe:delete'), logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.delete))

// ============ 环境检验 ============
router.get('/env-inspections', permissionRequired('quality:environment'), asyncHandler(EnvInspectionController.list))
router.get('/env-inspections/:id', permissionRequired('quality:environment'), asyncHandler(EnvInspectionController.detail))
router.post('/env-inspections', permissionRequired('quality:environment:create'), logOperation('环境检验'), asyncHandler(EnvInspectionController.create))
router.put('/env-inspections/:id', permissionRequired('quality:environment:update'), logOperation('环境检验'), asyncHandler(EnvInspectionController.update))
router.delete('/env-inspections/:id', permissionRequired('quality:environment:delete'), logOperation('环境检验'), asyncHandler(EnvInspectionController.delete))

// ============ 环境检验区域 ============
router.get('/env-areas', permissionRequired('quality:environment'), asyncHandler(EnvInspectionController.listAreas))
router.post('/env-areas', permissionRequired('quality:environment:create'), logOperation('环境区域'), asyncHandler(EnvInspectionController.createArea))
router.put('/env-areas/:id', permissionRequired('quality:environment:update'), logOperation('环境区域'), asyncHandler(EnvInspectionController.updateArea))
router.delete('/env-areas/:id', permissionRequired('quality:environment:delete'), logOperation('环境区域'), asyncHandler(EnvInspectionController.deleteArea))

// ============ 环境检验模板 ============
router.get('/env-templates', permissionRequired('quality:environment'), asyncHandler(EnvInspectionController.listTemplates))
router.post('/env-templates', permissionRequired('quality:environment:create'), logOperation('环境模板'), asyncHandler(EnvInspectionController.createTemplate))
router.put('/env-templates/:id', permissionRequired('quality:environment:update'), logOperation('环境模板'), asyncHandler(EnvInspectionController.updateTemplate))
router.delete('/env-templates/:id', permissionRequired('quality:environment:delete'), logOperation('环境模板'), asyncHandler(EnvInspectionController.deleteTemplate))
router.get('/env-templates/area/:areaId', permissionRequired('quality:environment'), asyncHandler(EnvInspectionController.getTemplatesByArea))

// ============ 检测仪器 ============
router.get('/instruments', permissionRequired('quality:instrument'), asyncHandler(instrumentList))
router.get('/instruments/:id', permissionRequired('quality:instrument'), asyncHandler(instrumentDetail))
router.post('/instruments', permissionRequired('quality:instrument:create'), logOperation('检测仪器'), asyncHandler(instrumentCreate))
router.put('/instruments/:id', permissionRequired('quality:instrument:update'), logOperation('检测仪器'), asyncHandler(instrumentUpdate))
router.delete('/instruments/:id', permissionRequired('quality:instrument:delete'), logOperation('检测仪器'), asyncHandler(instrumentRemove))

// ============ 客诉管理 ============
router.get('/complaints', permissionRequired('quality:complaint'), asyncHandler(ComplaintController.list))
router.get('/complaints/:id', permissionRequired('quality:complaint'), asyncHandler(ComplaintController.detail))
router.post('/complaints', permissionRequired('quality:complaint:create'), logOperation('客诉管理'), asyncHandler(ComplaintController.create))
router.put('/complaints/:id', permissionRequired('quality:complaint:update'), logOperation('客诉管理'), asyncHandler(ComplaintController.update))
router.delete('/complaints/:id', permissionRequired('quality:complaint:delete'), logOperation('客诉管理'), asyncHandler(ComplaintController.delete))
router.post('/complaints/:id/records', permissionRequired('quality:complaint:update'), logOperation('客诉记录'), asyncHandler(ComplaintController.addRecord))
router.post('/complaints/:id/attachments', permissionRequired('quality:complaint:update'), complaintAttachmentUploadMiddleware.array('files', 10), logOperation('上传客诉附件'), asyncHandler(ComplaintController.uploadAttachment))
router.put('/complaints/:id/close', permissionRequired('quality:complaint:update'), logOperation('关闭客诉'), asyncHandler(ComplaintController.close))

// ============ 供应商投诉 ============
router.get('/supplier-complaints', permissionRequired('quality:complaint:supplier'), asyncHandler(SupplierComplaintController.list))
router.get('/supplier-complaints/:id', permissionRequired('quality:complaint:supplier'), asyncHandler(SupplierComplaintController.detail))
router.post('/supplier-complaints', permissionRequired('quality:complaint:create'), logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.create))
router.put('/supplier-complaints/:id', permissionRequired('quality:complaint:update'), logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.update))
router.delete('/supplier-complaints/:id', permissionRequired('quality:complaint:delete'), logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.delete))
router.put('/supplier-complaints/:id/issue', permissionRequired('quality:complaint:update'), logOperation('发出投诉'), asyncHandler(SupplierComplaintController.issue))
router.put('/supplier-complaints/:id/reply', permissionRequired('quality:complaint:update'), logOperation('供应商回复'), asyncHandler(SupplierComplaintController.reply))
router.put('/supplier-complaints/:id/close', permissionRequired('quality:complaint:update'), logOperation('关闭投诉'), asyncHandler(SupplierComplaintController.close))
router.get('/supplier-complaints/:id/pdf', permissionRequired('quality:complaint:supplier'), asyncHandler(SupplierComplaintController.generatePdf))

// ============ 设备故障管理 ============
router.get('/device-faults', permissionRequired('device:fault'), asyncHandler(DeviceFaultController.list))
router.get('/device-faults/:id', permissionRequired('device:fault'), asyncHandler(DeviceFaultController.detail))
router.post('/device-faults', permissionRequired('device:fault:create'), logOperation('设备故障上报'), asyncHandler(DeviceFaultController.create))
router.put('/device-faults/:id/assign', permissionRequired('device:fault:update'), logOperation('故障派工'), asyncHandler(DeviceFaultController.assign))
router.put('/device-faults/:id/repair', permissionRequired('device:fault:update'), logOperation('提交维修'), asyncHandler(DeviceFaultController.submitRepair))
router.put('/device-faults/:id/approve', permissionRequired('device:fault:update'), logOperation('故障审批'), asyncHandler(DeviceFaultController.approve))
router.put('/device-faults/:id/close', permissionRequired('device:fault:update'), logOperation('关闭故障'), asyncHandler(DeviceFaultController.close))
router.delete('/device-faults/:id', permissionRequired('device:fault:delete'), logOperation('删除故障'), asyncHandler(DeviceFaultController.delete))
router.get('/device-faults/:id/images', permissionRequired('device:fault'), asyncHandler(DeviceFaultController.getImages))
router.post('/device-faults/:id/images', permissionRequired('device:fault:update'), deviceFaultUploadMiddleware.array('files', 10), logOperation('上传故障图片'), asyncHandler(DeviceFaultController.uploadImage))

// ============ 设备保养标准 ============
router.get('/device-standards', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.listStandards))
router.post('/device-standards', permissionRequired('device:maintenance:create'), logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.createStandard))
router.put('/device-standards/:id', permissionRequired('device:maintenance:update'), logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.updateStandard))
router.delete('/device-standards/:id', permissionRequired('device:maintenance:delete'), logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.deleteStandard))

// ============ 设备维护标准档案 ============
// 注意：available-devices 必须在 :deviceId 之前，避免被参数路由匹配
router.get('/device-maintenance-profiles', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.listProfiles))
router.get('/device-maintenance-profiles/available-devices', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.listAvailableDevices))
router.get('/device-maintenance-profiles/:deviceId', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.detailProfile))
router.post('/device-maintenance-profiles', permissionRequired('device:maintenance:create'), logOperation('维护标准档案'), asyncHandler(DeviceMaintenanceController.createProfile))
router.put('/device-maintenance-profiles/:deviceId/status', permissionRequired('device:maintenance:update'), logOperation('档案状态'), asyncHandler(DeviceMaintenanceController.updateProfileStatus))
router.delete('/device-maintenance-profiles/:deviceId', permissionRequired('device:maintenance:delete'), logOperation('维护标准档案'), asyncHandler(DeviceMaintenanceController.deleteProfile))

// ============ 设备保养执行记录 ============
router.post('/device-records/generate', permissionRequired('device:maintenance:create'), logOperation('生成保养执行'), asyncHandler(DeviceMaintenanceController.generateRecords))
router.get('/device-records/matrix', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.getMatrix))
router.get('/device-records', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.listRecords))
router.get('/device-records/daily-summary', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.dailySummary))
router.get('/device-records/:id', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.detailRecord))
router.put('/device-records/:id/start', permissionRequired('device:maintenance:update'), logOperation('开始保养'), asyncHandler(DeviceMaintenanceController.startRecord))
router.put('/device-records/:id/submit', permissionRequired('device:maintenance:update'), deviceMaintenanceUploadMiddleware.array('files', 10), logOperation('提交保养'), asyncHandler(DeviceMaintenanceController.submitRecord))
router.post('/device-records/batch-submit', permissionRequired('device:maintenance:update'), logOperation('批量提交保养'), asyncHandler(DeviceMaintenanceController.batchSubmit))
router.put('/device-records/:id/skip', permissionRequired('device:maintenance:update'), asyncHandler(DeviceMaintenanceController.skipRecord))
router.delete('/device-records/:id', permissionRequired('device:maintenance:delete'), logOperation('删除保养记录'), asyncHandler(DeviceMaintenanceController.deleteRecord))
router.get('/device-records/:id/images', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.getImages))
router.post('/device-records/:id/images', permissionRequired('device:maintenance:update'), deviceMaintenanceUploadMiddleware.array('files', 10), logOperation('上传保养图片'), asyncHandler(DeviceMaintenanceController.uploadImage))

// ============ 设备运行时长 ============
router.post('/device-runtime-logs', permissionRequired('device:maintenance:update'), logOperation('录入运行时长'), asyncHandler(DeviceMaintenanceController.logRuntime))
router.get('/device-runtime-logs', permissionRequired('device:maintenance'), asyncHandler(DeviceMaintenanceController.getRuntimeLog))

// ============ 设备备件管理 ============
router.get('/device-spare-parts', permissionRequired('device:spare-part'), asyncHandler(DeviceSparePartController.list))
router.get('/device-spare-parts/low-stock/list', permissionRequired('device:spare-part'), asyncHandler(DeviceSparePartController.getLowStock))
router.get('/device-spare-parts/:id', permissionRequired('device:spare-part'), asyncHandler(DeviceSparePartController.detail))
router.post('/device-spare-parts', permissionRequired('device:spare-part:create'), logOperation('备件管理'), asyncHandler(DeviceSparePartController.create))
router.put('/device-spare-parts/:id', permissionRequired('device:spare-part:update'), logOperation('备件管理'), asyncHandler(DeviceSparePartController.update))
router.delete('/device-spare-parts/:id', permissionRequired('device:spare-part:delete'), logOperation('备件管理'), asyncHandler(DeviceSparePartController.delete))
router.post('/device-spare-parts/:id/stock-in', permissionRequired('device:spare-part:update'), logOperation('备件入库'), asyncHandler(DeviceSparePartController.stockIn))
router.post('/device-spare-parts/:id/stock-out', permissionRequired('device:spare-part:update'), logOperation('备件出库'), asyncHandler(DeviceSparePartController.stockOut))
router.post('/device-spare-parts/:id/adjust', permissionRequired('device:spare-part:update'), logOperation('库存调整'), asyncHandler(DeviceSparePartController.stockAdjust))
router.get('/device-spare-part-logs', permissionRequired('device:spare-part'), asyncHandler(DeviceSparePartController.listLogs))

// ============ 设备校准管理 ============
router.get('/device-calibration-plans', permissionRequired('device:calibration'), asyncHandler(DeviceCalibrationController.listPlans))
router.get('/device-calibration-plans/expiring/list', permissionRequired('device:calibration'), asyncHandler(DeviceCalibrationController.getExpiringSoon))
router.get('/device-calibration-plans/overdue/list', permissionRequired('device:calibration'), asyncHandler(DeviceCalibrationController.getOverdue))
router.get('/device-calibration-plans/:id', permissionRequired('device:calibration'), asyncHandler(DeviceCalibrationController.detailPlan))
router.post('/device-calibration-plans', permissionRequired('device:calibration:create'), logOperation('校准计划'), asyncHandler(DeviceCalibrationController.createPlan))
router.put('/device-calibration-plans/:id', permissionRequired('device:calibration:update'), logOperation('校准计划'), asyncHandler(DeviceCalibrationController.updatePlan))
router.delete('/device-calibration-plans/:id', permissionRequired('device:calibration:delete'), logOperation('校准计划'), asyncHandler(DeviceCalibrationController.deletePlan))
router.put('/device-calibration-plans/:id/submit', permissionRequired('device:calibration:update'), logOperation('提交校准'), asyncHandler(DeviceCalibrationController.submitCalibration))
router.post('/device-calibration-plans/:id/certificate', permissionRequired('device:calibration:update'), calibrationUploadMiddleware.array('images', 10), logOperation('上传证书'), asyncHandler(DeviceCalibrationController.uploadCertificate))
router.get('/device-calibration-records', permissionRequired('device:calibration'), asyncHandler(DeviceCalibrationController.listRecords))

// ============ 设备电子档案管理 ============
router.get('/device-documents', permissionRequired('device:document'), asyncHandler(DeviceDocumentController.list))
router.get('/device-documents/by-device/:deviceId', permissionRequired('device:document'), asyncHandler(DeviceDocumentController.listByDevice))
router.get('/device-documents/:id/download', permissionRequired('device:document'), asyncHandler(DeviceDocumentController.download))
router.get('/device-documents/:id', permissionRequired('device:document'), asyncHandler(DeviceDocumentController.detail))
router.post('/device-documents', permissionRequired('device:document:create'), deviceDocumentUploadMiddleware.array('files', 10), logOperation('上传设备文档'), asyncHandler(DeviceDocumentController.upload))
router.put('/device-documents/:id', permissionRequired('device:document:update'), logOperation('更新设备文档'), asyncHandler(DeviceDocumentController.update))
router.delete('/device-documents/:id', permissionRequired('device:document:delete'), logOperation('删除设备文档'), asyncHandler(DeviceDocumentController.delete))

export default router
