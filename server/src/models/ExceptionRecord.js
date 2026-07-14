import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ExceptionRecord = sequelize.define('ExceptionRecord', {
  record_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  work_order_id: {
    type: DataTypes.INTEGER,
  },
  work_order_no: {
    type: DataTypes.STRING(50),
  },
  line_name: {
    type: DataTypes.STRING(100),
  },
  order_id: {
    type: DataTypes.INTEGER,
  },
  order_no: {
    type: DataTypes.STRING(50),
  },
  exception_type: {
    type: DataTypes.STRING(50),
  },
  exception_type_name: {
    type: DataTypes.STRING(100),
  },
  device_id: {
    type: DataTypes.INTEGER,
  },
  device_name: {
    type: DataTypes.STRING(100),
  },
  start_time: {
    type: DataTypes.DATE,
  },
  end_time: {
    type: DataTypes.DATE,
  },
  duration: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  reason: {
    type: DataTypes.STRING(500),
  },
  handle_result: {
    type: DataTypes.STRING(500),
  },
  exception_images: {
    type: DataTypes.TEXT,
    comment: '异常图片，JSON数组存储',
  },
  record_user: {
    type: DataTypes.STRING(50),
  },
  record_user_name: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'production_exception_record',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ExceptionRecord
