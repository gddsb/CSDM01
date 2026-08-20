import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const QualityEnvTemplate = sequelize.define('QualityEnvTemplate', {
  template_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '模板ID',
  },
  template_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '模板名称',
  },
  area_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '关联区域ID',
  },
  item_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '检验项目名称（如：温度、沉降菌）',
  },
  standard_value: {
    type: DataTypes.STRING(200),
    comment: '标准值（如：18-26℃、≤15 CFU/皿）',
  },
  unit: {
    type: DataTypes.STRING(30),
    comment: '单位',
  },
  test_method: {
    type: DataTypes.STRING(200),
    comment: '检测方法',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：1启用, 0禁用',
  },
}, {
  tableName: 'quality_env_template',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['area_id'] },
    { fields: ['template_name'] },
  ],
})

export default QualityEnvTemplate
