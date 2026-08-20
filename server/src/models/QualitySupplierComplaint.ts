import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP = { 0: '已创建', 1: '已发出', 2: '已回复', 3: '已关闭' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const QualitySupplierComplaint = sequelize.define('QualitySupplierComplaint', {
  complaint_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '供应商投诉ID',
  },
  complaint_no: {
    type: DataTypes.STRING(50),
    unique: true,
    comment: '投诉编号（前缀GY+日期+序号）',
  },
  supplier_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '供应商ID',
  },
  supplier_name: {
    type: DataTypes.STRING(200),
    comment: '供应商名称（冗余）',
  },
  complaint_type: {
    type: DataTypes.STRING(30),
    comment: '投诉类型：质量问题/交付问题/服务问题等',
  },
  complaint_reason: {
    type: DataTypes.TEXT,
    comment: '投诉原因描述',
  },
  related_inspection_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '关联来料检验ID',
  },
  related_inspection_no: {
    type: DataTypes.STRING(50),
    comment: '关联来料检验单号（冗余）',
  },
  complaint_date: {
    type: DataTypes.DATE,
    comment: '投诉日期',
  },
  pdf_path: {
    type: DataTypes.STRING(500),
    comment: 'PDF投诉单路径',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    index: true,
    comment: '状态：0=已创建, 1=已发出, 2=已回复, 3=已关闭',
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
  reply_content: {
    type: DataTypes.TEXT,
    comment: '供应商回复内容',
  },
  reply_date: {
    type: DataTypes.DATE,
    comment: '回复日期',
  },
  reply_by: {
    type: DataTypes.STRING(50),
    comment: '回复人',
  },
  created_by: {
    type: DataTypes.INTEGER,
    comment: '创建人ID',
  },
  created_by_name: {
    type: DataTypes.STRING(50),
    comment: '创建人姓名（冗余）',
  },
  closed_by: {
    type: DataTypes.INTEGER,
    comment: '关闭人ID',
  },
  closed_by_name: {
    type: DataTypes.STRING(50),
    comment: '关闭人姓名（冗余）',
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
  tableName: 'quality_supplier_complaint',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['complaint_no'], unique: true },
    { fields: ['supplier_id'] },
    { fields: ['related_inspection_id'] },
    { fields: ['status'] },
    { fields: ['complaint_date'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default QualitySupplierComplaint