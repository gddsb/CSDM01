import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DictData = sequelize.define('DictData', {
  dict_code: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  dict_sort: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  dict_label: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  dict_value: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  dict_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  css_class: {
    type: DataTypes.STRING(100),
  },
  list_class: {
    type: DataTypes.STRING(100),
  },
  is_default: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  remark: {
    type: DataTypes.STRING(500),
  },
}, {
  tableName: 'sys_dict_data',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})

export default DictData
