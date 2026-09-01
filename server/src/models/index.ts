import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

import User from './User.js'
import Role from './Role.js'
import Permission from './Permission.js'
import OperationLog from './OperationLog.js'
import Material from './Material.js'
import ProductionLine from './ProductionLine.js'
import Process from './Process.js'
import Device from './Device.js'
import DefectType from './DefectType.js'
import Order from './Order.js'
import ReportOrder from './ReportOrder.js'
import ReportProcess from './ReportProcess.js'
import ManpowerRecord from './ManpowerRecord.js'
import ProcessDefect from './ProcessDefect.js'
import ProcessException from './ProcessException.js'
import ProcessMaterial from './ProcessMaterial.js'
import ReportImage from './ReportImage.js'
import SystemConfig from './SystemConfig.js'
import RolePermission from './RolePermission.js'
import Sequence from './Sequence.js'
import Customer from './Customer.js'
import Supplier from './Supplier.js'
import LineProcess from './LineProcess.js'
import LineDevice from './LineDevice.js'
import NumberRule from './NumberRule.js'
import DefectImage from './DefectImage.js'
import DictType from './DictType.js'
import DictData from './DictData.js'
import DataDictionary from './DataDictionary.js'
import UserSetting from './UserSetting.js'
import ProductInspection from './ProductInspection.js'
import IncomingInspection from './IncomingInspection.js'
import InspectionStandard from './InspectionStandard.js'
import InspectionStandardItem from './InspectionStandardItem.js'
import MicrobeInspection from './MicrobeInspection.js'
// 检验数据统一存储改造（阶段1.5）：统一子表 + 样品测量值明细
import QcInspectionItem from './QcInspectionItem.js'
import QcInspectionSampleValue from './QcInspectionSampleValue.js'
import TaskSetting from './TaskSetting.js'
import SyncTask from './SyncTask.js'
import ScheduledTask from './ScheduledTask.js'
import U9Item from './U9Item.js'
import U9Customer from './U9Customer.js'
import EnvMonitor from './EnvMonitor.js'
import EnvAlarm from './EnvAlarm.js'
import WeatherInfo from './WeatherInfo.js'
import EnergyMeterData from './EnergyMeterData.js'
import U9ProductionOrder from './U9ProductionOrder.js'
import U9PurchaseReceipt from './U9PurchaseReceipt.js'
import Instrument from './Instrument.js'
import QualityEnvArea from './QualityEnvArea.js'
import QualityEnvTemplate from './QualityEnvTemplate.js'
import QualityEnvInspection from './QualityEnvInspection.js'
import QualityEnvInspectionItem from './QualityEnvInspectionItem.js'
import QualitySupplierComplaint from './QualitySupplierComplaint.js'
import QualityComplaint from './QualityComplaint.js'
import QualityComplaintRecord from './QualityComplaintRecord.js'
import DeviceFault from './DeviceFault.js'
import DeviceFaultRepair from './DeviceFaultRepair.js'
import DeviceImage from './DeviceImage.js'
import DeviceMaintenanceStandard from './DeviceMaintenanceStandard.js'
import DeviceMaintenanceProfile from './DeviceMaintenanceProfile.js'
import DeviceMaintenanceRecord from './DeviceMaintenanceRecord.js'
import DeviceRuntimeLog from './DeviceRuntimeLog.js'
import DeviceCalibrationPlan from './DeviceCalibrationPlan.js'
import DeviceCalibrationRecord from './DeviceCalibrationRecord.js'
import DeviceSparePart from './DeviceSparePart.js'
import DeviceSparePartLog from './DeviceSparePartLog.js'
import DeviceDocument from './DeviceDocument.js'

// 建立模型关联关系
// 用户 - 角色
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' })
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' })

// 订单 - 生产报工单（一对多，订单下发后直接创建报工单）
Order.hasMany(ReportOrder, { foreignKey: 'order_id', as: 'report_orders' })
ReportOrder.belongsTo(Order, { foreignKey: 'order_id', as: 'order' })

// 报工单 - 料品
ReportOrder.belongsTo(Material, { foreignKey: 'material_id', as: 'material' })

// 报工单 - 报工工序（一对多，从产线工序表继承）
ReportOrder.hasMany(ReportProcess, { foreignKey: 'report_order_id', as: 'report_processes' })
ReportProcess.belongsTo(ReportOrder, { foreignKey: 'report_order_id', as: 'report_order' })

