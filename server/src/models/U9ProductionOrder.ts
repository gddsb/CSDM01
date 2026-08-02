import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const U9ProductionOrder = sequelize.define('U9ProductionOrder', {
  order_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '来源同步任务ID',
  },
  source_type: {
    type: DataTypes.STRING(100),
    comment: '来源类型',
  },
  biz_create_date: {
    type: DataTypes.STRING(50),
    comment: '业务制单日期',
  },
  doc_no: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '单据编号',
  },
  doc_status: {
    type: DataTypes.STRING(100),
    comment: '单据状态',
  },
  item_code: {
    type: DataTypes.STRING(100),
    comment: '料品料号',
  },
  item_name: {
    type: DataTypes.STRING(300),
    comment: '料品名称',
  },
  specification: {
    type: DataTypes.STRING(500),
    comment: '规格',
  },
  film_no: {
    type: DataTypes.STRING(200),
    comment: '菲林编号',
  },
  film_version: {
    type: DataTypes.STRING(100),
    comment: '菲林版本',
  },
  production_qty: {
    type: DataTypes.DECIMAL(18, 4),
    comment: '生产数量',
  },
  created_by: {
    type: DataTypes.STRING(100),
    comment: '制单人',
  },
  plan_start_date: {
    type: DataTypes.STRING(50),
    comment: '计划开工日期',
  },
  plan_end_date: {
    type: DataTypes.STRING(50),
    comment: '计划完工日期',
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
    { fields: ['doc_no'] },
    { fields: ['item_code'] },
    { fields: ['task_id'] },
    { fields: ['doc_status'] },
    { fields: ['biz_create_date'] },
  ],
})

export default U9ProductionOrder
