import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DataDictionary = sequelize.define('DataDictionary', {
  dict_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  table_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: '业务表',
  },
  purpose: {
    type: DataTypes.STRING(500),
  },
  field_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  record_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  fields: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('fields')
      if (!raw) return []
      try {
        return JSON.parse(raw)
      } catch {
        return []
      }
    },
    set(val) {
      this.setDataValue('fields', val ? JSON.stringify(val) : null)
    },
  },
  last_update: {
    type: DataTypes.DATE,
  },
}, {
  tableName: 'sys_data_dictionary',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})

export default DataDictionary
