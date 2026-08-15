import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 采集档案表 task_purchase_receipt
 * 从 U9 ERP 采购管理→标准收货 列表采集
 * 列表页面 lnk=SCM.PM.PM6010_20，使用默认查询方案加载数据
 *
 * 列表表头（过滤 tcc/display:none 后的列顺序）：
 *   r[0] 单据编号 | r[1] 料号 | r[2] 料品名称 | r[3] 料品.规格
 *   r[4] 业务类型 | r[5] 实收数量(采购单位) | r[6] 收货批号 | r[7] 供应商批号
 *   r[8] 来源采购订单号 | r[9] 行号 | r[10] 供应商编码 | r[11] 供应商名称
 *   r[12] 状态 | r[13] 创建人 | r[14] 业务日期
 */
const U9PurchaseReceipt = sequelize.define('U9PurchaseReceipt', {
  receipt_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '采集记录ID',
  },
  task_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '来源同步任务ID',
  },
  // ===== 列表显示字段（按页面列顺序） =====
  receipt_no: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '单据编号（r[0]）',
  },
  material_code: {
    type: DataTypes.STRING(100),
    comment: '料号（r[1]）',
  },
  material_name: {
    type: DataTypes.STRING(500),
    comment: '料品名称（r[2]）',
  },
  specification: {
    type: DataTypes.STRING(500),
    comment: '料品规格（r[3]）',
  },
  business_type: {
    type: DataTypes.STRING(100),
    comment: '业务类型（r[4]，如标准采购）',
  },
  received_qty: {
    type: DataTypes.STRING(50),
    comment: '实收数量-采购单位（r[5]）',
  },
  receive_lot_no: {
    type: DataTypes.STRING(100),
    comment: '收货批号（r[6]）',
  },
  supplier_lot_no: {
    type: DataTypes.STRING(100),
    comment: '供应商批号（r[7]）',
  },
  source_doc_no: {
    type: DataTypes.STRING(100),
    comment: '来源采购订单号（r[8]）',
  },
  line_no: {
    type: DataTypes.STRING(50),
    comment: '行号（r[9]）',
  },
  supplier_code: {
    type: DataTypes.STRING(100),
    comment: '供应商编码（r[10]）',
  },
  supplier_name: {
    type: DataTypes.STRING(300),
    comment: '供应商名称（r[11]）',
  },
  status: {
    type: DataTypes.STRING(100),
    comment: '单据状态（r[12]，如业务关闭/开立/审核等）',
  },
  created_by: {
    type: DataTypes.STRING(100),
    comment: '创建人（r[13]）',
  },
  receipt_date: {
    type: DataTypes.STRING(50),
    comment: '业务日期（r[14]）',
  },
  raw_data: {
    type: DataTypes.TEXT,
    comment: '原始数据（JSON）',
  },
}, {
  tableName: 'task_purchase_receipt',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['receipt_no', 'line_no'], unique: true, name: 'uk_task_pr_receipt_line' },
    { fields: ['receipt_no'], name: 'idx_task_pr_receipt_no' },
    { fields: ['material_code'], name: 'idx_task_pr_material_code' },
    { fields: ['task_id'], name: 'idx_task_pr_task_id' },
    { fields: ['status'], name: 'idx_task_pr_status' },
    { fields: ['supplier_code'], name: 'idx_task_pr_supplier_code' },
  ],
})

export default U9PurchaseReceipt
