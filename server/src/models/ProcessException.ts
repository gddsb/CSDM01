import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 异常工时记录子表（关联生产报工单）
const ProcessException = sequelize.define('ProcessException', {
  exception_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '异常记录ID（主键）',
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
    comment: '持续时长(小时-MySQL STORED自动计算)',
    // MySQL GENERATED ALWAYS AS STORED 列，Sequelize 写入时忽略
    set() { /* 只读：DB STORED 自动算 */ },
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
  comment: '报工异常停机记录表：记录生产过程中的设备异常、停机时间等',
})

export default ProcessException
