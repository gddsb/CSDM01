import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const U9Item = sequelize.define('U9Item', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '来源同步任务ID',
  },
  main_category_code: {
    type: DataTypes.STRING(100),
    comment: '主分类代码',
  },
  category_name: {
    type: DataTypes.STRING(200),
    comment: '分类名称',
  },
  item_code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '料号',
  },
  item_name: {
    type: DataTypes.STRING(500),
    comment: '品名',
  },
  specification: {
    type: DataTypes.STRING(500),
    comment: '规格',
  },
  unit_name: {
    type: DataTypes.STRING(100),
    comment: '单位名称',
  },
  film_no: {
    type: DataTypes.STRING(100),
    comment: '菲林编号',
  },
  barcode: {
    type: DataTypes.STRING(100),
    comment: '条形码',
  },
  cutting_size: {
    type: DataTypes.STRING(200),
    comment: '开料尺寸',
  },
  print_process: {
    type: DataTypes.STRING(200),
    comment: '印刷工艺',
  },
  color_info: {
    type: DataTypes.STRING(200),
    comment: '分色信息',
  },
  blank_diameter: {
    type: DataTypes.STRING(100),
    comment: '落料直径',
  },
  material_thickness: {
    type: DataTypes.STRING(100),
    comment: '材料厚度',
  },
  material_width: {
    type: DataTypes.STRING(100),
    comment: '材料宽度',
  },
  material_height: {
    type: DataTypes.STRING(100),
    comment: '材料高度',
  },
  scrap_weight: {
    type: DataTypes.STRING(100),
    comment: '边角料重量',
  },
  stock_unit_weight: {
    type: DataTypes.STRING(100),
    comment: '库存单位重量',
  },
  stock_unit_volume: {
    type: DataTypes.STRING(100),
    comment: '库存单位体积',
  },
  weight_unit: {
    type: DataTypes.STRING(100),
    comment: '重量单位',
  },
  volume_unit: {
    type: DataTypes.STRING(100),
    comment: '体积单位',
  },
  inventory_category: {
    type: DataTypes.STRING(100),
    comment: '存货分类',
  },
  unit_code: {
    type: DataTypes.STRING(100),
    comment: '单位编码',
  },
  is_active: {
    type: DataTypes.TINYINT,
    comment: '是否生效',
  },
  effective_date: {
    type: DataTypes.STRING(50),
    comment: '生效日期',
  },
  expiration_date: {
    type: DataTypes.STRING(50),
    comment: '失效日期',
  },
}, {
  tableName: 'task_item',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['item_code'], unique: true },
    { fields: ['task_id'] },
    { fields: ['item_name'] },
  ],
})

export default U9Item
