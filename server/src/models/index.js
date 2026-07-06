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
import WorkOrder from './WorkOrder.js'
import ProcessReport from './ProcessReport.js'
import ManpowerRecord from './ManpowerRecord.js'
import ExceptionRecord from './ExceptionRecord.js'
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

// 建立模型关联关系
// 用户 - 角色
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' })
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' })

// 订单 - 工单
Order.hasMany(WorkOrder, { foreignKey: 'order_id', as: 'work_orders' })
WorkOrder.belongsTo(Order, { foreignKey: 'order_id', as: 'order' })

// 工单 - 工序报工
WorkOrder.hasMany(ProcessReport, { foreignKey: 'work_order_id', as: 'process_reports' })
ProcessReport.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'work_order' })

// 工单 - 人员投入记录
WorkOrder.hasMany(ManpowerRecord, { foreignKey: 'work_order_id', as: 'manpower_records' })
ManpowerRecord.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'work_order' })

// 工单 - 异常记录
WorkOrder.hasMany(ExceptionRecord, { foreignKey: 'work_order_id', as: 'exception_records' })
ExceptionRecord.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'work_order' })

// 订单 - 异常记录
Order.hasMany(ExceptionRecord, { foreignKey: 'order_id', as: 'exception_records' })
ExceptionRecord.belongsTo(Order, { foreignKey: 'order_id', as: 'order' })

// 角色 - 权限 (多对多)
Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', otherKey: 'perm_id', as: 'permissions' })
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'perm_id', otherKey: 'role_id', as: 'roles' })

// 客户 - 料品（一对多）
Customer.hasMany(Material, { foreignKey: 'customer_id', as: 'materials' })
Material.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' })

// 产线 - 工序（多对多，通过 bas_line_process）
ProductionLine.belongsToMany(Process, { through: LineProcess, foreignKey: 'line_id', otherKey: 'process_id', as: 'processes' })
Process.belongsToMany(ProductionLine, { through: LineProcess, foreignKey: 'process_id', otherKey: 'line_id', as: 'lines' })

// 产线 - 设备（多对多，通过 bas_line_device）
ProductionLine.belongsToMany(Device, { through: LineDevice, foreignKey: 'line_id', otherKey: 'device_id', as: 'devices' })
Device.belongsToMany(ProductionLine, { through: LineDevice, foreignKey: 'device_id', otherKey: 'line_id', as: 'lines' })

// 不良分类 - 父级（自关联，树形）
DefectType.hasMany(DefectType, { foreignKey: 'parent_id', as: 'children', constraints: false })
DefectType.belongsTo(DefectType, { foreignKey: 'parent_id', as: 'parent', constraints: false })

// 不良分类 - 不良图片（一对多）
DefectType.hasMany(DefectImage, { foreignKey: 'defect_id', as: 'images' })
DefectImage.belongsTo(DefectType, { foreignKey: 'defect_id', as: 'defect' })

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
  WorkOrder,
  ProcessReport,
  ManpowerRecord,
  ExceptionRecord,
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
  WorkOrder,
  ProcessReport,
  ManpowerRecord,
  ExceptionRecord,
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
}

export default db
