import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 产线-设备关联表
 * 描述产线、设备与工序的三方关联：某台设备在哪条产线上、能承担哪个工序。
 * (line_id, device_id, process_id) 唯一约束，确保同产线下同设备不能重复分配到同一工序。
 */
const LineDevice = sequelize.define('LineDevice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '关联记录ID（主键）',
  },
  line_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '产线ID（关联 master_production_line.line_id）',
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '设备ID（关联 device.device_id）',
  },
  process_id: {
    type: DataTypes.INTEGER,
    comment: '负责的工序ID（关联 master_process.process_id，可为空表示泛用设备）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序序号（设备在产线上的展示顺序）',
  },
}, {
  tableName: 'bas_line_device',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['line_id', 'device_id', 'process_id'] },
  ],
  comment: '产线-设备关联表：配置某台设备在哪条产线上、承担哪个工序',
})

export default LineDevice
