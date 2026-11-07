import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/** 业务对象字典：数据权限/状态规则的分类载体 */
export const BusinessObject = sequelize.define('BusinessObject', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  business_obj: { type: DataTypes.STRING(64), allowNull: false, unique: true, comment: '业务对象编码' },
  obj_name: { type: DataTypes.STRING(128), allowNull: false, comment: '业务对象中文名' },
  table_name: { type: DataTypes.STRING(64), comment: '主数据表名' },
  remark: { type: DataTypes.STRING(255) },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
}, {
  tableName: 'sys_business_object',
  timestamps: true,
  underscored: true,
})
