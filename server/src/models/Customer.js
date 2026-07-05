import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 客户档案表（bas_customer）
// 精简字段，满足订单/料品关联客户的基本需求
const Customer = sequelize.define('Customer', {
  customer_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // 客户编号，如 C001、C002（不强制使用业务编号生成器，便于直接录入）
  customer_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  // 客户简称
  short_name: {
    type: DataTypes.STRING(100),
  },
  // 联系人
  contact_person: {
    type: DataTypes.STRING(50),
  },
  // 联系电话
  phone: {
    type: DataTypes.STRING(50),
  },
  // 邮箱
  email: {
    type: DataTypes.STRING(100),
  },
  // 联系地址
  address: {
    type: DataTypes.STRING(300),
  },
  // 状态：1=启用，0=停用
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  // 备注
  remark: {
    type: DataTypes.STRING(500),
  },
  // 排序号
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  created_by: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'bas_customer',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})

export default Customer
