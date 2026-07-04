import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Permission = sequelize.define('Permission', {
  perm_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  parent_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  perm_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  perm_code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'menu',
  },
  icon: {
    type: DataTypes.STRING(100),
  },
  path: {
    type: DataTypes.STRING(200),
  },
  component: {
    type: DataTypes.STRING(200),
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
  },
}, {
  tableName: 'sys_permission',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default Permission