// 报工单 - 人员使用记录（一对多）
ReportOrder.hasMany(ManpowerRecord, { foreignKey: 'report_order_id', as: 'manpower_records' })
ManpowerRecord.belongsTo(ReportOrder, { foreignKey: 'report_order_id', as: 'report_order' })

// 报工单 - 报工不良记录（一对多）
ReportOrder.hasMany(ProcessDefect, { foreignKey: 'report_order_id', as: 'process_defects' })
ProcessDefect.belongsTo(ReportOrder, { foreignKey: 'report_order_id', as: 'report_order' })

// 报工单 - 异常工时记录（一对多）
ReportOrder.hasMany(ProcessException, { foreignKey: 'report_order_id', as: 'process_exceptions' })
ProcessException.belongsTo(ReportOrder, { foreignKey: 'report_order_id', as: 'report_order' })

// 报工单 - 报工物料记录（一对多）
ReportOrder.hasMany(ProcessMaterial, { foreignKey: 'report_order_id', as: 'process_materials' })
ProcessMaterial.belongsTo(ReportOrder, { foreignKey: 'report_order_id', as: 'report_order' })

// 报工物料 - 基础料品（bas_material_id 与 bas_material.material_id 均为 CHAR(36) UUID）
ProcessMaterial.belongsTo(Material, { foreignKey: 'bas_material_id', as: 'bas_material', constraints: true, onDelete: 'SET NULL', onUpdate: 'CASCADE' })

// 报工单 - 报工图片记录（一对多）
ReportOrder.hasMany(ReportImage, { foreignKey: 'report_order_id', as: 'report_images' })
ReportImage.belongsTo(ReportOrder, { foreignKey: 'report_order_id', as: 'report_order' })

// 角色 - 权限 (多对多)
Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', otherKey: 'perm_id', as: 'permissions' })
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'perm_id', otherKey: 'role_id', as: 'roles' })

// 客户 - 料品（一对多）
Customer.hasMany(Material, { foreignKey: 'customer_id', as: 'materials' })
Material.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' })

// 产线 - 工序（多对多，通过 bas_line_process）
ProductionLine.belongsToMany(Process, { through: LineProcess, foreignKey: 'line_id', otherKey: 'process_id', as: 'processes' })
Process.belongsToMany(ProductionLine, { through: LineProcess, foreignKey: 'process_id', otherKey: 'line_id', as: 'lines' })
// 关联表显式 belongsTo，便于 LineProcess.findAll({ include: [{ model: Process }] })
LineProcess.belongsTo(ProductionLine, { foreignKey: 'line_id', as: 'line' })
LineProcess.belongsTo(Process, { foreignKey: 'process_id', as: 'Process' })

// 产线 - 设备（多对多，通过 bas_line_device）
ProductionLine.belongsToMany(Device, { through: LineDevice, foreignKey: 'line_id', otherKey: 'device_id', as: 'devices' })
Device.belongsToMany(ProductionLine, { through: LineDevice, foreignKey: 'device_id', otherKey: 'line_id', as: 'lines' })
// 关联表显式 belongsTo，便于 LineDevice.findAll({ include: [{ model: Device }] })
LineDevice.belongsTo(ProductionLine, { foreignKey: 'line_id', as: 'line' })
LineDevice.belongsTo(Device, { foreignKey: 'device_id', as: 'Device' })
LineDevice.belongsTo(Process, { foreignKey: 'process_id', as: 'Process' })

// 不良分类 - 父级（自关联，树形）
DefectType.hasMany(DefectType, { foreignKey: 'parent_id', as: 'children', constraints: false })
DefectType.belongsTo(DefectType, { foreignKey: 'parent_id', as: 'parent', constraints: false })

// 不良分类 - 不良图片（一对多）
DefectType.hasMany(DefectImage, { foreignKey: 'defect_id', as: 'images' })
DefectImage.belongsTo(DefectType, { foreignKey: 'defect_id', as: 'defect' })

// 不良记录 - 不良分类（一对多）
ProcessDefect.belongsTo(DefectType, { foreignKey: 'defect_type_id', as: 'defect_type' })
DefectType.hasMany(ProcessDefect, { foreignKey: 'defect_type_id', as: 'process_defects' })

// 字典类型 - 字典数据（一对多）
DictType.hasMany(DictData, { foreignKey: 'dict_type', sourceKey: 'dict_type', as: 'datas' })
DictData.belongsTo(DictType, { foreignKey: 'dict_type', targetKey: 'dict_type', as: 'dictType' })

