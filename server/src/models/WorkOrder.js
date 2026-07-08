import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const WorkOrder = sequelize.define('WorkOrder', {
  work_order_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  work_order_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  order_id: {
    type: DataTypes.INTEGER,
  },
  order_no: {
    type: DataTypes.STRING(50),
  },
  line_id: {
    type: DataTypes.INTEGER,
  },
  line_name: {
    type: DataTypes.STRING(100),
  },
  material_id: {
    type: DataTypes.UUID,
  },
  material_name: {
    type: DataTypes.STRING(100),
  },
  target_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  planned_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  finished_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  start_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  qualified_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  defect_material: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  defect_process: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  defect_scrap: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  plan_start_time: {
    type: DataTypes.DATE,
  },
  plan_end_time: {
    type: DataTypes.DATE,
  },
  start_time: {
    type: DataTypes.DATE,
  },
  finish_time: {
    type: DataTypes.DATE,
  },
  total_hours: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  effective_hours: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  labor_hours: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    get() {
      const val = this.getDataValue('status')
      const map = { 0: '开立', 1: '开工', 2: '完工' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '开立': 0, '开工': 1, '完工': 2 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  created_by: {
    type: DataTypes.STRING(50),
  },
  remarks: {
    type: DataTypes.STRING(500),
  },
}, {
  tableName: 'production_work_order',
  timestamps: true,
  underscored: true,
})

export default WorkOrder
