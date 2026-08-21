import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP = { 0: '待派工', 1: '维修中', 2: '待审批', 3: '已关闭', 4: '已挂起' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const LEVEL_MAP = { 1: '一般', 2: '严重', 3: '紧急' }
const LEVEL_REVERSE = Object.fromEntries(Object.entries(LEVEL_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceFault = sequelize.define('DeviceFault', {
  fault_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '故障ID',
  },
  fault_no: {
    type: DataTypes.STRING(50),
    unique: true,
    comment: '故障编号（前缀F+日期+序号）',
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '设备ID',
  },
  device_code: {
    type: DataTypes.STRING(50),
    comment: '设备编号（冗余）',
  },
  device_name: {
    type: DataTypes.STRING(100),
    comment: '设备名称（冗余）',
  },
  fault_level: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '故障等级：1=一般, 2=严重, 3=紧急',
    get() {
      const val = this.getDataValue('fault_level')
      return LEVEL_MAP[val] !== undefined ? LEVEL_MAP[val] : val
    },
    set(val: any) {
      if (typeof val === 'string') {
        this.setDataValue('fault_level', LEVEL_REVERSE[val] !== undefined ? LEVEL_REVERSE[val] : 1)
      } else {
        this.setDataValue('fault_level', val)
      }
    },
  },
  fault_desc: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '故障现象描述',
  },
  fault_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '故障发生时间',
  },
  impact_desc: {
    type: DataTypes.STRING(500),
    comment: '影响描述',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    index: true,
    comment: '状态：0=待派工, 1=维修中, 2=待审批, 3=已关闭, 4=已挂起',
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
  reporter_id: {
    type: DataTypes.INTEGER,
    comment: '上报人ID',
  },
  reporter_name: {
    type: DataTypes.STRING(50),
    comment: '上报人姓名（冗余）',
  },
  repairer_id: {
    type: DataTypes.INTEGER,
    comment: '维修人ID',
  },
  repairer_name: {
    type: DataTypes.STRING(50),
    comment: '维修人姓名（冗余）',
  },
  assigned_time: {
    type: DataTypes.DATE,
    comment: '派工时间',
  },
  repair_start_time: {
    type: DataTypes.DATE,
    comment: '维修开始时间',
  },
  repair_end_time: {
    type: DataTypes.DATE,
    comment: '维修结束时间',
  },
  approver_id: {
    type: DataTypes.INTEGER,
    comment: '审批人ID',
  },
  approver_name: {
    type: DataTypes.STRING(50),
    comment: '审批人姓名（冗余）',
  },
  approve_time: {
    type: DataTypes.DATE,
    comment: '审批时间',
  },
  approve_remark: {
    type: DataTypes.STRING(500),
    comment: '审批意见',
  },
  source: {
    type: DataTypes.STRING(20),
    defaultValue: '手工',
    comment: '来源：手工上报/点检异常自动创建',
  },
  related_inspection_id: {
    type: DataTypes.INTEGER,
    comment: '关联点检记录ID（点检异常自动创建时）',
  },
  closed_time: {
    type: DataTypes.DATE,
    comment: '关闭时间',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
}, {
  tableName: 'device_fault',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['fault_no'], unique: true },
    { fields: ['device_id'] },
    { fields: ['status'] },
    { fields: ['fault_level'] },
    { fields: ['fault_time'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE, LEVEL_MAP, LEVEL_REVERSE }
export default DeviceFault
