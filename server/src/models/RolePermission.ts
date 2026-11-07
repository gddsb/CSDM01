import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 角色-权限关联表（对齐规范文档 3.6 节）
 *
 * Phase 2 关键改造：新增 terminal 终端维度，支撑 PC / APP 双端差异化权限。
 * 唯一约束：(role_id, perm_id, terminal) 联合唯一（规范 3.6 要求）。
 *
 * —— 双轨兼容 ——
 *   旧代码读写 Role.belongsToMany(Permission, through: RolePermission)
 *   默认 terminal=1（PC 端），通过 JOIN through:{where:{terminal}} 过滤
 *
 *   terminal: 1=PC端, 2=移动端APP
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
  terminal: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '终端（规范 3.6）: 1=PC端, 2=移动端APP',
  },
  create_time: {
    type: DataTypes.DATE,
    comment: '授权时间',
  },
}, {
  tableName: 'sys_role_permission',
  timestamps: false,
  underscored: true,
  indexes: [
    { unique: true, name: 'uk_role_perm_terminal', fields: ['role_id', 'perm_id', 'terminal'] },
  ],
  comment: '角色-权限关联表（规范 3.6）— 含 terminal 终端维度，支撑 PC/APP 双端差异化权限',
})

export default RolePermission
