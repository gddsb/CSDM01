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

// 料品档案
router.get('/materials', asyncHandler(list))
router.get('/materials/:id', asyncHandler(detail))
router.post('/materials', asyncHandler(create))
router.put('/materials/:id', asyncHandler(update))
router.delete('/materials/:id', asyncHandler(remove))

// 产线
router.get('/production-lines', asyncHandler(lineList))
router.get('/production-lines/:id', asyncHandler(lineDetail))
router.post('/production-lines', asyncHandler(lineCreate))
router.put('/production-lines/:id', asyncHandler(lineUpdate))
router.delete('/production-lines/:id', asyncHandler(lineRemove))

// 产线-工序关联
router.get('/production-lines/:id/processes', asyncHandler(getLineProcesses))
router.post('/production-lines/:id/processes', asyncHandler(addLineProcess))
router.delete('/production-lines/:id/processes/:processId', asyncHandler(removeLineProcess))
router.put('/production-lines/:id/processes/sort', asyncHandler(updateLineProcessSort))

// 产线-设备关联
router.get('/production-lines/:id/devices', asyncHandler(getLineDevices))
router.post('/production-lines/:id/devices', asyncHandler(addLineDevice))
router.delete('/production-lines/:id/devices/:deviceId', asyncHandler(removeLineDevice))
router.put('/production-lines/:id/devices/sort', asyncHandler(updateLineDeviceSort))

// 工序
router.get('/processes', asyncHandler(processList))
router.get('/processes/:id', asyncHandler(processDetail))
router.post('/processes', asyncHandler(processCreate))
router.put('/processes/:id', asyncHandler(processUpdate))
router.delete('/processes/:id', asyncHandler(processRemove))

// 设备
router.get('/devices', asyncHandler(deviceList))
router.get('/devices/:id', asyncHandler(deviceDetail))
router.post('/devices', asyncHandler(deviceCreate))
router.put('/devices/:id', asyncHandler(deviceUpdate))
router.delete('/devices/:id', asyncHandler(deviceRemove))

// 不良分类
router.get('/defect-types', asyncHandler(defectList))
router.get('/defect-types/next-code', asyncHandler(defectNextCode))
router.get('/defect-types/:id', asyncHandler(defectDetail))
router.post('/defect-types', asyncHandler(defectCreate))
router.put('/defect-types/:id', asyncHandler(defectUpdate))
router.delete('/defect-types/:id', asyncHandler(defectRemove))

// 不良图片
router.get('/defect-types/:id/images', asyncHandler(defectImageList))
router.post('/defect-types/:id/images', defectUploadMiddleware.array('images', 10), asyncHandler(defectImageUpload))
router.delete('/defect-types/:id/images/:imageId', asyncHandler(defectImageDelete))

// 客户档案
router.get('/customers', asyncHandler(customerList))
router.get('/customers/:id', asyncHandler(customerDetail))
router.post('/customers', asyncHandler(customerCreate))
router.put('/customers/:id', asyncHandler(customerUpdate))
router.delete('/customers/:id', asyncHandler(customerRemove))

// 供应商档案
router.get('/suppliers', asyncHandler(SupplierController.list))
router.get('/suppliers/:id', asyncHandler(SupplierController.detail))
router.post('/suppliers', logOperation('供应商档案'), asyncHandler(SupplierController.create))
router.put('/suppliers/:id', logOperation('供应商档案'), asyncHandler(SupplierController.update))
router.delete('/suppliers/:id', logOperation('供应商档案'), asyncHandler(SupplierController.remove))
router.post('/suppliers/seed', asyncHandler(SupplierController.seed))

// 编号规则（编码管理）
router.get('/number-rules', asyncHandler(ruleList))
router.get('/number-rules/:id', asyncHandler(ruleDetail))
router.post('/number-rules', logOperation('编码管理'), asyncHandler(ruleCreate))
router.put('/number-rules/:id', logOperation('编码管理'), asyncHandler(ruleUpdate))
router.delete('/number-rules/:id', logOperation('编码管理'), asyncHandler(ruleRemove))
router.post('/number-rules/:id/toggle', logOperation('编码管理'), asyncHandler(ruleToggle))
router.post('/number-rules/:id/audit', logOperation('编码管理'), asyncHandler(ruleAudit))
router.get('/number-rules/:id/preview', asyncHandler(rulePreview))

