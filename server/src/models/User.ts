import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  real_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  employee_no: {
    type: DataTypes.STRING(50),
  },
  department: {
    type: DataTypes.STRING(50),
  },
  // 岗位名称（设计文档 §2.1.1）
  position: {
    type: DataTypes.STRING(50),
  },
  role_id: {
    type: DataTypes.INTEGER,
  },
  phone: {
    type: DataTypes.STRING(20),
  },
  email: {
    type: DataTypes.STRING(100),
  },
  // 头像地址（设计文档 §2.1.1）
  avatar_url: {
    type: DataTypes.STRING(255),
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
  last_login_time: {
    type: DataTypes.DATE,
  },
  // 最后登录 IP（设计文档 §2.1.1）
  last_login_ip: {
    type: DataTypes.STRING(45),
  },
  // 首次登录需修改密码：0-否 / 1-是（设计文档 §2.1.1）
  pwd_reset_required: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  // 创建人 ID（设计文档 §2.1.1）
  created_by: {
    type: DataTypes.STRING(50),
  },
  // 备注信息（设计文档 §2.1.1）
  remarks: {
    type: DataTypes.STRING(500),
  },
}, {
  tableName: 'sys_user',
  timestamps: true,
  underscored: true,
})

export default User
