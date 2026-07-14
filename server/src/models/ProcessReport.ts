import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ProcessReport = sequelize.define('ProcessReport', {
  report_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  work_order_id: {
    type: DataTypes.INTEGER,
  },
  work_order_no: {
    type: DataTypes.STRING(50),
  },
  report_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  process_id: {
    type: DataTypes.INTEGER,
  },
  process_name: {
    type: DataTypes.STRING(100),
  },
  input_qty: {
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
  output_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  device_id: {
    type: DataTypes.INTEGER,
  },
  device_name: {
    type: DataTypes.STRING(100),
  },
  report_user: {
    type: DataTypes.STRING(50),
  },
  report_user_name: {
    type: DataTypes.STRING(50),
  },
  report_time: {
    type: DataTypes.DATE,
  },
  report_start_time: {
    type: DataTypes.DATE,
  },
  report_end_time: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    get() {
      const val = this.getDataValue('status')
      const map = { 0: '开始报工', 1: '结束报工' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '开始报工': 0, '结束报工': 1 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
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
  material_code: {
    type: DataTypes.STRING(50),
  },
  material_name: {
    type: DataTypes.STRING(100),
  },
  specification: {
    type: DataTypes.STRING(200),
  },
  unit: {
    type: DataTypes.STRING(20),
  },
  planned_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  report_date: {
    type: DataTypes.DATEONLY,
  },
  shift: {
    type: DataTypes.STRING(20),
  },
  team: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'production_process_report',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ProcessReport
