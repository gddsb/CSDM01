import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 设备/仪器校准计划表
 * 为每台需要校准的仪器/设备生成一条校准计划，记录周期和下次校准日期。
 * 与 DeviceCalibrationRecord（校准执行记录）通过 plan_id 关联。
 */
const STATUS_MAP: Record<number, string> = { 0: '待校准', 1: '已校准', 2: '已超期', 3: '已锁定' }
const STATUS_REVERSE: Record<string, number> = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceCalibrationPlan = sequelize.define('DeviceCalibrationPlan', {
  plan_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
    comment: '校准计划ID（主键）',
  },
  asset_id: {
    type: DataTypes.INTEGER, allowNull: false,
    comment: '资产ID（关联 master_device.device_id，设备/仪器统一）',
  },
  asset_code: {
    type: DataTypes.STRING(50),
    comment: '资产编号（冗余，来自 master_device.device_code）',
  },
  asset_name: {
    type: DataTypes.STRING(100),
    comment: '资产名称（冗余，来自 master_device.device_name）',
  },
  calibration_cycle: {
    type: DataTypes.INTEGER, allowNull: false,
    comment: '校准周期（月，如 12=每年校准一次）',
  },
  last_calibration_date: {
    type: DataTypes.DATEONLY,
    comment: '上次校准完成日期（从最新一条 CalibrationRecord 回填）',
  },
  next_calibration_date: {
    type: DataTypes.DATEONLY, index: true,
    comment: '下次应校准日期（到期前系统提醒）',
  },
  calibration_org: {
    type: DataTypes.STRING(200),
    comment: '建议/默认校准机构（如 国家计量院 / 内部计量室）',
  },
  calibration_items: {
    type: DataTypes.JSON,
    comment: '校准项目明细（JSON 数组，每项含 {name, requirement, method}）',
  },
  status: {
    type: DataTypes.TINYINT, defaultValue: 0, index: true,
    comment: '计划状态：0=待校准, 1=已校准, 2=已超期, 3=已锁定（停用）',
    get() { const v = this.getDataValue('status'); return STATUS_MAP[v] !== undefined ? STATUS_MAP[v] : v },
    set(v: any) {
      if (typeof v === 'string') this.setDataValue('status', STATUS_REVERSE[v] !== undefined ? STATUS_REVERSE[v] : 0)
      else this.setDataValue('status', v)
    },
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注说明（特殊校准要求等）',
  },
}, {
  tableName: 'device_calibration_plan',
  timestamps: true, underscored: true,
  indexes: [
    { fields: ['asset_id'] },
    { fields: ['next_calibration_date'] },
    { fields: ['status'] },
  ],
  comment: '设备/仪器校准计划表：管理每台资产的校准周期和计划状态',
})

export { STATUS_MAP, STATUS_REVERSE }
export default DeviceCalibrationPlan
