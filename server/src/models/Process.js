import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Process = sequelize.define('Process', {
  process_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  process_code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  process_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  has_material: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    get() {
      const val = this.getDataValue('has_material')
      return val === 1 ? '是' : val === 0 ? '否' : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('has_material', val === '是' ? 1 : 0)
      } else {
        this.setDataValue('has_material', val)
      }
    },
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
}, {
  tableName: 'master_process',
  timestamps: true,
  underscored: true,
})

export default Process