// 产品检测
router.get('/product-inspections', asyncHandler(ProductInspectionController.list))
router.get('/product-inspections/:id', asyncHandler(ProductInspectionController.detail))
router.post('/product-inspections', logOperation('产品检测'), asyncHandler(ProductInspectionController.create))
router.put('/product-inspections/:id', logOperation('产品检测'), asyncHandler(ProductInspectionController.update))
router.put('/product-inspections/:id/submit', logOperation('产品检测报审'), asyncHandler(ProductInspectionController.submit))
router.put('/product-inspections/:id/start', logOperation('产品检测开检'), asyncHandler(ProductInspectionController.start))
router.put('/product-inspections/:id/review', logOperation('产品检测审核'), asyncHandler(ProductInspectionController.review))
router.delete('/product-inspections/:id', logOperation('产品检测'), asyncHandler(ProductInspectionController.delete))

// 来料检验
router.get('/incoming-inspections', asyncHandler(IncomingInspectionController.list))
router.post('/incoming-inspections/sync-purchase-receipts', logOperation('采购入库同步'), asyncHandler(IncomingInspectionController.syncFromPurchaseReceipts))
router.get('/incoming-inspections/:id', asyncHandler(IncomingInspectionController.detail))
router.post('/incoming-inspections', logOperation('来料检验'), asyncHandler(IncomingInspectionController.create))
router.put('/incoming-inspections/:id', logOperation('来料检验'), asyncHandler(IncomingInspectionController.update))
router.put('/incoming-inspections/:id/submit', logOperation('来料检验报审'), asyncHandler(IncomingInspectionController.submit))
router.put('/incoming-inspections/:id/start', logOperation('来料检验开检'), asyncHandler(IncomingInspectionController.start))
router.put('/incoming-inspections/:id/review', logOperation('来料检验审核'), asyncHandler(IncomingInspectionController.review))
router.delete('/incoming-inspections/:id', logOperation('来料检验'), asyncHandler(IncomingInspectionController.delete))

// 检验标准
router.get('/standards', asyncHandler(InspectionStandardController.list))
router.get('/standards/generate/no', asyncHandler(InspectionStandardController.generateNo))
router.get('/standards/:id', asyncHandler(InspectionStandardController.detail))
router.post('/standards', logOperation('检验标准'), asyncHandler(InspectionStandardController.create))
router.put('/standards/:id', logOperation('检验标准'), asyncHandler(InspectionStandardController.update))
router.delete('/standards/:id', logOperation('检验标准'), asyncHandler(InspectionStandardController.remove))
router.post('/standards/:id/copy', logOperation('检验标准'), asyncHandler(InspectionStandardController.copy))
router.post('/standards/:id/revise', logOperation('检验标准'), asyncHandler(InspectionStandardController.revise))
router.get('/standards/:standardId/items', asyncHandler(InspectionStandardController.listItems))

// 微生物检验
router.get('/microbe-inspections', asyncHandler(MicrobeInspectionController.list))
router.get('/microbe-inspections/:id', asyncHandler(MicrobeInspectionController.detail))
router.post('/microbe-inspections', logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.create))
router.put('/microbe-inspections/:id', logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.update))
router.delete('/microbe-inspections/:id', logOperation('微生物检验'), asyncHandler(MicrobeInspectionController.delete))

// 环境检验路由
router.get('/env-inspections', asyncHandler(EnvInspectionController.list))
router.get('/env-inspections/:id', asyncHandler(EnvInspectionController.detail))
router.post('/env-inspections', logOperation('环境检验'), asyncHandler(EnvInspectionController.create))
router.put('/env-inspections/:id', logOperation('环境检验'), asyncHandler(EnvInspectionController.update))
router.delete('/env-inspections/:id', logOperation('环境检验'), asyncHandler(EnvInspectionController.delete))
// 环境检验区域
router.get('/env-areas', asyncHandler(EnvInspectionController.listAreas))
router.post('/env-areas', logOperation('环境区域'), asyncHandler(EnvInspectionController.createArea))
router.put('/env-areas/:id', logOperation('环境区域'), asyncHandler(EnvInspectionController.updateArea))
router.delete('/env-areas/:id', logOperation('环境区域'), asyncHandler(EnvInspectionController.deleteArea))
// 环境检验模板
router.get('/env-templates', asyncHandler(EnvInspectionController.listTemplates))
router.post('/env-templates', logOperation('环境模板'), asyncHandler(EnvInspectionController.createTemplate))
router.put('/env-templates/:id', logOperation('环境模板'), asyncHandler(EnvInspectionController.updateTemplate))
router.delete('/env-templates/:id', logOperation('环境模板'), asyncHandler(EnvInspectionController.deleteTemplate))
// 根据区域获取模板
router.get('/env-templates/area/:areaId', asyncHandler(EnvInspectionController.getTemplatesByArea))

// 检测仪器
router.get('/instruments', asyncHandler(instrumentList))
router.get('/instruments/:id', asyncHandler(instrumentDetail))
router.post('/instruments', logOperation('检测仪器'), asyncHandler(instrumentCreate))
router.put('/instruments/:id', logOperation('检测仪器'), asyncHandler(instrumentUpdate))
router.delete('/instruments/:id', logOperation('检测仪器'), asyncHandler(instrumentRemove))

