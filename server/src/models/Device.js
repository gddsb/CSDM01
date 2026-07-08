import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Device = sequelize.define('Device', {
  device_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  device_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  device_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  device_type: {
    type: DataTypes.STRING(50),
  },
  device_model: {
    type: DataTypes.STRING(100),
  },
  serial_no: {
    type: DataTypes.STRING(100),
  },
  location: {
    type: DataTypes.STRING(100),
  },
  line_id: {
    type: DataTypes.INTEGER,
  },
  responsible_person: {
    type: DataTypes.STRING(50),
  },
  is_special: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    get() {
      const val = this.getDataValue('status')
      const map = { 1: '运行', 0: '停用', 2: '维修' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '运行': 1, '停用': 0, '维修': 2 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 1)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  last_inspection_date: {
    type: DataTypes.DATEONLY,
  },
  inspection_cycle: {
    type: DataTypes.STRING(50),
  },
  next_inspection_date: {
    type: DataTypes.DATEONLY,
  },
  manufacturer: {
    type: DataTypes.STRING(100),
  },
  purchase_date: {
    type: DataTypes.DATEONLY,
  },
  warranty_end: {
    type: DataTypes.DATEONLY,
  },
}, {
  tableName: 'master_device',
  timestamps: true,
  underscored: true,
})

export default Device
