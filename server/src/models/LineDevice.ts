import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 产线-设备关联表（bas_line_device，设计文档 §2.2.7）
// 描述产线、设备与工序的三方关联
const LineDevice = sequelize.define('LineDevice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  line_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  process_id: {
    type: DataTypes.INTEGER,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'bas_line_device',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['line_id', 'device_id', 'process_id'] },
  ],
})

export default LineDevice
