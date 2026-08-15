import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 报工物料记录子表（关联生产报工单）
const ProcessMaterial = sequelize.define('ProcessMaterial', {
  material_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_order_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '生产报工单ID',
  },
  process_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '工序ID',
  },
  material_type: {
    type: DataTypes.STRING(100),
    comment: '物料类型',
  },
  bas_material_id: {
    type: DataTypes.STRING,
    comment: '关联基础料品表ID',
  },
  material_batch: {
    type: DataTypes.STRING(100),
    comment: '物料批次',
  },
  package_no: {
    type: DataTypes.STRING(100),
    comment: '包号',
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '数量',
  },
  label_images: {
    type: DataTypes.TEXT,
    comment: '标签图片(JSON)',
  },
}, {
  tableName: 'production_process_material',
  timestamps: true,
  underscored: true,
  createdAt: 'record_time',
  updatedAt: false,
})

export default ProcessMaterial
