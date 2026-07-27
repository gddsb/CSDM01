import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const InspectionStandardItem = sequelize.define('InspectionStandardItem', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '检验标准项目ID',
  },
  standard_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '关联检验标准ID',
  },
  item_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '项目名称',
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '项目大类：外观/尺寸/性能/理化/微生物/环境',
  },
  method: {
    type: DataTypes.STRING(200),
    comment: '检验方法',
  },
  sample_rule: {
    type: DataTypes.STRING(200),
    comment: '抽样方式',
  },
  standard_value: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '标准值',
  },
  unit: {
    type: DataTypes.STRING(20),
    comment: '单位',
  },
  defect_level: {
    type: DataTypes.STRING(20),
    comment: '缺陷等级：A类致命缺陷、B类严重缺陷、C类次要缺陷',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序',
  },
  inspection_types: {
    type: DataTypes.STRING(200),
    comment: '检验类型（多选，逗号分隔：首件,制程,成品,来料,其它）',
  },
}, {
  tableName: 'quality_inspection_standard_item',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['standard_id'] },
  ],
})

export default InspectionStandardItem
