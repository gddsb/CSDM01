import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/** 数据权限规则：角色/用户 × 业务对象 × 维度三元组 */
export const DataScope = sequelize.define('DataScope', {
  scope_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  role_id: { type: DataTypes.INTEGER, comment: '角色ID — 角色级规则' },
  user_id: { type: DataTypes.INTEGER, comment: '用户ID — 用户级独立规则，覆盖角色级' },
  obj_code: { type: DataTypes.STRING(50), allowNull: false, comment: '业务对象编码 (sys_business_object.obj_code)' },
  scope_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'custom', comment: 'all/self/dept/workshop/custom' },
  dim_code: { type: DataTypes.STRING(50), comment: '维度编码 (scope_type=custom 时必填)' },
  operator: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'IN', comment: 'IN/NOT_IN/EQ/NEQ/LIKE/GT/LT/BETWEEN' },
  dim_value: { type: DataTypes.STRING(2000), comment: '过滤值 (JSON 数组字符串)' },
  perm_code: { type: DataTypes.STRING(100), comment: '可选：绑定到具体权限码' },
  description: { type: DataTypes.STRING(500) },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
}, {
  tableName: 'sys_data_scope',
  timestamps: true,
  underscored: true,
})
