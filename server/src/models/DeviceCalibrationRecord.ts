import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const RESULT_MAP: Record<number, string> = { 1: '合格', 2: '不合格' }
const RESULT_REVERSE: Record<string, number> = Object.fromEntries(Object.entries(RESULT_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceCalibrationRecord = sequelize.define('DeviceCalibrationRecord', {
  record_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plan_id: { type: DataTypes.INTEGER, allowNull: false, index: true },
  asset_id: { type: DataTypes.INTEGER, comment: '资产ID' },
  asset_code: { type: DataTypes.STRING(50) },
  asset_name: { type: DataTypes.STRING(100) },
  calibration_date: { type: DataTypes.DATEONLY, allowNull: false },
  calibration_org: { type: DataTypes.STRING(200) },
  calibration_result: {
    type: DataTypes.TINYINT, allowNull: false,
    get() { const v = this.getDataValue('calibration_result'); return RESULT_MAP[v] !== undefined ? RESULT_MAP[v] : v },
    set(v: any) {
      if (typeof v === 'string') this.setDataValue('calibration_result', RESULT_REVERSE[v] !== undefined ? RESULT_REVERSE[v] : 1)
      else this.setDataValue('calibration_result', v)
    },
  },
  certificate_no: { type: DataTypes.STRING(100) },
  certificate_path: { type: DataTypes.STRING(500) },
  valid_until: { type: DataTypes.DATEONLY },
  cost: { type: DataTypes.DECIMAL(12, 2) },
  calibration_items: { type: DataTypes.JSON },
  operator_id: { type: DataTypes.INTEGER },
  operator_name: { type: DataTypes.STRING(50) },
  remarks: { type: DataTypes.STRING(500) },
}, {
  tableName: 'device_calibration_record',
  timestamps: true, underscored: true,
  indexes: [{ fields: ['plan_id'] }, { fields: ['asset_id'] }, { fields: ['calibration_date'] }],
})

export { RESULT_MAP, RESULT_REVERSE }
export default DeviceCalibrationRecord
