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
  // 操作类型（设计文档 §2.2.1 字段名为 action，现有实现用 operation 同义）
  action: {
    type: DataTypes.STRING(50),
  },
  // 操作内容（设计文档 §2.2.1 字段名为 content，现有实现用 operation/params 同义）
  operation: {
    type: DataTypes.STRING(100),
  },
  content: {
    type: DataTypes.TEXT,
  },
  method: {
    type: DataTypes.STRING(10),
  },
  params: {
    type: DataTypes.TEXT,
  },
  // IP 地址（设计文档 §2.2.1 字段名为 ip_address，现有实现用 ip 同义）
  ip: {
    type: DataTypes.STRING(45),
  },
  ip_address: {
    type: DataTypes.STRING(45),
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
