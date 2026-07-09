import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ProcessReport = sequelize.define('ProcessReport', {
  report_id: {
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
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    get() {
      const val = this.getDataValue('status')
      const map = { 1: '开工', 2: '完工' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '开工': 1, '完工': 2 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 1)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
}, {
  tableName: 'production_process_report',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ProcessReport
