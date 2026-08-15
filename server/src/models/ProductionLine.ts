import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ProductionLine = sequelize.define('ProductionLine', {
  line_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  line_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  line_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  workshop: {
    type: DataTypes.STRING(50),
  },
  line_leader: {
    type: DataTypes.STRING(50),
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
      const map = { 1: '运行中', 2: '维护中', 0: '停用' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '运行中': 1, '维护中': 2, '停用': 0 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 1)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
}, {
  tableName: 'master_production_line',
  timestamps: true,
  underscored: true,
})

export default ProductionLine
