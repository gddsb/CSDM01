import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP = { 0: '待检', 1: '已完成', 2: '漏检' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceInspectionPlan = sequelize.define('DeviceInspectionPlan', {
  plan_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '点检计划ID',
  },
  plan_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    index: true,
    comment: '点检日期',
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '设备ID',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },
  inspector_id: { type: DataTypes.INTEGER, comment: '点检人ID' },
  inspector_name: { type: DataTypes.STRING(50), comment: '点检人姓名（冗余）' },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '状态：0=待检, 1=已完成, 2=漏检',
    get() {
      const val = this.getDataValue('status')
      return STATUS_MAP[val] !== undefined ? STATUS_MAP[val] : val
    },
    set(val: any) {
      if (typeof val === 'string') {
        this.setDataValue('status', STATUS_REVERSE[val] !== undefined ? STATUS_REVERSE[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  inspection_time: { type: DataTypes.DATE, comment: '实际点检时间' },
  result: { type: DataTypes.STRING(20), comment: '总结果：正常/异常' },
  abnormal_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: '异常项数' },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_inspection_plan',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['plan_date'] },
    { fields: ['device_id'] },
    { fields: ['status'] },
    { fields: ['inspector_id'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default DeviceInspectionPlan
