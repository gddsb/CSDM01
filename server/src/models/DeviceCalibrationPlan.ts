import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP: Record<number, string> = { 0: '待校准', 1: '已校准', 2: '已超期', 3: '已锁定' }
const STATUS_REVERSE: Record<string, number> = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceCalibrationPlan = sequelize.define('DeviceCalibrationPlan', {
  plan_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asset_id: { type: DataTypes.INTEGER, allowNull: false, comment: '资产ID（设备/仪器统一）' },
  asset_code: { type: DataTypes.STRING(50), comment: '资产编号（冗余）' },
  asset_name: { type: DataTypes.STRING(100), comment: '资产名称（冗余）' },
  calibration_cycle: { type: DataTypes.INTEGER, allowNull: false, comment: '校准周期（月）' },
  last_calibration_date: { type: DataTypes.DATEONLY },
  next_calibration_date: { type: DataTypes.DATEONLY, index: true },
  calibration_org: { type: DataTypes.STRING(200) },
  calibration_items: { type: DataTypes.JSON },
  status: {
    type: DataTypes.TINYINT, defaultValue: 0, index: true,
    get() { const v = this.getDataValue('status'); return STATUS_MAP[v] !== undefined ? STATUS_MAP[v] : v },
    set(v: any) {
      if (typeof v === 'string') this.setDataValue('status', STATUS_REVERSE[v] !== undefined ? STATUS_REVERSE[v] : 0)
      else this.setDataValue('status', v)
    },
  },
  remarks: { type: DataTypes.STRING(500) },
}, {
  tableName: 'device_calibration_plan',
  timestamps: true, underscored: true,
  indexes: [
    { fields: ['asset_id'] },
    { fields: ['next_calibration_date'] },
    { fields: ['status'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default DeviceCalibrationPlan
