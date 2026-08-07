import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 采集档案表 task_production_order
 * 字段命名与业务主表 production_order 完全对齐（便于直接迁移）
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
    comment: '单据编号（= production_order.order_no）',
  },
  status: {
    type: DataTypes.STRING(100),
    comment: '单据状态（原始字符串：开立/下发/开工/完工/关闭等，迁移时转 TINYINT）',
  },
  material_code: {
    type: DataTypes.STRING(100),
    comment: '料品料号（= production_order.material_code）',
  },
  material_name: {
    type: DataTypes.STRING(300),
    comment: '料品名称（= production_order.material_name）',
  },
  specification: {
    type: DataTypes.STRING(500),
    comment: '规格',
  },
  film_version: {
    type: DataTypes.STRING(200),
    comment: '菲林编号（= production_order.film_version）',
  },
  version_no: {
    type: DataTypes.STRING(100),
    comment: '版本号（= production_order.version_no）',
  },
  barcode: {
    type: DataTypes.STRING(100),
    comment: '条形码',
  },
  planned_qty: {
    type: DataTypes.DECIMAL(18, 4),
    comment: '生产数量（= production_order.planned_qty）',
  },
  finished_qty: {
    type: DataTypes.DECIMAL(18, 4),
    defaultValue: 0,
    comment: '完工数量（对齐 production_order.finished_qty）',
  },
  plan_start_time: {
    type: DataTypes.STRING(50),
    comment: '计划开工日期（= production_order.plan_start_time，原始字符串）',
  },
  plan_end_time: {
    type: DataTypes.STRING(50),
    comment: '计划完工日期（= production_order.plan_end_time，原始字符串）',
  },
  created_by: {
    type: DataTypes.STRING(100),
    comment: '制单人',
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
    { fields: ['order_no'], name: 'idx_task_po_order_no' },
    { fields: ['material_code'], name: 'idx_task_po_material_code' },
    { fields: ['task_id'], name: 'idx_task_po_task_id' },
    { fields: ['status'], name: 'idx_task_po_status' },
    { fields: ['biz_create_date'], name: 'idx_task_po_biz_date' },
  ],
})

export default U9ProductionOrder
