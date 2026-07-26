import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const InspectionStandard = sequelize.define('InspectionStandard', {
  standard_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '检验标准ID',
  },
  standard_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '标准编号',
  },
  standard_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '标准名称',
  },
  inspection_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '检验类型：材料检验/产品检验/其它检验',
  },
  standard_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '标准类型：通用标准/专用标准/临时标准',
  },
  customer_code: {
    type: DataTypes.STRING(50),
    comment: '客户编码',
  },
  material_id: {
    type: DataTypes.UUID,
    comment: '参照料品ID',
  },
  material_name: {
    type: DataTypes.STRING(200),
    comment: '料品名称（冗余）',
  },
  version_no: {
    type: DataTypes.STRING(20),
    defaultValue: 'V1',
    comment: '版本号',
  },
  effective_date: {
    type: DataTypes.DATE,
    comment: '生效日期',
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: '开立',
    comment: '状态：开立/生效/失效',
  },
  created_by: {
    type: DataTypes.INTEGER,
    comment: '创建人ID',
  },
  description: {
    type: DataTypes.STRING(500),
    comment: '描述',
  },
}, {
  tableName: 'quality_inspection_standard',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['standard_no'], unique: true },
    { fields: ['inspection_type'] },
    { fields: ['standard_type'] },
    { fields: ['status'] },
  ],
})

export default InspectionStandard
