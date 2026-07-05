import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DictType = sequelize.define('DictType', {
  dict_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  dict_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  dict_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  remark: {
    type: DataTypes.STRING(500),
  },
  created_by: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'sys_dict_type',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})

export default DictType
