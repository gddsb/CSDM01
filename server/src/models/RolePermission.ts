import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  perm_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'sys_role_permission',
  timestamps: false,
  underscored: true,
})

export default RolePermission
