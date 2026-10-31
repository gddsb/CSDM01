import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 角色-权限关联表
 * Role 与 Permission 的多对多中间表。
 * 无业务含义，纯关联用途，不记录创建/更新时间。
 */
const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '关联记录ID（主键）',
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '角色ID（关联 sys_role.role_id）',
  },
  perm_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '权限ID（关联 sys_permission.perm_id）',
  },
}, {
  tableName: 'sys_role_permission',
  timestamps: false,
  underscored: true,
  comment: '角色-权限关联表（Role ↔ Permission 多对多中间表）',
})

export default RolePermission
