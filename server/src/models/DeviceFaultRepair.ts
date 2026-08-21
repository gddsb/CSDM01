import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const APPROVE_STATUS_MAP = { 0: '待审批', 1: '已通过', 2: '已驳回' }
const APPROVE_STATUS_REVERSE = Object.fromEntries(Object.entries(APPROVE_STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const DeviceFaultRepair = sequelize.define('DeviceFaultRepair', {
  repair_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '维修记录ID',
  },
  fault_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '关联故障ID',
  },
  fault_cause: {
    type: DataTypes.TEXT,
    comment: '故障原因分析',
  },
  repair_plan: {
    type: DataTypes.TEXT,
    comment: '维修方案',
  },
  repair_detail: {
    type: DataTypes.TEXT,
    comment: '维修过程详细记录',
  },
  spare_parts_used: {
    type: DataTypes.JSON,
    comment: '使用备件列表JSON：[{spare_part_id, name, quantity, unit_price}]',
  },
  spare_parts_cost: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '备件费用合计',
  },
  labor_hours: {
    type: DataTypes.DECIMAL(8, 2),
    defaultValue: 0,
    comment: '维修工时（小时）',
  },
  labor_rate: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '人工时薪（元/小时）',
  },
  labor_cost: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '人工成本',
  },
  external_cost: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '外协费用',
  },
  total_cost: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '总维修成本（备件+人工+外协）',
  },
  approve_status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '审批状态：0=待审批, 1=已通过, 2=已驳回',
    get() {
      const val = this.getDataValue('approve_status')
      return APPROVE_STATUS_MAP[val] !== undefined ? APPROVE_STATUS_MAP[val] : val
    },
    set(val: any) {
      if (typeof val === 'string') {
        this.setDataValue('approve_status', APPROVE_STATUS_REVERSE[val] !== undefined ? APPROVE_STATUS_REVERSE[val] : 0)
      } else {
        this.setDataValue('approve_status', val)
      }
    },
  },
  approver_id: {
    type: DataTypes.INTEGER,
    comment: '审批人ID',
  },
  approver_name: {
    type: DataTypes.STRING(50),
    comment: '审批人姓名',
  },
  approve_time: {
    type: DataTypes.DATE,
    comment: '审批时间',
  },
  approve_remark: {
    type: DataTypes.STRING(500),
    comment: '审批意见',
  },
}, {
  tableName: 'device_fault_repair',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['fault_id'] },
  ],
})

export { APPROVE_STATUS_MAP, APPROVE_STATUS_REVERSE }
export default DeviceFaultRepair
