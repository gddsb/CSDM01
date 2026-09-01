import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 设备保养执行记录（统一版）
 * 合并旧的 DeviceInspectionPlan + DeviceInspectionRecord + DeviceMaintenanceRecord。
 * 一条执行记录对应模板矩阵中的一个格子（某标准 × 某时间周期）。
 *
 * 用 (standard_id, period_key) 做业务唯一约束，避免重复生成。
 * period_key 编码规则：
 *   daily   → 'YYYY-MM-DD'
 *   weekly  → 'YYYY-Www'（ISO 周号，如 2026-W36）
 *   monthly → 'YYYY-MM'
 *   runtime → 'RUNTIME:{device_id}:{threshold}'（同一标准每次触发会推进 last_trigger_value，所以会自然不同）
 */
const STATUS_MAP = { 0: '待执行', 1: '执行中', 2: '已完成', 3: '跳过' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceMaintenanceRecord = sequelize.define('DeviceMaintenanceRecord', {
  record_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '执行记录ID',
  },
  record_no: {
    type: DataTypes.STRING(50),
    unique: true,
    comment: '记录编号（BM + YYYYMMDD + 3位序号，自动生成）',
  },

  standard_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '关联保养标准ID',
  },

  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '设备ID',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },

  // ===== 执行定位 =====
  trigger_mode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '执行时的触发频率快照：daily / weekly / monthly / runtime',
  },
  period_key: {
    type: DataTypes.STRING(30),
    allowNull: false,
    index: true,
    comment: '周期键：日期/周号/月号，用于定位矩阵中的格子',
  },

  // ===== 执行人/时间 =====
  executor_id: { type: DataTypes.INTEGER, comment: '执行人ID' },
  executor_name: { type: DataTypes.STRING(50), comment: '执行人姓名（冗余）' },
  start_time: { type: DataTypes.DATE, comment: '执行开始时间' },
  end_time: { type: DataTypes.DATE, comment: '执行结束时间' },
  duration_min: {
    type: DataTypes.INTEGER,
    comment: '总耗时（分钟）',
  },

  // ===== 执行结果 =====
  actual_value: { type: DataTypes.STRING(200), comment: '实测值（定量型）' },
  result: {
    type: DataTypes.STRING(20),
    comment: '执行结果：正常 / 异常',
  },
  abnormal_desc: { type: DataTypes.STRING(500), comment: '异常描述（执行结果为异常时）' },

  // ===== 维护专属 =====
  spare_parts_used: {
    type: DataTypes.JSON,
    comment: '使用备件 JSON：[{name, quantity, unit_price}]',
  },
  maintenance_content: {
    type: DataTypes.TEXT,
    comment: '保养/维护内容记录',
  },

  // ===== 状态机 =====
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '状态：0=待执行, 1=执行中, 2=已完成, 3=跳过',
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
  tableName: 'device_record',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['record_no'], unique: true },
    { fields: ['device_id'] },
    { fields: ['standard_id'] },
    { fields: ['status'] },
    { fields: ['trigger_mode'] },
    { fields: ['period_key'] },
    { name: 'idx_standard_period', fields: ['standard_id', 'period_key'], unique: true },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default DeviceMaintenanceRecord
