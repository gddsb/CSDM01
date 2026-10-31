import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 供应商档案表
 * 存储原材料/设备等供应商的基础信息、联系方式、信用等级。
 * 字段结构与 Customer 基本对称，但不含 effective_date/expiry_date（供应商通常长期有效）。
 */
const Supplier = sequelize.define('Supplier', {
  supplier_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '供应商ID（主键）',
  },
  supplier_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '供应商编号（如 SUP-001 / SUP-ALUMINUM-002）',
  },
  supplier_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '供应商全称（营业执照上的公司全称）',
  },
  short_name: {
    type: DataTypes.STRING(100),
    comment: '供应商简称（前端下拉常用简称）',
  },
  supplier_category: {
    type: DataTypes.STRING(50),
    comment: '供应商分类（如 铝材供应商 / 涂料供应商 / 设备厂商 / 检测机构）',
  },
  contact_person: {
    type: DataTypes.STRING(50),
    comment: '主要联系人姓名（采购对接人）',
  },
  phone: {
    type: DataTypes.STRING(50),
    comment: '联系电话（手机/座机均可）',
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
    comment: '启用状态：1=启用（可用于新建采购单）, 0=停用',
  },
  credit_level: {
    type: DataTypes.STRING(20),
    comment: '信用等级（如 A / B / C，用于付款条件设定）',
  },
  tax_id: {
    type: DataTypes.STRING(50),
    comment: '纳税人识别号/统一社会信用代码',
  },
  bank_account: {
    type: DataTypes.STRING(50),
    comment: '对公银行账号（用于付款）',
  },
  bank_name: {
    type: DataTypes.STRING(100),
    comment: '开户银行全称',
  },
  remark: {
    type: DataTypes.STRING(500),
    comment: '备注说明（如合作年限、付款条件、特殊条款）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序序号（供应商列表默认排序，数值小排前）',
  },
  created_by: {
    type: DataTypes.STRING(50),
    comment: '创建人（操作人 username）',
  },
}, {
  tableName: 'bas_supplier',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '供应商档案表：存储原材料/设备供应商基础信息、联系方式、信用等级',
})

export default Supplier
