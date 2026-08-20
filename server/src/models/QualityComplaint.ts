import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP: Record<number, string> = { 0: '处理中', 1: '已关闭' }
const STATUS_REVERSE: Record<string, number> = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)])
)

const QualityComplaint = sequelize.define('QualityComplaint', {
  complaint_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '客诉ID',
  },
  complaint_no: {
    type: DataTypes.STRING(50),
    unique: true,
    comment: '客诉编号（前缀TS+日期+序号）',
  },
  source: {
    type: DataTypes.STRING(50),
    comment: '来源：客户投诉/监管抽查/内部发现等',
  },
  customer_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '客户ID',
  },
  customer_name: {
    type: DataTypes.STRING(200),
    comment: '客户名称（冗余）',
  },
  contact_person: {
    type: DataTypes.STRING(50),
    comment: '联系人',
  },
  contact_phone: {
    type: DataTypes.STRING(30),
    comment: '联系电话',
  },
  material_id: {
    type: DataTypes.UUID,
    comment: '料品ID',
  },
  material_name: {
    type: DataTypes.STRING(200),
    comment: '料品名称（冗余）',
  },
  batch_no: {
    type: DataTypes.STRING(50),
    comment: '批号/工单号',
  },
  complaint_type: {
    type: DataTypes.STRING(30),
    comment: '投诉问题分类：质量问题/服务问题/交付问题等',
  },
  complaint_desc: {
    type: DataTypes.TEXT,
    comment: '投诉描述',
  },
  complaint_method: {
    type: DataTypes.STRING(30),
    comment: '投诉方式：电话/邮件/传真/现场',
  },
  complaint_time: {
    type: DataTypes.DATE,
    comment: '投诉时间',
  },
  require_reply: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否要求回复：0否, 1是',
  },
  reply_deadline: {
    type: DataTypes.DATE,
    comment: '回复截止日期',
  },
  handle_direction: {
    type: DataTypes.STRING(200),
    comment: '处理方向',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    index: true,
    comment: '状态：0=处理中, 1=已关闭',
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
  handler_id: {
    type: DataTypes.INTEGER,
    comment: '当前处理人ID',
  },
  handler_name: {
    type: DataTypes.STRING(50),
    comment: '当前处理人姓名（冗余）',
  },
  registered_by: {
    type: DataTypes.INTEGER,
    comment: '登记人ID',
  },
  registered_by_name: {
    type: DataTypes.STRING(50),
    comment: '登记人姓名（冗余）',
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
  tableName: 'quality_complaint',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['complaint_no'], unique: true },
    { fields: ['customer_id'] },
    { fields: ['material_id'] },
    { fields: ['status'] },
    { fields: ['complaint_time'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default QualityComplaint
