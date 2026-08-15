import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ITEM_RESULT_MAP = { 0: '不合格', 1: '合格' }
const ITEM_RESULT_REVERSE = Object.fromEntries(Object.entries(ITEM_RESULT_MAP).map(([k, v]) => [v, Number(k)]))

const ProductInspectionItem = sequelize.define('ProductInspectionItem', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '检测项目ID',
  },
  inspection_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '关联产品检测主表ID',
  },
  item_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '检测项目名称',
  },
  standard_value: {
    type: DataTypes.STRING(500),
    comment: '项目标准值',
  },
  actual_value: {
    type: DataTypes.STRING(500),
    comment: '项目检测值',
  },
  result: {
    type: DataTypes.TINYINT,
    index: true,
    comment: '项目判定结果：0=不合格, 1=合格',
    get() {
      const val = this.getDataValue('result')
      return ITEM_RESULT_MAP[val] !== undefined ? ITEM_RESULT_MAP[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('result', ITEM_RESULT_REVERSE[val] !== undefined ? ITEM_RESULT_REVERSE[val] : null)
      } else {
        this.setDataValue('result', val)
      }
    },
  },
  inspector_id: {
    type: DataTypes.INTEGER,
    comment: '项目检测人ID',
  },
  inspector_name: {
    type: DataTypes.STRING(50),
    comment: '项目检测人姓名（冗余）',
  },
  inspection_time: {
    type: DataTypes.DATE,
    comment: '项目检测时间',
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '项目分类(大类)',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
}, {
  tableName: 'quality_product_inspection_item',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['inspection_id'] },
    { fields: ['result'] },
  ],
})

export { ITEM_RESULT_MAP, ITEM_RESULT_REVERSE }
export default ProductInspectionItem
