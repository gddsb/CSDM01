import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ProcessMaterial = sequelize.define('ProcessMaterial', {
  material_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_id: {
    type: DataTypes.INTEGER,
  },
  work_order_id: {
    type: DataTypes.INTEGER,
  },
  work_order_no: {
    type: DataTypes.STRING(50),
  },
  process_id: {
    type: DataTypes.INTEGER,
  },
  process_code: {
    type: DataTypes.STRING(50),
  },
  process_name: {
    type: DataTypes.STRING(100),
  },
  material_type: {
    type: DataTypes.STRING(100),
  },
  material_code: {
    type: DataTypes.STRING(100),
  },
  material_name: {
    type: DataTypes.STRING(200),
  },
  specification: {
    type: DataTypes.STRING(200),
  },
  material_batch: {
    type: DataTypes.STRING(100),
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  label_images: {
    type: DataTypes.TEXT,
  },
  record_user: {
    type: DataTypes.STRING(50),
  },
  record_user_name: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'production_process_material',
  timestamps: true,
  underscored: true,
  createdAt: 'record_time',
  updatedAt: false,
})

export default ProcessMaterial