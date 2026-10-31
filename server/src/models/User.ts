import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 用户表
 * 存储系统登录账号及其基本信息，与 Role 通过 role_id 关联。
 */
const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '用户ID（主键）',
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '登录账号（唯一，如 admin / zhangsan）',
  },
  user_pwd: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '登录密码（bcrypt 哈希存储）',
  },
  real_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '真实姓名',
  },
  employee_no: {
    type: DataTypes.STRING(50),
    comment: '工号（企业内部编号）',
  },
  department: {
    type: DataTypes.STRING(50),
    comment: '所属部门',
  },
  position: {
    type: DataTypes.STRING(50),
    comment: '岗位/职务（如 生产主管 / 设备维护员 / 品检员）',
  },
  role_id: {
    type: DataTypes.INTEGER,
    comment: '角色ID（关联 sys_role.role_id，多用户可共享同一角色）',
  },
  phone: {
    type: DataTypes.STRING(20),
    comment: '联系电话',
  },
  email: {
    type: DataTypes.STRING(100),
    comment: '电子邮箱',
  },
  avatar_url: {
    type: DataTypes.STRING(255),
    comment: '头像地址（可访问的 URL）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '账号状态：1=启用, 0=禁用',
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
  last_login_time: {
    type: DataTypes.DATE,
    comment: '最后登录时间',
  },
  last_login_ip: {
    type: DataTypes.STRING(45),
    comment: '最后登录 IP（兼容 IPv6 最长 45 位）',
  },
  pwd_reset_required: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    comment: '首次登录是否需要修改密码：0=否, 1=是',
  },
  created_by: {
    type: DataTypes.STRING(50),
    comment: '创建人（记录操作人 username）',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注信息',
  },
}, {
  tableName: 'sys_user',
  timestamps: true,
  underscored: true,
  comment: '系统用户表：存储登录账号、基本资料和状态',
})

export default User
