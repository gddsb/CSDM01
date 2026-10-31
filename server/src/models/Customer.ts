import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 客户档案表
 * 存储企业客户的基础信息、联系方式、信用等级、税务信息等。
 * 与 Material 通过 customer_id 关联（定制料品归属某客户）。
 * 字段命名说明（设计文档 vs 实际实现同义）：
 *   short_name ↔ customer_short_name
 *   phone      ↔ contact_phone
 *   status     ↔ is_active (1=启用/0=停用)
 *   remark     ↔ remarks
 */
const Customer = sequelize.define('Customer', {
  customer_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '客户ID（主键）',
  },
  customer_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '客户编号（如 C001 / C002，不强制业务编号生成器，便于直接录入）',
  },
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '客户全称（营业执照上的公司全称）',
  },
  short_name: {
    type: DataTypes.STRING(100),
    comment: '客户简称（设计文档字段名 customer_short_name，前端下拉常用简称）',
  },
  customer_category: {
    type: DataTypes.STRING(50),
    comment: '客户分类（如 奶粉罐 / 蛋白粉罐 / 废品回收 / 其它粉罐 / 内部客户）',
  },
  customer_type: {
    type: DataTypes.STRING(50),
    comment: '客户分类标签（自定义标签，如 VIP / 战略 / 普通）',
  },
  contact_person: {
    type: DataTypes.STRING(50),
    comment: '主要联系人姓名',
  },
  phone: {
    type: DataTypes.STRING(50),
    comment: '联系电话（设计文档字段名 contact_phone，手机/座机均可）',
  },
  email: {
    type: DataTypes.STRING(100),
    comment: '电子邮箱',
  },
  address: {
    type: DataTypes.STRING(300),
    comment: '联系地址（详细地址，含省市区）',
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '启用状态：1=启用（可用于新建订单）, 0=停用（历史数据保留）',
  },
  effective_date: {
    type: DataTypes.DATEONLY,
    comment: '客户档案生效日期（YYYY-MM-DD）',
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    comment: '客户档案失效日期（有效期截止）',
  },
  credit_level: {
    type: DataTypes.STRING(20),
    comment: '信用等级（如 A / B / C / D，用于销售额度管控）',
  },
  tax_id: {
    type: DataTypes.STRING(50),
    comment: '纳税人识别号/统一社会信用代码',
  },
  bank_account: {
    type: DataTypes.STRING(50),
    comment: '对公银行账号（用于开票/付款）',
  },
  bank_name: {
    type: DataTypes.STRING(100),
    comment: '开户银行全称',
  },
  remark: {
    type: DataTypes.STRING(500),
    comment: '备注说明（设计文档字段名 remarks，如特殊条款、合作背景等）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序序号（客户列表默认排序，数值小排前）',
  },
  created_by: {
    type: DataTypes.STRING(50),
    comment: '创建人（操作人 username）',
  },
}, {
  tableName: 'bas_customer',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '客户档案表：存储企业客户基础信息、联系方式、信用/税务信息',
})

export default Customer