// 产品检测主表 - 报工单
ProductInspection.belongsTo(ReportOrder, { foreignKey: 'report_order_id', as: 'report_order' })
// 产品检测主表 - 检验标准
ProductInspection.belongsTo(InspectionStandard, { foreignKey: 'standard_id', as: 'standard' })
// 阶段5：ProductInspectionItem（旧子表）关联已移除，统一使用 QcInspectionItem（as: 'qc_items'）

// 来料检验主表 - 检验标准
IncomingInspection.belongsTo(InspectionStandard, { foreignKey: 'standard_id', as: 'standard' })
// 阶段5：IncomingInspectionItem（旧子表）关联已移除，统一使用 QcInspectionItem（as: 'qc_items'）

// 检验标准 - 检验标准项目（一对多）
InspectionStandard.hasMany(InspectionStandardItem, { foreignKey: 'standard_id', as: 'items' })
InspectionStandardItem.belongsTo(InspectionStandard, { foreignKey: 'standard_id', as: 'standard' })
// 检验标准 - 料品
InspectionStandard.belongsTo(Material, { foreignKey: 'material_id', as: 'material', constraints: false })

// 微生物检验主表 - 报工单
MicrobeInspection.belongsTo(ReportOrder, { foreignKey: 'report_order_id', as: 'report_order', constraints: false })
// 微生物检验主表 - 来料检验
MicrobeInspection.belongsTo(IncomingInspection, { foreignKey: 'incoming_id', as: 'incoming_inspection', constraints: false })
// 微生物检验主表 - 生产订单
MicrobeInspection.belongsTo(Order, { foreignKey: 'order_id', as: 'order', constraints: false })
// 微生物检验主表 - 检验标准
MicrobeInspection.belongsTo(InspectionStandard, { foreignKey: 'standard_id', as: 'standard', constraints: false })
// 阶段5：MicrobeInspectionItem（旧子表）关联已移除，统一使用 QcInspectionItem（as: 'qc_items'）

// 客诉 - 处理记录（一对多）
QualityComplaint.hasMany(QualityComplaintRecord, { foreignKey: 'complaint_id', as: 'records', onDelete: 'CASCADE' })
QualityComplaintRecord.belongsTo(QualityComplaint, { foreignKey: 'complaint_id', as: 'complaint' })

// 客诉 - 客户（多对一）
QualityComplaint.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer', constraints: false })

// 客诉 - 料品（多对一）
QualityComplaint.belongsTo(Material, { foreignKey: 'material_id', as: 'material', constraints: false })

// 供应商投诉 - 供应商（多对一）
QualitySupplierComplaint.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier', constraints: false })

// 供应商投诉 - 来料检验（多对一）
QualitySupplierComplaint.belongsTo(IncomingInspection, { foreignKey: 'related_inspection_id', as: 'incoming_inspection', constraints: false })

// 环境检验区域 - 自关联（树形）
QualityEnvArea.hasMany(QualityEnvArea, { foreignKey: 'parent_id', as: 'children', constraints: false })
QualityEnvArea.belongsTo(QualityEnvArea, { foreignKey: 'parent_id', as: 'parent', constraints: false })

// 环境检验区域 - 环境检验模板（一对多）
QualityEnvArea.hasMany(QualityEnvTemplate, { foreignKey: 'area_id', as: 'templates' })
QualityEnvTemplate.belongsTo(QualityEnvArea, { foreignKey: 'area_id', as: 'area' })

// 环境检验区域 - 环境检验记录（一对多）
QualityEnvArea.hasMany(QualityEnvInspection, { foreignKey: 'area_id', as: 'inspections' })
QualityEnvInspection.belongsTo(QualityEnvArea, { foreignKey: 'area_id', as: 'area' })

// 环境检验记录 - 检验子项（一对多）
QualityEnvInspection.hasMany(QualityEnvInspectionItem, { foreignKey: 'inspection_id', as: 'items', onDelete: 'CASCADE' })
QualityEnvInspectionItem.belongsTo(QualityEnvInspection, { foreignKey: 'inspection_id', as: 'inspection' })

