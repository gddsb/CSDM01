import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Permission = sequelize.define('Permission', {
  perm_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  parent_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  perm_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  perm_code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'menu',
  },
  icon: {
    type: DataTypes.STRING(100),
  },
  path: {
    type: DataTypes.STRING(200),
  },
  component: {
    type: DataTypes.STRING(200),
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // 是否在菜单显示：0-隐藏（可访问 URL 但不显示）/ 1-显示（设计文档 §2.1.4）
  // 与 status 配合实现菜单三态：显示+启用=可见可访问；隐藏+启用=不可见可访问；禁用=不可访问
  visible: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
  },
}, {
  tableName: 'sys_permission',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default Permission
