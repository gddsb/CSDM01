import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const PRODUCT_INSPECTION_PREFIX = {
  '首件': 'SJ',
  '制程': 'ZC',
  '成品': 'CP',
  '其它': 'QT',
}

const STATUS_MAP = { 0: '待检', 1: '检验中', 2: '审核中', 3: '已完成', 4: '已关闭' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const ProductInspection = sequelize.define('ProductInspection', {
  inspection_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '产品检测ID',
  },
  inspection_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '检验编号（按类型两位前缀+日期+序号）',
  },
  inspection_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    index: true,
    comment: '检验类型：首件/制程/成品/其它',
  },
  report_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '关联报工单ID',
  },
  report_order_no: {
    type: DataTypes.STRING(50),
    comment: '报工单号（冗余）',
  },
  material_id: {
    type: DataTypes.UUID,
    comment: '料品ID（从报工单带出）',
  },
  material_code: {
    type: DataTypes.STRING(50),
    comment: '料号（从报工单带出，冗余）',
  },
  material_name: {
    type: DataTypes.STRING(200),
    comment: '产品名称/料品名称（从报工单带出，冗余）',
  },
  specification: {
    type: DataTypes.STRING(200),
    comment: '规格（从报工单带出，冗余）',
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
  tableName: 'quality_product_inspection',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['inspection_no'], unique: true },
    { fields: ['inspection_type'] },
    { fields: ['report_order_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] },
  ],
})

export { PRODUCT_INSPECTION_PREFIX, STATUS_MAP, STATUS_REVERSE }
export default ProductInspection
