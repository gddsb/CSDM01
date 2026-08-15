import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP = { 0: '待检', 1: '检验中', 2: '审核中', 3: '已完成', 4: '已关闭' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const IncomingInspection = sequelize.define('IncomingInspection', {
  inspection_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '来料检验ID',
  },
  inspection_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '检验编号（前缀LL+日期+序号）',
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
  supplier_code: {
    type: DataTypes.STRING(50),
    comment: '供应商编码（冗余）',
  },
  material_id: {
    type: DataTypes.UUID,
    comment: '料品ID',
  },
  material_code: {
    type: DataTypes.STRING(50),
    comment: '料号（冗余）',
  },
  material_name: {
    type: DataTypes.STRING(200),
    comment: '料品名称（冗余）',
  },
  specification: {
    type: DataTypes.STRING(200),
    comment: '规格（冗余）',
  },
  supplier_batch_no: {
    type: DataTypes.STRING(50),
    comment: '供应商批次号',
  },
  internal_batch_no: {
    type: DataTypes.STRING(50),
    comment: '内部批次号',
  },
  quantity: {
    type: DataTypes.DECIMAL(15, 4),
    comment: '到货数量',
  },
  arrival_date: {
    type: DataTypes.DATE,
    comment: '到货日期',
  },
  receipt_id: {
    type: DataTypes.INTEGER,
    comment: '关联采购收货采集表ID（task_purchase_receipt.receipt_id）',
  },
  receipt_no: {
    type: DataTypes.STRING(100),
    comment: '采购收货单号（冗余）',
  },
  line_no: {
    type: DataTypes.STRING(50),
    comment: '采购收货单行号（冗余，用于与 receipt_no 构成唯一标识）',
  },
  receipt_status: {
    type: DataTypes.STRING(100),
    comment: '采购收货单据状态（冗余，如业务关闭/开立/审核等）',
  },
  standard_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '关联检验标准ID',
  },
  standard_name: {
    type: DataTypes.STRING(200),
    comment: '检验标准名称（冗余）',
  },
  result: {
    type: DataTypes.STRING(20),
    comment: '总结果：合格/不合格',
  },
  handle_type: {
    type: DataTypes.STRING(50),
    comment: '处理方式',
  },
  handle_reason: {
    type: DataTypes.STRING(500),
    comment: '处理原因',
  },
  trigger_type: {
    type: DataTypes.STRING(20),
    defaultValue: '手工',
    comment: '触发方式：自动/手工',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    index: true,
    comment: '状态：0=待检, 1=检验中, 2=审核中, 3=已完成, 4=已关闭',
    get() {
      const val = this.getDataValue('status')
      return STATUS_MAP[val] !== undefined ? STATUS_MAP[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('status', STATUS_REVERSE[val] !== undefined ? STATUS_REVERSE[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  inspector_id: {
    type: DataTypes.INTEGER,
    comment: '检验人ID',
  },
  inspector_name: {
    type: DataTypes.STRING(50),
    comment: '检验人姓名（冗余）',
  },
  reviewer_id: {
    type: DataTypes.INTEGER,
    comment: '审核人ID',
  },
  reviewer_name: {
    type: DataTypes.STRING(50),
    comment: '审核人姓名（冗余）',
  },
  inspection_time: {
    type: DataTypes.DATE,
    comment: '检验时间',
  },
  review_time: {
    type: DataTypes.DATE,
    comment: '审核时间',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
}, {
  tableName: 'quality_incoming_inspection',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['inspection_no'], unique: true },
    { fields: ['receipt_id'] },
    { fields: ['receipt_no', 'line_no'], name: 'idx_ii_receipt_line' },
    { fields: ['supplier_id'] },
    { fields: ['material_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default IncomingInspection
