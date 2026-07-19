import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 工序不良记录表（简化版，只记录外键，详情通过关联查询获取）
const ProcessDefect = sequelize.define('ProcessDefect', {
  defect_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_id: {
    type: DataTypes.INTEGER,
    comment: '报工单ID',
  },
  work_order_id: {
    type: DataTypes.INTEGER,
    comment: '生产工单ID',
  },
  process_id: {
    type: DataTypes.INTEGER,
    comment: '工序ID',
  },
  defect_type_id: {
    type: DataTypes.INTEGER,
    comment: '不良分类ID',
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '数量',
  },
  unit: {
    type: DataTypes.STRING(20),
    comment: '单位',
  },
  defect_images: {
    type: DataTypes.TEXT,
    comment: '不良图片(JSON数组)',
  },
}, {
  tableName: 'production_process_defect',
  timestamps: true,
  underscored: true,
  createdAt: 'record_time',
  updatedAt: false,
})

export default ProcessDefect