import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 客户档案表（bas_customer，设计文档 §2.2.3）
// 字段命名说明：
//   short_name      ↔ 设计文档 customer_short_name（同义，前端使用 short_name）
//   phone           ↔ 设计文档 contact_phone（同义，前端使用 phone）
//   status          ↔ 设计文档 is_active（同义，1=启用/0=停用）
//   remark          ↔ 设计文档 remarks（同义）
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
  // 客户简称（设计文档字段名 customer_short_name）
  short_name: {
    type: DataTypes.STRING(100),
  },
  // 客户分类，如：奶粉罐/废品/蛋白粉/其它粉罐/内部客户
  customer_category: {
    type: DataTypes.STRING(50),
  },
  // 客户分类标签（自定义标签）
  customer_type: {
    type: DataTypes.STRING(50),
  },
  // 联系人
  contact_person: {
    type: DataTypes.STRING(50),
  },
  // 联系电话（设计文档字段名 contact_phone）
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
  // 状态：1=启用，0=停用（设计文档字段名 is_active）
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  // 生效日期（设计文档 §2.2.3）
  effective_date: {
    type: DataTypes.DATEONLY,
  },
  // 失效日期（设计文档 §2.2.3）
  expiry_date: {
    type: DataTypes.DATEONLY,
  },
  // 信用等级：A/B/C/D
  credit_level: {
    type: DataTypes.STRING(20),
  },
  // 纳税人识别号
  tax_id: {
    type: DataTypes.STRING(50),
  },
  // 银行账号
  bank_account: {
    type: DataTypes.STRING(50),
  },
  // 开户银行
  bank_name: {
    type: DataTypes.STRING(100),
  },
  // 备注（设计文档字段名 remarks）
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
