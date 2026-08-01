import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface EnergyMeterDataAttributes {
  id: number;
  taskSettingId: number;
  deviceAddr: string;
  deviceName: string;
  forwardActiveEnergy: number;
  forwardReactiveEnergy: number;
  reverseActiveEnergy: number;
  reverseReactiveEnergy: number;
  recordTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

type EnergyMeterDataCreationAttributes = Optional<EnergyMeterDataAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class EnergyMeterData extends Model<EnergyMeterDataAttributes, EnergyMeterDataCreationAttributes> {
  declare id: number;
  declare taskSettingId: number;
  declare deviceAddr: string;
  declare deviceName: string;
  declare forwardActiveEnergy: number;
  declare forwardReactiveEnergy: number;
  declare reverseActiveEnergy: number;
  declare reverseReactiveEnergy: number;
  declare recordTime: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

EnergyMeterData.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    taskSettingId: {
      type: DataTypes.INTEGER.UNSIGNED,
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
  },
  {
    sequelize,
    tableName: 'u9_energy_meter_data',
    indexes: [
      { fields: ['taskSettingId'] },
      { fields: ['deviceAddr'] },
      { fields: ['recordTime'] },
      { unique: true, fields: ['taskSettingId', 'deviceAddr', 'recordTime'] },
    ],
  },
);

export default EnergyMeterData;
