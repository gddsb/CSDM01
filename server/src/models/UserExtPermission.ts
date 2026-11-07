import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 用户附加权限表（规范 3.7）
 * — add/deny 双轨 + terminal 终端维度
 * 
 * 权限计算公式（规范 2.4）：
 *   finalPerms(userId, terminal) = rolePerms | addPerms & ~denyPerms
 *   deny 优先级最高，命中 deny 即不可用
 * 
 * ext_type: 1=add 额外授予, 2=deny 额外排除
 * terminal: 1=PC端, 2=移动端APP
 * 
 * 唯一约束：(user_id, perm_id, ext_type, terminal)
 * 业务层另需校验：同一 user + perm + terminal 不能同时 add 和 deny
 */
const UserExtPermission = sequelize.define('UserExtPermission', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    comment: '主键',
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '用户标识',
  },
  perm_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '权限标识(对齐 sys_permission.perm_id INT)',
  },
  ext_type: {
    type: DataTypes.TINYINT,
    allowNull: false,
    comment: '1=add额外授予, 2=deny额外排除',
  },
  terminal: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '终端: 1=PC端, 2=移动端APP — 规范 3.7',
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '1=有效, 0=失效(保留用于审计回溯)',
  },
  create_by: {
    type: DataTypes.STRING(64),
    comment: '创建人',
  },
  create_time: {
    type: DataTypes.DATE,
    comment: '创建时间',
  },
  update_by: {
    type: DataTypes.STRING(64),
    comment: '更新人',
  },
  update_time: {
    type: DataTypes.DATE,
    comment: '更新时间',
  },
}, {
  tableName: 'sys_user_ext_permission',
  timestamps: false,
  underscored: true,
  indexes: [
    { unique: true, name: 'uk_user_perm_ext', fields: ['user_id', 'perm_id', 'ext_type', 'terminal'] },
    { name: 'idx_user_terminal', fields: ['user_id', 'terminal'] },
    { name: 'idx_perm', fields: ['perm_id'] },
  ],
  comment: '用户附加权限表（规范 3.7）— add/deny 双轨 + terminal 维度',
})

export default UserExtPermission
