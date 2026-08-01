import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EnergyMeterData = sequelize.define('EnergyMeterData', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  taskSettingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联任务设置ID',
  },
  deviceAddr: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '电表通讯地址',
  },
  deviceName: {
    type: DataTypes.STRING(128),
    allowNull: true,
    comment: '电表名称',
  },
  forwardActiveEnergy: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    defaultValue: 0,
    comment: '正向有功总电能 kWh',
  },
  forwardReactiveEnergy: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    defaultValue: 0,
    comment: '正向无功总电能 kvarh',
  },
  reverseActiveEnergy: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    defaultValue: 0,
    comment: '反向有功总电能 kWh',
  },
  reverseReactiveEnergy: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    defaultValue: 0,
    comment: '反向无功总电能 kvarh',
  },
  recordTime: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '数据记录时间',
  },
}, {
  sequelize,
  tableName: 'u9_energy_meter_data',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['task_setting_id'] },
    { fields: ['device_addr'] },
    { fields: ['record_time'] },
    { unique: true, fields: ['task_setting_id', 'device_addr', 'record_time'] },
  ],
});

export default EnergyMeterData;
