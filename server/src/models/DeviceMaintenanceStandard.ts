import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DeviceMaintenanceStandard = sequelize.define('DeviceMaintenanceStandard', {
  standard_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '维护标准ID',
  },
  standard_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '维护标准名称',
  },
  device_type: {
    type: DataTypes.STRING(50),
    comment: '适用设备类型（可空，空表示所有设备）',
  },
  device_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '适用设备ID（可空，空表示按类型匹配）',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },
  item_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '维护项目名称（如：润滑、更换滤芯、检查皮带）',
  },
  trigger_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '周期',
    comment: '触发方式：周期（固定时间）/ 运行时长',
  },
  cycle_value: {
    type: DataTypes.INTEGER,
    comment: '周期值（trigger_type=周期时有效，如：30天=30）',
  },
  cycle_unit: {
    type: DataTypes.STRING(10),
    defaultValue: '天',
    comment: '周期单位：天/周/月/季',
  },
  runtime_threshold: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '运行时长阈值（trigger_type=运行时长时有效，单位：小时）',
  },
  standard_requirement: {
    type: DataTypes.STRING(500),
    comment: '标准要求/维护说明',
  },
  last_maintenance_date: {
    type: DataTypes.DATEONLY,
    comment: '上次维护日期（用于计算下次维护日期）',
  },
  last_maintenance_runtime: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '上次维护时的运行时长（用于计算阈值差值）',
  },
  next_maintenance_date: {
    type: DataTypes.DATEONLY,
    comment: '下次维护日期（trigger_type=周期时自动计算）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：1启用, 0禁用',
  },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_maintenance_standard',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['device_type'] },
    { fields: ['trigger_type'] },
    { fields: ['next_maintenance_date'] },
  ],
})

export default DeviceMaintenanceStandard
