import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Order = sequelize.define('Order', {
  order_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  order_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  material_id: {
    type: DataTypes.INTEGER,
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
  film_version: {
    type: DataTypes.STRING(50),
  },
  version_no: {
    type: DataTypes.STRING(50),
  },
  planned_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  finished_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  plan_start_time: {
    type: DataTypes.DATE,
  },
  plan_end_time: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    get() {
      const val = this.getDataValue('status')
      const map = { 0: '待下达', 1: '已下发', 2: '已关闭' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '待下达': 0, '已下发': 1, '已关闭': 2 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  release_time: {
    type: DataTypes.DATE,
  },
  close_time: {
    type: DataTypes.DATE,
  },
  created_by: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'production_order',
  timestamps: true,
  underscored: true,
})

export default Order
