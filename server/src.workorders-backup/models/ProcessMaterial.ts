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
  process_id: {
    type: DataTypes.INTEGER,
  },
  material_type: {
    type: DataTypes.STRING(100),
  },
  bas_material_id: {
    type: DataTypes.STRING,
  },
  material_batch: {
    type: DataTypes.STRING(100),
  },
  package_no: {
    type: DataTypes.STRING(100),
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  label_images: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'production_process_material',
  timestamps: true,
  underscored: true,
  createdAt: 'record_time',
  updatedAt: false,
})

export default ProcessMaterial
