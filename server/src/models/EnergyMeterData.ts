import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const EnergyMeterData = sequelize.define('EnergyMeterData', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  task_setting_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '关联任务设置ID',
  },
  reading_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '采集时间',
  },
  device_addr: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '通讯地址',
  },
  device_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '电表名称',
  },
  forward_active_energy: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: true,
    comment: '正向有功总电能(kWh)',
  },
  forward_reactive_energy: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: true,
    comment: '正向无功总电能(kvarh)',
  },
  reverse_active_energy: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: true,
    comment: '反向有功总电能(kWh)',
  },
  reverse_reactive_energy: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: true,
    comment: '反向无功总电能(kvarh)',
  },
  raw_data: {
    type: DataTypes.TEXT,
    comment: '原始数据片段(调试用)',
  },
}, {
  tableName: 'task_energy_meter_data',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['reading_date'] },
    { fields: ['device_addr'] },
    { fields: ['task_setting_id'] },
    { fields: ['reading_date', 'device_addr'], unique: true },
  ],
})

export default EnergyMeterData
