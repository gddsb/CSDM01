import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/** 数据维度字典：定义权限引擎可过滤的字段，禁止代码写死车间/班组等 */
export const DataDimension = sequelize.define('DataDimension', {
  dim_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, comment: '维度ID' },
  dim_code: { type: DataTypes.STRING(50), allowNull: false, unique: true, comment: '维度编码 (dim_code)' },
  dim_name: { type: DataTypes.STRING(100), allowNull: false, comment: '中文名称' },
  target_table: { type: DataTypes.STRING(100), allowNull: false, comment: '目标表名 (逗号分隔)' },
  target_column: { type: DataTypes.STRING(100), allowNull: false, comment: 'SQL WHERE 里的列名' },
  data_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'string', comment: 'string/number/date/enum' },
  description: { type: DataTypes.STRING(500), comment: '说明' },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
}, {
  tableName: 'sys_data_dimension',
  timestamps: true,
  underscored: true,
})
