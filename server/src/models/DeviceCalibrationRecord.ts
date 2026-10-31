import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 设备/仪器校准执行记录表
 * 记录每次实际校准的结果、证书、费用等。
 * 通过 plan_id 关联 DeviceCalibrationPlan，每次校准完成后回填 plan 的 last_calibration_date。
 */
const RESULT_MAP: Record<number, string> = { 1: '合格', 2: '不合格' }
const RESULT_REVERSE: Record<string, number> = Object.fromEntries(Object.entries(RESULT_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceCalibrationRecord = sequelize.define('DeviceCalibrationRecord', {
  record_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
    comment: '校准记录ID（主键）',
  },
  plan_id: {
    type: DataTypes.INTEGER, allowNull: false, index: true,
    comment: '校准计划ID（关联 device_calibration_plan.plan_id）',
  },
  asset_id: {
    type: DataTypes.INTEGER,
    comment: '资产ID（冗余，关联 master_device.device_id）',
  },
  asset_code: {
    type: DataTypes.STRING(50),
    comment: '资产编号（冗余，来自 master_device.device_code）',
  },
  asset_name: {
    type: DataTypes.STRING(100),
    comment: '资产名称（冗余，来自 master_device.device_name）',
  },
  calibration_date: {
    type: DataTypes.DATEONLY, allowNull: false,
    comment: '校准完成日期（YYYY-MM-DD）',
  },
  calibration_org: {
    type: DataTypes.STRING(200),
    comment: '实际校准机构名称（如 国家计量院 XX 分所）',
  },
  calibration_result: {
    type: DataTypes.TINYINT, allowNull: false,
    comment: '校准结果：1=合格（出校准证书）, 2=不合格（需整改或报废）',
    get() { const v = this.getDataValue('calibration_result'); return RESULT_MAP[v] !== undefined ? RESULT_MAP[v] : v },
    set(v: any) {
      if (typeof v === 'string') this.setDataValue('calibration_result', RESULT_REVERSE[v] !== undefined ? RESULT_REVERSE[v] : 1)
      else this.setDataValue('calibration_result', v)
    },
  },
  certificate_no: {
    type: DataTypes.STRING(100),
    comment: '校准证书编号（合格时由机构颁发的唯一编号）',
  },
  certificate_path: {
    type: DataTypes.STRING(500),
    comment: '校准证书文件存储路径（PDF 上传后归档位置）',
  },
  valid_until: {
    type: DataTypes.DATEONLY,
    comment: '校准证书有效期（到期后需重新校准）',
  },
  cost: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '校准费用（元，用于成本核算）',
  },
  calibration_items: {
    type: DataTypes.JSON,
    comment: '实际校准项目结果（JSON 数组，每项含 {item_name, result, requirement}）',
  },
  operator_id: {
    type: DataTypes.INTEGER,
    comment: '系统录入人ID（操作人，关联 sys_user.user_id）',
  },
  operator_name: {
    type: DataTypes.STRING(50),
    comment: '系统录入人姓名（冗余，方便查询）',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注说明（不合格时的整改情况等）',
  },
}, {
  tableName: 'device_calibration_record',
  timestamps: true, underscored: true,
  indexes: [{ fields: ['plan_id'] }, { fields: ['asset_id'] }, { fields: ['calibration_date'] }],
  comment: '设备/仪器校准执行记录表：记录每次校准结果、证书、费用等',
})

export { RESULT_MAP, RESULT_REVERSE }
export default DeviceCalibrationRecord