// 客诉管理路由
router.get('/complaints', asyncHandler(ComplaintController.list))
router.get('/complaints/:id', asyncHandler(ComplaintController.detail))
router.post('/complaints', logOperation('客诉管理'), asyncHandler(ComplaintController.create))
router.put('/complaints/:id', logOperation('客诉管理'), asyncHandler(ComplaintController.update))
router.delete('/complaints/:id', logOperation('客诉管理'), asyncHandler(ComplaintController.delete))
router.post('/complaints/:id/records', logOperation('客诉记录'), asyncHandler(ComplaintController.addRecord))
router.post('/complaints/:id/attachments', complaintAttachmentUploadMiddleware.array('files', 10), logOperation('上传客诉附件'), asyncHandler(ComplaintController.uploadAttachment))
router.put('/complaints/:id/close', logOperation('关闭客诉'), asyncHandler(ComplaintController.close))

// 供应商投诉管理路由
router.get('/supplier-complaints', asyncHandler(SupplierComplaintController.list))
router.get('/supplier-complaints/:id', asyncHandler(SupplierComplaintController.detail))
router.post('/supplier-complaints', logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.create))
router.put('/supplier-complaints/:id', logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.update))
router.delete('/supplier-complaints/:id', logOperation('供应商投诉'), asyncHandler(SupplierComplaintController.delete))
router.put('/supplier-complaints/:id/issue', logOperation('发出投诉'), asyncHandler(SupplierComplaintController.issue))
router.put('/supplier-complaints/:id/reply', logOperation('供应商回复'), asyncHandler(SupplierComplaintController.reply))
router.put('/supplier-complaints/:id/close', logOperation('关闭投诉'), asyncHandler(SupplierComplaintController.close))
router.get('/supplier-complaints/:id/pdf', asyncHandler(SupplierComplaintController.generatePdf))

// 设备故障管理
router.get('/device-faults', asyncHandler(DeviceFaultController.list))
router.get('/device-faults/:id', asyncHandler(DeviceFaultController.detail))
router.post('/device-faults', logOperation('设备故障上报'), asyncHandler(DeviceFaultController.create))
router.put('/device-faults/:id/assign', logOperation('故障派工'), asyncHandler(DeviceFaultController.assign))
router.put('/device-faults/:id/repair', logOperation('提交维修'), asyncHandler(DeviceFaultController.submitRepair))
router.put('/device-faults/:id/approve', logOperation('故障审批'), asyncHandler(DeviceFaultController.approve))
router.put('/device-faults/:id/close', logOperation('关闭故障'), asyncHandler(DeviceFaultController.close))
router.delete('/device-faults/:id', logOperation('删除故障'), asyncHandler(DeviceFaultController.delete))
// 故障图片
router.get('/device-faults/:id/images', asyncHandler(DeviceFaultController.getImages))
router.post('/device-faults/:id/images', deviceFaultUploadMiddleware.array('images', 10), logOperation('上传故障图片'), asyncHandler(DeviceFaultController.uploadImage))

// 设备保养标准（统一版，合并旧点检标准+维护标准）
router.get('/device-standards', asyncHandler(DeviceMaintenanceController.listStandards))
router.post('/device-standards', logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.createStandard))
router.put('/device-standards/:id', logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.updateStandard))
router.delete('/device-standards/:id', logOperation('保养标准'), asyncHandler(DeviceMaintenanceController.deleteStandard))

// 设备维护标准档案（设备级，承载编制/生效/停用状态）
// 注意：available-devices 必须在 :deviceId 之前，避免被参数路由匹配
router.get('/device-maintenance-profiles', asyncHandler(DeviceMaintenanceController.listProfiles))
router.get('/device-maintenance-profiles/available-devices', asyncHandler(DeviceMaintenanceController.listAvailableDevices))
router.get('/device-maintenance-profiles/:deviceId', asyncHandler(DeviceMaintenanceController.detailProfile))
router.post('/device-maintenance-profiles', logOperation('维护标准档案'), asyncHandler(DeviceMaintenanceController.createProfile))
router.put('/device-maintenance-profiles/:deviceId/status', logOperation('档案状态'), asyncHandler(DeviceMaintenanceController.updateProfileStatus))
router.delete('/device-maintenance-profiles/:deviceId', logOperation('维护标准档案'), asyncHandler(DeviceMaintenanceController.deleteProfile))

