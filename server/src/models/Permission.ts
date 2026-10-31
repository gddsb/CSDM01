import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 权限/菜单表
 * 树形结构（parent_id 自关联），type 区分 menu=菜单 / button=按钮 / api=接口。
 * 与 Role 多对多关联（通过 sys_role_permission）。
 * createdAt 保留，updatedAt 禁用（权限数据通常不更新修改时间）。
 */
const Permission = sequelize.define('Permission', {
  perm_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '权限ID（主键）',
  },
  parent_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '父级权限ID（0=顶级节点，自关联形成树形结构）',
  },
  perm_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '权限名称（显示在菜单上的中文名称）',
  },
  perm_code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '权限编码（英文唯一标识，如 device:fault:create）',
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'menu',
    comment: '权限类型：menu=菜单, button=按钮, api=接口',
  },
  icon: {
    type: DataTypes.STRING(100),
    comment: '菜单图标（Ant Design 图标名，仅 type=menu 有值）',
  },
  path: {
    type: DataTypes.STRING(200),
    comment: '前端路由路径（如 /device/fault，仅 type=menu 有值）',
  },
  component: {
    type: DataTypes.STRING(200),
    comment: '前端组件路径（如 pages/device/Fault，仅 type=menu 有值）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '同级排序序号（数值小排前）',
  },
  visible: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '是否在前端菜单显示：1=显示（可见可访问）, 0=隐藏（不可见但可访问）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '权限状态：1=启用（角色可分配）, 0=禁用（角色不可分配，接口也被拦截）',
  },
}, {
  tableName: 'sys_permission',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
  comment: '系统权限/菜单表：树形结构，定义菜单、按钮、接口权限',
})

export default Permission
