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
import LineProcess from './LineProcess.js'
import LineDevice from './LineDevice.js'
import NumberRule from './NumberRule.js'
import DefectImage from './DefectImage.js'
import DictType from './DictType.js'
import DictData from './DictData.js'
import DataDictionary from './DataDictionary.js'

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

// 报工物料 - 基础料品（bas_material_id 为字符串类型，与 material_id 整数类型不兼容，禁用 FK 约束）
ProcessMaterial.belongsTo(Material, { foreignKey: 'bas_material_id', as: 'bas_material', constraints: false })

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
  LineProcess,
  LineDevice,
  NumberRule,
  DefectImage,
  DictType,
  DictData,
  DataDictionary,
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
  LineProcess,
  LineDevice,
  NumberRule,
  DefectImage,
  DictType,
  DictData,
  DataDictionary,
}

export default db