// ============================================================
// 检验数据统一存储改造（阶段1.5）：统一子表 + 样品测量值明细
// 多态外键关联：三主表 hasMany QcInspectionItem（as: 'qc_items'）
// 注意：source_type 区分来源，无物理FK约束，应用层保证一致性
// ============================================================
// 来料检验主表 - 统一检验子表（一对多，多态）
IncomingInspection.hasMany(QcInspectionItem, {
  foreignKey: 'inspection_id',
  scope: { source_type: '来料' },
  as: 'qc_items',
  constraints: false,
})
// 产品检验主表 - 统一检验子表（一对多，多态）
ProductInspection.hasMany(QcInspectionItem, {
  foreignKey: 'inspection_id',
  scope: { source_type: '产品' },
  as: 'qc_items',
  constraints: false,
})
// 微生物检验主表 - 统一检验子表（一对多，多态）
MicrobeInspection.hasMany(QcInspectionItem, {
  foreignKey: 'inspection_id',
  scope: { source_type: '微生物' },
  as: 'qc_items',
  constraints: false,
})
// 统一检验子表 - 样品测量值（一对多）
QcInspectionItem.hasMany(QcInspectionSampleValue, {
  foreignKey: 'item_id',
  as: 'sample_values',
  onDelete: 'CASCADE',
})
QcInspectionSampleValue.belongsTo(QcInspectionItem, {
  foreignKey: 'item_id',
  as: 'qc_item',
})
// 统一检验子表 - 检验标准项目配置（多态关联，可空）
QcInspectionItem.belongsTo(InspectionStandardItem, {
  foreignKey: 'item_cfg_id',
  as: 'item_cfg',
  constraints: false,
})

// 设备故障 - 维修记录（一对一）
DeviceFault.hasOne(DeviceFaultRepair, { foreignKey: 'fault_id', as: 'repair_record', onDelete: 'CASCADE' })
DeviceFaultRepair.belongsTo(DeviceFault, { foreignKey: 'fault_id', as: 'fault' })

// 设备故障 - 图片（一对多，多态）
DeviceFault.hasMany(DeviceImage, { foreignKey: 'doc_id', scope: { doc_type: 'fault' }, as: 'fault_images', constraints: false })
DeviceFaultRepair.hasMany(DeviceImage, { foreignKey: 'doc_id', scope: { doc_type: 'repair' }, as: 'repair_images', constraints: false })

// 设备保养标准 - 设备（多对一）
DeviceMaintenanceStandard.belongsTo(Device, { foreignKey: 'device_id', as: 'device', constraints: false })
Device.hasMany(DeviceMaintenanceStandard, { foreignKey: 'device_id', as: 'device_standards' })

// 设备维护标准档案 - 设备（一对一，设备级状态）
DeviceMaintenanceProfile.belongsTo(Device, { foreignKey: 'device_id', as: 'device', constraints: false })
Device.hasOne(DeviceMaintenanceProfile, { foreignKey: 'device_id', as: 'maintenance_profile', constraints: false })
// 档案 - 标准项（一对多，通过 device_id 关联）
DeviceMaintenanceProfile.hasMany(DeviceMaintenanceStandard, { foreignKey: 'device_id', as: 'standards', constraints: false })
DeviceMaintenanceStandard.belongsTo(DeviceMaintenanceProfile, { foreignKey: 'device_id', as: 'profile', constraints: false })

// 设备保养执行记录 - 设备（多对一）
DeviceMaintenanceRecord.belongsTo(Device, { foreignKey: 'device_id', as: 'device', constraints: false })

// 设备保养执行记录 - 保养标准（多对一）
DeviceMaintenanceRecord.belongsTo(DeviceMaintenanceStandard, { foreignKey: 'standard_id', as: 'standard', constraints: false })
DeviceMaintenanceStandard.hasMany(DeviceMaintenanceRecord, { foreignKey: 'standard_id', as: 'records', onDelete: 'CASCADE' })

// 设备保养执行记录 - 保养图片（一对多，多态 doc_type='maintenance'）
DeviceMaintenanceRecord.hasMany(DeviceImage, { foreignKey: 'doc_id', scope: { doc_type: 'maintenance' }, as: 'maintenance_images', constraints: false })

// 运行时长日志 - 设备
DeviceRuntimeLog.belongsTo(Device, { foreignKey: 'device_id', as: 'device', constraints: false })

// 设备校准
DeviceCalibrationPlan.belongsTo(Device, { foreignKey: 'device_id', as: 'device', constraints: false })
DeviceCalibrationPlan.hasMany(DeviceCalibrationRecord, { foreignKey: 'plan_id', as: 'records', onDelete: 'CASCADE' })
DeviceCalibrationRecord.belongsTo(DeviceCalibrationPlan, { foreignKey: 'plan_id', as: 'plan' })
// 校准证书图片关联（复用 DeviceImage 模型，doc_type='calibration'）
DeviceCalibrationRecord.hasMany(DeviceImage, { foreignKey: 'doc_id', scope: { doc_type: 'calibration' }, as: 'calibration_images', constraints: false })

