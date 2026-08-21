import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DeviceInspectionStandard = sequelize.define('DeviceInspectionStandard', {
  standard_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '点检标准ID',
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '设备ID',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },
  item_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '点检项目名称（如：温度、振动、油位）',
  },
  standard_value: {
    type: DataTypes.STRING(200),
    comment: '标准值（如：≤60℃、正常、无异响）',
  },
  judge_type: {
    type: DataTypes.STRING(20),
    defaultValue: '定性',
    comment: '判定方式：定性（正常/异常）、定量（数值范围）',
  },
  unit: { type: DataTypes.STRING(30), comment: '单位' },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0, comment: '排序' },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：1启用, 0禁用',
  },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_inspection_standard',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['device_id'] }],
})

export default DeviceInspectionStandard
