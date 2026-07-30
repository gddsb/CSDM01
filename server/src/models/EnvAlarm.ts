import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const EnvAlarm = sequelize.define('EnvAlarm', {
  alarm_id: {
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
  alarm_info: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '报警信息',
  },
  alarm_level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '报警级别',
  },
  alarm_range: {
    type: DataTypes.STRING(100),
    comment: '报警限值',
  },
  current_value: {
    type: DataTypes.DOUBLE,
    comment: '当前报警值',
  },
  unit: {
    type: DataTypes.STRING(20),
    comment: '单位',
  },
  alarm_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '报警时间',
  },
  is_handled: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    comment: '是否已处理：0-未处理 1-已处理',
  },
  handle_msg: {
    type: DataTypes.STRING(500),
    comment: '处理意见',
  },
}, {
  tableName: 'env_alarm_record',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['factor_id'] },
    { fields: ['device_addr'] },
    { fields: ['alarm_time'] },
    { fields: ['alarm_level'] },
    { fields: ['is_handled'] },
    { fields: ['factor_id', 'alarm_time'] },
  ],
})

export default EnvAlarm
