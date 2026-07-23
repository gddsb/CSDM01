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
  film_version: {
    type: DataTypes.STRING(50),
    comment: '菲林编号（来自料品档案 film_no）',
  },
  version_no: {
    type: DataTypes.STRING(50),
  },
  barcode: {
    type: DataTypes.STRING(100),
    comment: '条形码',
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
    comment: '状态：0=开立, 1=下发, 2=开工, 3=完工, 4=关闭',
    get() {
      const val = this.getDataValue('status')
      const map = { 0: '开立', 1: '下发', 2: '开工', 3: '完工', 4: '关闭' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '开立': 0, '下发': 1, '开工': 2, '完工': 3, '关闭': 4 }
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
