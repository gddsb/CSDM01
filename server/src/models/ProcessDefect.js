import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ProcessDefect = sequelize.define('ProcessDefect', {
  defect_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
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
  defect_category: {
    type: DataTypes.STRING(50),
  },
  defect_name: {
    type: DataTypes.STRING(100),
  },
  defect_type_id: {
    type: DataTypes.INTEGER,
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  unit: {
    type: DataTypes.STRING(20),
  },
  record_user: {
    type: DataTypes.STRING(50),
  },
  record_user_name: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'production_process_defect',
  timestamps: true,
  underscored: true,
  createdAt: 'record_time',
  updatedAt: false,
})

export default ProcessDefect