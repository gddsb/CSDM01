import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DeviceInspectionRecord = sequelize.define('DeviceInspectionRecord', {
  record_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '点检记录ID',
  },
  plan_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '关联点检计划ID',
  },
  device_id: { type: DataTypes.INTEGER, comment: '设备ID' },
  standard_id: { type: DataTypes.INTEGER, comment: '关联点检标准ID' },
  item_name: { type: DataTypes.STRING(100), comment: '点检项目名称' },
  standard_value: { type: DataTypes.STRING(200), comment: '标准值' },
  actual_value: { type: DataTypes.STRING(200), comment: '实测值/检查结果' },
  judge_type: { type: DataTypes.STRING(20), comment: '判定方式' },
  unit: { type: DataTypes.STRING(30), comment: '单位' },
  result: {
    type: DataTypes.STRING(20),
    comment: '判定结果：正常/异常',
  },
  abnormal_desc: { type: DataTypes.STRING(500), comment: '异常描述' },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0, comment: '排序' },
}, {
  tableName: 'device_inspection_record',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['plan_id'] }],
})

export default DeviceInspectionRecord
