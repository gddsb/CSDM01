import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const EnvMonitor = sequelize.define('EnvMonitor', {
  monitor_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  factor_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '因子ID',
  },
  device_addr: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '设备地址',
  },
  device_name: {
    type: DataTypes.STRING(200),
    comment: '设备名称',
  },
  node_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '节点ID',
  },
  register_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '寄存器ID',
  },
  factor_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '因子名称',
  },
  value: {
    type: DataTypes.DOUBLE,
    comment: '当前值',
  },
  raw_data: {
    type: DataTypes.STRING(50),
    comment: '原始数据',
  },
  unit: {
    type: DataTypes.STRING(20),
    comment: '单位',
  },
  coefficient: {
    type: DataTypes.FLOAT,
    comment: '系数',
  },
  device_status: {
    type: DataTypes.STRING(20),
    comment: '设备状态',
  },
  collect_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '采集时间(平台时间戳)',
  },
  data_time: {
    type: DataTypes.DATE,
    comment: '数据时间(系统采集时间)',
  },
}, {
  tableName: 'task_env_monitor_data',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['factor_id'] },
    { fields: ['device_addr'] },
    { fields: ['collect_time'] },
    { fields: ['data_time'] },
    { fields: ['factor_id', 'collect_time'] },
  ],
})

export default EnvMonitor