// 设备备件 - 出入库流水（一对多）
DeviceSparePart.hasMany(DeviceSparePartLog, { foreignKey: 'part_id', as: 'logs' })
DeviceSparePartLog.belongsTo(DeviceSparePart, { foreignKey: 'part_id', as: 'part' })

// 设备电子档案 - 设备（多对一，多态，无物理FK约束）
DeviceDocument.belongsTo(Device, { foreignKey: 'device_id', as: 'device', constraints: false })

const db = {
  sequelize,
  DataTypes,
  User,
  Role,
  Permission,
  OperationLog,
  Material,
  ProductionLine,
  Process,
  Device,
  DefectType,
  Order,
  ReportOrder,
  ReportProcess,
  ManpowerRecord,
  ProcessDefect,
  ProcessException,
  ProcessMaterial,
  ReportImage,
  SystemConfig,
  RolePermission,
  Sequence,
  Customer,
  Supplier,
  LineProcess,
  LineDevice,
  NumberRule,
  DefectImage,
  DictType,
  DictData,
  DataDictionary,
  UserSetting,
  ProductInspection,
  IncomingInspection,
  InspectionStandard,
  InspectionStandardItem,
  MicrobeInspection,
  QcInspectionItem,
  QcInspectionSampleValue,
  TaskSetting,
  SyncTask,
  ScheduledTask,
  U9Item,
  U9Customer,
  EnvMonitor,
  EnvAlarm,
  WeatherInfo,
  EnergyMeterData,
  U9ProductionOrder,
  U9PurchaseReceipt,
  Instrument,
  QualityEnvArea,
  QualityEnvTemplate,
  QualityEnvInspection,
  QualityEnvInspectionItem,
  QualityComplaint,
  QualityComplaintRecord,
  QualitySupplierComplaint,
  DeviceFault,
  DeviceFaultRepair,
  DeviceImage,
  DeviceMaintenanceStandard,
  DeviceMaintenanceProfile,
  DeviceMaintenanceRecord,
  DeviceRuntimeLog,
  DeviceCalibrationPlan,
  DeviceCalibrationRecord,
  DeviceSparePart,
  DeviceSparePartLog,
  DeviceDocument,
}

// 具名导出，便于按需导入
export {
  User,
  Role,
  Permission,
  OperationLog,
  Material,
  ProductionLine,
  Process,
  Device,
  DefectType,
  Order,
  ReportOrder,
  ReportProcess,
  ManpowerRecord,
  ProcessDefect,
  ProcessException,
  ProcessMaterial,
  ReportImage,
  SystemConfig,
  RolePermission,
  Sequence,
  Customer,
  Supplier,
  LineProcess,
  LineDevice,
  NumberRule,
  DefectImage,
  DictType,
  DictData,
  DataDictionary,
  UserSetting,
  ProductInspection,
  IncomingInspection,
  InspectionStandard,
  InspectionStandardItem,
  MicrobeInspection,
  QcInspectionItem,
  QcInspectionSampleValue,
  TaskSetting,
  SyncTask,
  ScheduledTask,
  U9Item,
  U9Customer,
  EnvMonitor,
  EnvAlarm,
  WeatherInfo,
  EnergyMeterData,
  U9ProductionOrder,
  U9PurchaseReceipt,
  Instrument,
  QualityEnvArea,
  QualityEnvTemplate,
  QualityEnvInspection,
  QualityEnvInspectionItem,
  QualityComplaint,
  QualityComplaintRecord,
  QualitySupplierComplaint,
  DeviceFault,
  DeviceFaultRepair,
  DeviceImage,
  DeviceMaintenanceStandard,
  DeviceMaintenanceProfile,
  DeviceMaintenanceRecord,
  DeviceRuntimeLog,
  DeviceCalibrationPlan,
  DeviceCalibrationRecord,
  DeviceSparePart,
  DeviceSparePartLog,
  DeviceDocument,
}

// 别名：统一以模型业务名对外暴露，兼容控制器与测试中的既有引用
export const UserModel = User
export const ProcessMaterialModel = ProcessMaterial
export const MaterialModel = Material

export default db
