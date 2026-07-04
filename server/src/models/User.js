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
  role_id: {
    type: DataTypes.INTEGER,
  },
  phone: {
    type: DataTypes.STRING(20),
  },
  email: {
    type: DataTypes.STRING(100),
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
}, {
  tableName: 'sys_user',
  timestamps: true,
  underscored: true,
})

export default User
