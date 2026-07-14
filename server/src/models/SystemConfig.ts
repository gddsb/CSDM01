import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const SystemConfig = sequelize.define('SystemConfig', {
  config_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  config_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  config_value: {
    type: DataTypes.TEXT,
  },
  // 配置类型：string/number/boolean/json（设计文档 §2.2.2）
  config_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'string',
  },
  // 配置分组：security/system/business（设计文档 §2.2.2）
  config_group: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'system',
  },
  config_desc: {
    type: DataTypes.STRING(200),
  },
  updated_by: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'sys_config',
  timestamps: true,
  underscored: true,
})

export default SystemConfig
