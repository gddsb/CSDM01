import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Material = sequelize.define('Material', {
  material_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  material_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  material_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  specification: {
    type: DataTypes.STRING(200),
  },
  film_version: {
    type: DataTypes.STRING(50),
  },
  version_no: {
    type: DataTypes.STRING(50),
  },
  category_code: {
    type: DataTypes.STRING(50),
  },
  category_name: {
    type: DataTypes.STRING(100),
  },
  customer_code: {
    type: DataTypes.STRING(50),
  },
  customer_name: {
    type: DataTypes.STRING(100),
  },
  unit: {
    type: DataTypes.STRING(20),
  },
  min_safety_stock: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  max_safety_stock: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    get() {
      const val = this.getDataValue('status')
      const map = { 1: '启用', 2: '试产', 0: '停产' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '启用': 1, '试产': 2, '停产': 0 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 1)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
}, {
  tableName: 'master_material',
  timestamps: true,
  underscored: true,
})

export default Material
