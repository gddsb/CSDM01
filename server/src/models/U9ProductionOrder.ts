import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 采集档案表 task_production_order
 * U9生产订单采集表，字段与U9 ERP制造订单MO列表一一对应
 * 采集表与业务主表的字段差异：
 *   - 采集表保留 task_id、source_type、doc_type_name、biz_create_date、raw_data（U9来源字段）
 *   - 采集表数据类型统一为 STRING/DECIMAL，不做类型转换
 */
const U9ProductionOrder = sequelize.define('U9ProductionOrder', {
  order_id: {
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
  // ===== 采集独有字段（U9来源） =====
  source_type: {
    type: DataTypes.STRING(100),
    comment: '来源类型',
  },
  doc_type_name: {
    type: DataTypes.STRING(100),
    comment: '单据类别名称',
  },
  biz_create_date: {
    type: DataTypes.STRING(50),
    comment: '业务制单日期',
  },
  // ===== 以下字段命名、含义与 production_order 完全一致 =====
  order_no: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '单据编号',
  },
  status: {
    type: DataTypes.STRING(100),
    comment: '单据状态（原始字符串：开立/下发/开工/完工/关闭等，迁移时转 TINYINT）',
  },
  material_code: {
    type: DataTypes.STRING(100),
    comment: '料品料号',
  },
  material_name: {
    type: DataTypes.STRING(300),
    comment: '料品品名',
  },
  specification: {
    type: DataTypes.STRING(500),
    comment: '规格',
  },
  film_version: {
    type: DataTypes.STRING(200),
    comment: '菲林编号',
  },
  version_no: {
    type: DataTypes.STRING(100),
    comment: '版本',
  },
  barcode: {
    type: DataTypes.STRING(100),
    comment: '条形码',
  },
  planned_qty: {
    type: DataTypes.DECIMAL(18, 4),
    comment: '排产数量',
  },
  qualified_qty: {
    type: DataTypes.DECIMAL(18, 4),
    defaultValue: 0,
    comment: '累计合格数量',
  },
  plan_start_time: {
    type: DataTypes.STRING(50),
    comment: '计划开工日期（原始字符串）',
  },
  plan_end_time: {
    type: DataTypes.STRING(50),
    comment: '计划完工日期（原始字符串）',
  },
  created_by: {
    type: DataTypes.STRING(100),
    comment: '业务制单人',
  },
  raw_data: {
    type: DataTypes.TEXT,
    comment: '原始数据（JSON）',
  },
}, {
  tableName: 'task_production_order',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['order_no'], unique: true, name: 'uk_task_po_order_no' },
    { fields: ['material_code'], name: 'idx_task_po_material_code' },
    { fields: ['task_id'], name: 'idx_task_po_task_id' },
    { fields: ['status'], name: 'idx_task_po_status' },
    { fields: ['biz_create_date'], name: 'idx_task_po_biz_date' },
  ],
})

export default U9ProductionOrder
