import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/** 业务对象字典：权限引擎 V2 的 businessObj 常量池 */
export const BusinessObject = sequelize.define('BusinessObject', {
  obj_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '业务对象ID' },
  obj_code: { type: DataTypes.STRING(50), allowNull: false, unique: true, comment: '业务对象编码 (businessObj)' },
  obj_name: { type: DataTypes.STRING(100), allowNull: false, comment: '中文名称' },
  module: { type: DataTypes.STRING(50), comment: '所属业务模块 (production/quality/device/basic/system)' },
  description: { type: DataTypes.STRING(500), comment: '说明' },
  has_data_scope: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1, comment: '1=启用数据权限' },
  has_biz_status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1, comment: '1=启用业务状态校验' },
  default_status_value: { type: DataTypes.STRING(50), comment: '新建默认状态' },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
}, {
  tableName: 'sys_business_object',
  timestamps: true,
  underscored: true,
})
