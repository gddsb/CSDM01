import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DefectType = sequelize.define('DefectType', {
  defect_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  defect_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  defect_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  defect_type: {
    type: DataTypes.STRING(50),
  },
  defect_unit: {
    type: DataTypes.STRING(20),
  },
  available_units: {
    type: DataTypes.STRING(255),
    get() {
      const val = this.getDataValue('available_units')
      if (!val) return []
      if (Array.isArray(val)) return val
      return val.split(',').map(s => s.trim()).filter(Boolean)
    },
    set(val) {
      if (Array.isArray(val)) {
        this.setDataValue('available_units', val.join(','))
      } else {
        this.setDataValue('available_units', val)
      }
    },
  },
  display: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    get() {
      const val = this.getDataValue('status')
      return val === 1 ? '启用' : val === 0 ? '停用' : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('status', val === '启用' ? 1 : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  related_processes: {
    type: DataTypes.STRING(255),
    get() {
      const val = this.getDataValue('related_processes')
      if (!val) return []
      if (Array.isArray(val)) return val
      return val.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
    },
    set(val) {
      if (Array.isArray(val)) {
        this.setDataValue('related_processes', val.join(','))
      } else {
        this.setDataValue('related_processes', val)
      }
    },
  },
  defect_description: {
    type: DataTypes.STRING(500),
  },
}, {
  tableName: 'master_defect_type',
  timestamps: true,
  underscored: true,
})

export default DefectType
