import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 料品档案表
 * 存储生产用物料/半成品的基础信息，包括尺寸、重量、客户关联等。
 * material_code 来自 U9，是与外部系统同步的关键字段。
 */
const Material = sequelize.define('Material', {
  material_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    comment: '料品ID（UUID 主键，全局唯一）',
  },
  category_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '料品分类名称（如 盖罐头 / 底罐头 / 金属罐）',
  },
  material_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '料品编码（来自 U9，全系统唯一，如 P001234）',
  },
  material_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '料品名称（规格化全称，如 375ml 铝制罐盖）',
  },
  specification: {
    type: DataTypes.STRING(200),
    comment: '规格型号（如 375ml / 500g / 标准型）',
  },
  unit_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '计量单位名称（如 个 / 罐 / 箱 / kg）',
  },
  film_no: {
    type: DataTypes.STRING(50),
    comment: '菲林编号（印刷用菲林版号，来自 U9）',
  },
  version_no: {
    type: DataTypes.STRING(50),
    comment: '版本号（料品设计变更版本，如 V1 / V2.1）',
  },
  barcode: {
    type: DataTypes.STRING(100),
    comment: '料品条形码（生产追溯扫码用）',
  },
  cutting_size: {
    type: DataTypes.STRING(50),
    comment: '裁剪尺寸（排版/开料参数，如 300×400mm）',
  },
  printing_process: {
    type: DataTypes.STRING(50),
    comment: '印刷工艺（如 胶印 / 凹印 / 丝印 / 无印刷）',
  },
  color_separation: {
    type: DataTypes.STRING(50),
    comment: '套色/色数（如 双色 / 四色 / 单色）',
  },
  blanking_diameter: {
    type: DataTypes.DECIMAL(11, 2),
    comment: '冲裁直径（mm，冲压工序关键工艺参数）',
  },
  material_thickness: {
    type: DataTypes.DECIMAL(11, 2),
    comment: '材料厚度（mm，如 0.22 铝板厚度）',
  },
  material_width: {
    type: DataTypes.DECIMAL(11, 2),
    comment: '材料宽度（mm，开料宽度）',
  },
  material_height: {
    type: DataTypes.DECIMAL(11, 2),
    comment: '材料高度/长度（mm，开料长度）',
  },
  scrap_weight: {
    type: DataTypes.DECIMAL(11, 2),
    comment: '单件废料重量（计算利用率/废料率用）',
  },
  unit_weight: {
    type: DataTypes.DECIMAL(11, 2),
    comment: '单件净重（生产核算用）',
  },
  unit_volume: {
    type: DataTypes.DECIMAL(11, 2),
    comment: '单件体积（包装/运输算量用）',
  },
  weight_unit: {
    type: DataTypes.STRING(20),
    comment: '重量单位（如 g / kg）',
  },
  volume_unit: {
    type: DataTypes.STRING(20),
    comment: '体积单位（如 cm³ / L）',
  },
  inventory_category: {
    type: DataTypes.STRING(20),
    comment: '库存分类（如 原料 / 半成品 / 成品 / 辅料）',
  },
  unit_code: {
    type: DataTypes.STRING(20),
    comment: '计量单位编码（对应单位字典表的 code）',
  },
  customer_id: {
    type: DataTypes.INTEGER,
    comment: '关联客户ID（关联 bas_customer.customer_id，定制料品归属客户）',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '是否启用：true=启用（可用于新建工单）, false=停用（历史数据保留）',
  },
  effective_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '生效日期（料品档案的生效起始日，用于版本追溯）',
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '失效日期（料品档案的有效期截止日）',
  },
}, {
  tableName: 'bas_material',
  timestamps: true,
  underscored: true,
  comment: '料品档案表：存储生产用物料/半成品基础信息（尺寸、重量、客户等）',
})

export default Material
