import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const OperationLog = sequelize.define('OperationLog', {
  log_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
  },
  username: {
    type: DataTypes.STRING(50),
  },
  module: {
    type: DataTypes.STRING(50),
  },
  operation: {
    type: DataTypes.STRING(100),
  },
  method: {
    type: DataTypes.STRING(10),
  },
  params: {
    type: DataTypes.TEXT,
  },
  ip: {
    type: DataTypes.STRING(50),
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
  },
}, {
  tableName: 'sys_operation_log',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default OperationLog
