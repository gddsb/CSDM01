import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Role = sequelize.define('Role', {
  role_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  role_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  role_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  type: {
    type: DataTypes.STRING(20),
  },
  // 是否系统默认角色：0-否 / 1-是（设计文档 §2.1.3，系统默认角色不可删除）
  is_system_default: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  // 角色描述（设计文档 §2.1.3）
  description: {
    type: DataTypes.STRING(200),
  },
  scope: {
    type: DataTypes.STRING(50),
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    get() {
      const val = this.getDataValue('status')
      return val === 1 ? '启用' : val === 0 ? '禁用' : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('status', val === '启用' ? 1 : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
}, {
  tableName: 'sys_role',
  timestamps: true,
  underscored: true,
})

export default Role
