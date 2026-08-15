import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const UserSetting = sequelize.define('UserSetting', {
  setting_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  setting_key: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  setting_value: {
    type: DataTypes.TEXT,
  },
  setting_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'json',
  },
  setting_group: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'table',
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
})

export default UserSetting