// 设备保养执行记录（统一版，合并旧点检计划/记录+维护工单）
router.post('/device-records/generate', logOperation('生成保养执行'), asyncHandler(DeviceMaintenanceController.generateRecords))
router.get('/device-records/matrix', asyncHandler(DeviceMaintenanceController.getMatrix))
router.get('/device-records', asyncHandler(DeviceMaintenanceController.listRecords))
router.get('/device-records/:id', asyncHandler(DeviceMaintenanceController.detailRecord))
router.put('/device-records/:id/start', logOperation('开始保养'), asyncHandler(DeviceMaintenanceController.startRecord))
router.put('/device-records/:id/submit', deviceMaintenanceUploadMiddleware.array('images', 10), logOperation('提交保养'), asyncHandler(DeviceMaintenanceController.submitRecord))
router.post('/device-records/batch-submit', logOperation('批量提交保养'), asyncHandler(DeviceMaintenanceController.batchSubmit))
router.put('/device-records/:id/skip', asyncHandler(DeviceMaintenanceController.skipRecord))
router.delete('/device-records/:id', logOperation('删除保养记录'), asyncHandler(DeviceMaintenanceController.deleteRecord))
router.get('/device-records/:id/images', asyncHandler(DeviceMaintenanceController.getImages))
router.post('/device-records/:id/images', deviceMaintenanceUploadMiddleware.array('images', 10), logOperation('上传保养图片'), asyncHandler(DeviceMaintenanceController.uploadImage))

// 设备运行时长
router.post('/device-runtime-logs', logOperation('录入运行时长'), asyncHandler(DeviceMaintenanceController.logRuntime))
router.get('/device-runtime-logs', asyncHandler(DeviceMaintenanceController.getRuntimeLog))

// 设备备件管理
router.get('/device-spare-parts', asyncHandler(DeviceSparePartController.list))
router.get('/device-spare-parts/low-stock/list', asyncHandler(DeviceSparePartController.getLowStock))
router.get('/device-spare-parts/:id', asyncHandler(DeviceSparePartController.detail))
router.post('/device-spare-parts', logOperation('备件管理'), asyncHandler(DeviceSparePartController.create))
router.put('/device-spare-parts/:id', logOperation('备件管理'), asyncHandler(DeviceSparePartController.update))
router.delete('/device-spare-parts/:id', logOperation('备件管理'), asyncHandler(DeviceSparePartController.delete))
router.post('/device-spare-parts/:id/stock-in', logOperation('备件入库'), asyncHandler(DeviceSparePartController.stockIn))
router.post('/device-spare-parts/:id/stock-out', logOperation('备件出库'), asyncHandler(DeviceSparePartController.stockOut))
router.post('/device-spare-parts/:id/adjust', logOperation('库存调整'), asyncHandler(DeviceSparePartController.stockAdjust))
router.get('/device-spare-part-logs', asyncHandler(DeviceSparePartController.listLogs))

// 设备校准管理
router.get('/device-calibration-plans', asyncHandler(DeviceCalibrationController.listPlans))
router.get('/device-calibration-plans/expiring/list', asyncHandler(DeviceCalibrationController.getExpiringSoon))
router.get('/device-calibration-plans/overdue/list', asyncHandler(DeviceCalibrationController.getOverdue))
router.get('/device-calibration-plans/:id', asyncHandler(DeviceCalibrationController.detailPlan))
router.post('/device-calibration-plans', logOperation('校准计划'), asyncHandler(DeviceCalibrationController.createPlan))
router.put('/device-calibration-plans/:id', logOperation('校准计划'), asyncHandler(DeviceCalibrationController.updatePlan))
router.delete('/device-calibration-plans/:id', logOperation('校准计划'), asyncHandler(DeviceCalibrationController.deletePlan))
router.put('/device-calibration-plans/:id/submit', logOperation('提交校准'), asyncHandler(DeviceCalibrationController.submitCalibration))
router.post('/device-calibration-plans/:id/certificate', calibrationUploadMiddleware.array('images', 10), logOperation('上传证书'), asyncHandler(DeviceCalibrationController.uploadCertificate))
router.get('/device-calibration-records', asyncHandler(DeviceCalibrationController.listRecords))

// 设备电子档案管理
router.get('/device-documents', asyncHandler(DeviceDocumentController.list))
router.get('/device-documents/by-device/:deviceId', asyncHandler(DeviceDocumentController.listByDevice))
router.get('/device-documents/:id/download', asyncHandler(DeviceDocumentController.download))
router.get('/device-documents/:id', asyncHandler(DeviceDocumentController.detail))
router.post('/device-documents', deviceDocumentUploadMiddleware.array('files', 10), logOperation('上传设备文档'), asyncHandler(DeviceDocumentController.upload))
router.put('/device-documents/:id', logOperation('更新设备文档'), asyncHandler(DeviceDocumentController.update))
router.delete('/device-documents/:id', logOperation('删除设备文档'), asyncHandler(DeviceDocumentController.delete))

export default router
