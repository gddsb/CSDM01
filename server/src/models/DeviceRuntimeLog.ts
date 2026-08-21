import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DeviceRuntimeLog = sequelize.define('DeviceRuntimeLog', {
  log_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '记录ID',
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '设备ID',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },
  runtime_hours: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: '当前累计运行小时数（从设备面板读取）',
  },
  previous_hours: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '上次记录的运行小时数',
  },
  delta_hours: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '本次增量运行小时数',
  },
  logged_by: { type: DataTypes.INTEGER, comment: '录入人ID' },
  logged_by_name: { type: DataTypes.STRING(50), comment: '录入人姓名' },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_runtime_log',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['created_at'] },
  ],
})

export default DeviceRuntimeLog
