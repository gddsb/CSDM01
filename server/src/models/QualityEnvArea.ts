import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const QualityEnvArea = sequelize.define('QualityEnvArea', {
  area_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '区域ID',
  },
  area_code: {
    type: DataTypes.STRING(50),
    unique: true,
    comment: '区域编码',
  },
  area_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '区域名称（如：更衣室、一号车间、A线）',
  },
  area_type: {
    type: DataTypes.STRING(30),
    comment: '区域类型：更衣室/车间/产线/仓库等',
  },
  parent_id: {
    type: DataTypes.INTEGER,
    comment: '父级区域ID（树形结构）',
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
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
}, {
  tableName: 'quality_env_area',
  timestamps: true,
  underscored: true,
})

export default QualityEnvArea
