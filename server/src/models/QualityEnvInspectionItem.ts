import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const QualityEnvInspectionItem = sequelize.define('QualityEnvInspectionItem', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '子项ID',
  },
  inspection_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '关联检验ID',
  },
  item_name: {
    type: DataTypes.STRING(100),
    comment: '检验项目名称',
  },
  standard_value: {
    type: DataTypes.STRING(200),
    comment: '标准值',
  },
  actual_value: {
    type: DataTypes.STRING(100),
    comment: '实测值',
  },
  unit: {
    type: DataTypes.STRING(30),
    comment: '单位',
  },
  judge: {
    type: DataTypes.STRING(20),
    comment: '判定：合格/不合格',
  },
  remark: {
    type: DataTypes.STRING(200),
    comment: '备注',
  },
}, {
  tableName: 'quality_env_inspection_item',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['inspection_id'] },
  ],
})

export default QualityEnvInspectionItem
