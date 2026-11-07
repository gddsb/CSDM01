import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/** 业务状态规则：@BizStatusCheck 拦截器读取 */
export const BizStatusRule = sequelize.define('BizStatusRule', {
  rule_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  obj_code: { type: DataTypes.STRING(50), allowNull: false, comment: '业务对象编码' },
  operate_key: { type: DataTypes.STRING(50), allowNull: false, comment: '操作键 (start/finish/close/submit_repair...)' },
  operate_name: { type: DataTypes.STRING(100), allowNull: false, comment: '操作中文名称' },
  allowed_states: { type: DataTypes.STRING(2000), allowNull: false, comment: '允许状态值 (JSON 数组)' },
  next_state: { type: DataTypes.STRING(50), comment: '操作后目标状态' },
  perm_code: { type: DataTypes.STRING(100), comment: '可选：绑定到具体权限码' },
  error_message: { type: DataTypes.STRING(500), comment: '校验失败时的提示' },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
}, {
  tableName: 'sys_biz_status_rule',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['obj_code', 'operate_key'] },
  ],
})
