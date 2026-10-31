import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 角色表
 * 定义系统角色（如管理员、生产主管、设备维护员），与 Permission 多对多关联（通过 sys_role_permission）。
 * 每个用户通过 User.role_id 关联到一个角色。
 */
const Role = sequelize.define('Role', {
  role_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '角色ID（主键）',
  },
  role_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '角色名称（如 系统管理员 / 生产主管）',
  },
  role_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '角色编码（英文唯一标识，如 admin / production_manager）',
  },
  type: {
    type: DataTypes.STRING(20),
    comment: '角色类型（如 system=系统角色 / custom=自定义角色）',
  },
  is_system_default: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    comment: '是否系统预置角色：0=否（可删除）, 1=是（不可删除）',
  },
  description: {
    type: DataTypes.STRING(200),
    comment: '角色描述/说明',
  },
  scope: {
    type: DataTypes.STRING(50),
    comment: '数据权限范围（如 all=全部 / self=仅本人 / dept=本部门）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序序号（数值小排前）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '角色状态：1=启用, 0=禁用',
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
  comment: '系统角色表：定义角色、角色编码及状态',
})

export default Role
