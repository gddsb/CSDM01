import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 用户个性化设置表
 * 以 (user_id, setting_key) 唯一索引存储每个用户的前端偏好设置。
 * 典型用途：表格列显示/隐藏/宽度调整、主题模式、默认页大小、通知开关等。
 * setting_type 决定值的解析方式（json 居多）。
 */
const UserSetting = sequelize.define('UserSetting', {
  setting_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '设置记录ID（主键）',
  },
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '关联用户ID（字符串类型，支持 username 或 user_id）',
  },
  setting_key: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '设置键名（唯一标识，如 device_fault.table_columns / theme.mode）',
  },
  setting_value: {
    type: DataTypes.TEXT,
    comment: '设置值（以字符串存储，按 setting_type 解析；json 居多）',
  },
  setting_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'json',
    comment: '设置值类型：json / string / number / boolean',
  },
  setting_group: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'table',
    comment: '设置分组（如 table=表格 / theme=主题 / pref=通用偏好）',
  },
}, {
  tableName: 'sys_user_setting',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['user_id', 'setting_key'] },
    { fields: ['user_id'] },
    { fields: ['setting_group'] },
  ],
  comment: '用户个性化设置表：存储用户表格列、主题、页大小等个性化偏好',
})

export default UserSetting
