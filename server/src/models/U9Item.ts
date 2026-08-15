import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 采集档案表 task_item
 * 字段命名与业务主表 bas_material 完全对齐（便于直接迁移）
 * 采集表与业务主表的字段差异：
 *   - 采集表保留 item_id（INT PK）、task_id、main_category_code（业务源字段）
 *   - 采集表数据类型统一为 STRING（U9 HTML 抓取的原始字符串格式，迁移时再做类型转换）
 */
const U9Item = sequelize.define('U9Item', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '采集记录ID',
  },
  task_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '来源同步任务ID',
  },
  main_category_code: {
    type: DataTypes.STRING(100),
    comment: '主分类代码（U9来源字段）',
  },
  // ===== 以下字段命名、含义与 bas_material 完全一致 =====
  category_name: {
    type: DataTypes.STRING(200),
    comment: '分类名称',
  },
  material_code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '料号（= 业务主表 material_code）',
  },
  material_name: {
    type: DataTypes.STRING(500),
    comment: '品名（= 业务主表 material_name）',
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
  version_no: {
    type: DataTypes.STRING(50),
    comment: '版本号（对齐 bas_material.version_no）',
  },
  barcode: {
    type: DataTypes.STRING(100),
    comment: '条形码',
  },
  cutting_size: {
    type: DataTypes.STRING(200),
    comment: '开料尺寸',
  },
  printing_process: {
    type: DataTypes.STRING(200),
    comment: '印刷工艺（对齐 bas_material.printing_process）',
  },
  color_separation: {
    type: DataTypes.STRING(200),
    comment: '分色信息（对齐 bas_material.color_separation）',
  },
  blanking_diameter: {
    type: DataTypes.STRING(100),
    comment: '落料直径（对齐 bas_material.blanking_diameter，原始字符串，迁移时转 DECIMAL）',
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
  unit_weight: {
    type: DataTypes.STRING(100),
    comment: '单位重量（对齐 bas_material.unit_weight）',
  },
  unit_volume: {
    type: DataTypes.STRING(100),
    comment: '单位体积（对齐 bas_material.unit_volume）',
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
    comment: '是否生效（0/1，迁移时转 BOOLEAN）',
  },
  effective_date: {
    type: DataTypes.STRING(50),
    comment: '生效日期',
  },
  expiry_date: {
    type: DataTypes.STRING(50),
    comment: '失效日期（对齐 bas_material.expiry_date）',
  },
}, {
  tableName: 'task_item',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['material_code'], unique: true, name: 'uk_task_item_material_code' },
    { fields: ['task_id'] },
    { fields: ['material_name'] },
    { fields: ['category_name'] },
  ],
})

export default U9Item
