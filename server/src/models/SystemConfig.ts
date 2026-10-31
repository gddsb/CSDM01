import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 系统配置表
 * 以 key-value 形式存储系统级配置项，按 config_group 分组。
 * config_type 指示值的解析方式（string/number/boolean/json）。
 * 典型 key：token_expire_seconds / upload_max_size / default_password / smtp_host 等。
 */
const SystemConfig = sequelize.define('SystemConfig', {
  config_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '配置ID（主键）',
  },
  config_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '配置键名（英文唯一标识，如 token_expire_seconds / upload_max_size）',
  },
  config_value: {
    type: DataTypes.TEXT,
    comment: '配置值（以字符串存储，按 config_type 解析）',
  },
  config_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'string',
    comment: '配置值类型（决定解析方式）：string / number / boolean / json',
  },
  config_group: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'system',
    comment: '配置分组（用于前端菜单展示）：security / system / business / upload / ...',
  },
  config_desc: {
    type: DataTypes.STRING(200),
    comment: '配置项说明（中文描述配置用途）',
  },
  updated_by: {
    type: DataTypes.STRING(50),
    comment: '最后修改人（操作人 username）',
  },
}, {
  tableName: 'sys_config',
  timestamps: true,
  underscored: true,
  comment: '系统配置表：key-value 形式的系统级参数配置',
})

export default SystemConfig
