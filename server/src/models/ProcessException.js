import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ProcessException = sequelize.define('ProcessException', {
  exception_id: {
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
  exception_type: {
    type: DataTypes.STRING(50),
  },
  device_id: {
    type: DataTypes.INTEGER,
  },
  device_code: {
    type: DataTypes.STRING(50),
  },
  device_name: {
    type: DataTypes.STRING(100),
  },
  stop_type: {
    type: DataTypes.STRING(100),
  },
  confirm_user: {
    type: DataTypes.STRING(50),
  },
  confirm_user_name: {
    type: DataTypes.STRING(50),
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
  description: {
    type: DataTypes.STRING(500),
  },
  record_user: {
    type: DataTypes.STRING(50),
  },
  record_user_name: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'production_process_exception',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ProcessException