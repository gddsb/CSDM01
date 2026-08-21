import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP = { 0: '待校准', 1: '已校准', 2: '已超期', 3: '已锁定' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceCalibrationPlan = sequelize.define('DeviceCalibrationPlan', {
  plan_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
    comment: '校准计划ID',
  },
  device_id: {
    type: DataTypes.INTEGER, allowNull: false, index: true,
    comment: '设备ID（计量器具）',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },
  calibration_cycle: {
    type: DataTypes.INTEGER, allowNull: false,
    comment: '校准周期（月），如：6、12',
  },
  last_calibration_date: {
    type: DataTypes.DATEONLY,
    comment: '上次校准日期',
  },
  next_calibration_date: {
    type: DataTypes.DATEONLY, index: true,
    comment: '下次校准日期（自动计算）',
  },
  calibration_org: {
    type: DataTypes.STRING(200),
    comment: '校准机构（外部）',
  },
  calibration_items: {
    type: DataTypes.JSON,
    comment: '校准项目JSON：[{item_name, standard_value}]',
  },
  status: {
    type: DataTypes.TINYINT, defaultValue: 0, index: true,
    comment: '状态：0=待校准, 1=已校准, 2=已超期, 3=已锁定',
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
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_calibration_plan',
  timestamps: true, underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['next_calibration_date'] },
    { fields: ['status'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default DeviceCalibrationPlan
