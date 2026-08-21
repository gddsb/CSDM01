import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP = { 0: '待执行', 1: '执行中', 2: '已完成', 3: '已挂起' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceMaintenanceRecord = sequelize.define('DeviceMaintenanceRecord', {
  record_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '维护工单ID',
  },
  record_no: {
    type: DataTypes.STRING(50),
    unique: true,
    comment: '工单编号（前缀WH+日期+序号）',
  },
  standard_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '关联维护标准ID',
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '设备ID',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },
  maintenance_type: {
    type: DataTypes.STRING(50),
    comment: '维护类型（如：润滑、更换、检查）',
  },
  trigger_type: {
    type: DataTypes.STRING(20),
    comment: '触发方式：周期/运行时长',
  },
  plan_date: {
    type: DataTypes.DATEONLY,
    comment: '计划日期',
  },
  start_time: { type: DataTypes.DATE, comment: '维护开始时间' },
  end_time: { type: DataTypes.DATE, comment: '维护结束时间' },
  maintenance_content: {
    type: DataTypes.TEXT,
    comment: '维护内容记录',
  },
  spare_parts_used: {
    type: DataTypes.JSON,
    comment: '使用备件JSON：[{spare_part_id, name, quantity, unit_price}]',
  },
  maintenance_result: {
    type: DataTypes.STRING(20),
    comment: '维护结果：正常/异常',
  },
  abnormal_desc: {
    type: DataTypes.STRING(500),
    comment: '异常描述（维护结果为异常时）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '状态：0=待执行, 1=执行中, 2=已完成, 3=已挂起',
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
  maintainer_id: { type: DataTypes.INTEGER, comment: '维护人ID' },
  maintainer_name: { type: DataTypes.STRING(50), comment: '维护人姓名（冗余）' },
  maintenance_hours: {
    type: DataTypes.DECIMAL(8, 2),
    comment: '维护耗时（小时）',
  },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_maintenance_record',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['record_no'], unique: true },
    { fields: ['device_id'] },
    { fields: ['standard_id'] },
    { fields: ['status'] },
    { fields: ['plan_date'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default DeviceMaintenanceRecord
