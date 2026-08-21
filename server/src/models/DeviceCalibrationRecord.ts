import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const RESULT_MAP = { 1: '合格', 2: '不合格' }
const RESULT_REVERSE = Object.fromEntries(Object.entries(RESULT_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceCalibrationRecord = sequelize.define('DeviceCalibrationRecord', {
  record_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
  },
  plan_id: {
    type: DataTypes.INTEGER, allowNull: false, index: true,
    comment: '关联校准计划ID',
  },
  device_id: {
    type: DataTypes.INTEGER, index: true,
    comment: '设备ID',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },
  calibration_date: {
    type: DataTypes.DATEONLY, allowNull: false,
    comment: '校准日期',
  },
  calibration_org: { type: DataTypes.STRING(200), comment: '校准机构' },
  calibration_result: {
    type: DataTypes.TINYINT, allowNull: false,
    comment: '校准结果：1=合格, 2=不合格',
    get() {
      const val = this.getDataValue('calibration_result')
      return RESULT_MAP[val] !== undefined ? RESULT_MAP[val] : val
    },
    set(val: any) {
      if (typeof val === 'string') {
        this.setDataValue('calibration_result', RESULT_REVERSE[val] !== undefined ? RESULT_REVERSE[val] : 1)
      } else {
        this.setDataValue('calibration_result', val)
      }
    },
  },
  certificate_no: {
    type: DataTypes.STRING(100),
    comment: '校准证书编号',
  },
  certificate_path: {
    type: DataTypes.STRING(500),
    comment: '校准证书文件路径',
  },
  valid_until: {
    type: DataTypes.DATEONLY,
    comment: '有效期至',
  },
  cost: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '校准费用',
  },
  calibration_items: {
    type: DataTypes.JSON,
    comment: '校准项目及结果JSON',
  },
  operator_id: { type: DataTypes.INTEGER, comment: '操作人ID' },
  operator_name: { type: DataTypes.STRING(50), comment: '操作人姓名' },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_calibration_record',
  timestamps: true, underscored: true,
  indexes: [{ fields: ['plan_id'] }, { fields: ['device_id'] }, { fields: ['calibration_date'] }],
})

export { RESULT_MAP, RESULT_REVERSE }
export default DeviceCalibrationRecord
