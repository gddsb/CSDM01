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
