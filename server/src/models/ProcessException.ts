import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 异常工时记录子表（关联生产报工单）
const ProcessException = sequelize.define('ProcessException', {
  exception_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_order_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '生产报工单ID',
  },
  exception_type: {
    type: DataTypes.STRING(50),
    comment: '异常类型',
  },
  device_id: {
    type: DataTypes.INTEGER,
    comment: '设备ID',
  },
  device_code: {
    type: DataTypes.STRING(50),
    comment: '设备编码',
  },
  device_name: {
    type: DataTypes.STRING(100),
    comment: '设备名称',
  },
  stop_type: {
    type: DataTypes.STRING(100),
    comment: '停机类型',
  },
  confirm_user: {
    type: DataTypes.STRING(50),
    comment: '确认人',
  },
  confirm_user_name: {
    type: DataTypes.STRING(50),
    comment: '确认人姓名',
  },
  start_time: {
    type: DataTypes.DATE,
    comment: '开始时间',
  },
  end_time: {
    type: DataTypes.DATE,
    comment: '恢复时间',
  },
  duration: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '持续时长(小时)',
  },
  description: {
    type: DataTypes.STRING(500),
    comment: '异常描述',
  },
  exception_images: {
    type: DataTypes.TEXT,
    comment: '异常图片，JSON数组存储',
  },
  record_user: {
    type: DataTypes.STRING(50),
    comment: '记录人',
  },
  record_user_name: {
    type: DataTypes.STRING(50),
    comment: '记录人姓名',
  },
}, {
  tableName: 'production_process_exception',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ProcessException
