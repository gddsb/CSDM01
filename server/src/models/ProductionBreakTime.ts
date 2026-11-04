import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 报工单休息时间段（关联表，支持多条）
const ProductionBreakTime = sequelize.define('ProductionBreakTime', {
  break_time_id: {
    type: DataTypes.CHAR(36),
    primaryKey: true,
    comment: '休息记录ID（UUID）',
  },
  report_order_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    index: true,
    comment: '关联报工单ID',
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '休息开始时间（含日期）',
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '休息结束时间（含日期）',
  },
  duration_minutes: {
    type: DataTypes.INTEGER,
    comment: '休息时长（分钟，MySQL STORED 自动计算）',
    set() { /* 只读：DB STORED */ },
  },
  remark: {
    type: DataTypes.STRING(200),
    comment: '备注',
  },
}, {
  tableName: 'production_break_time',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '报工单休息时间段表：支持一个报工单多条休息记录（如中午+下午各一段）',
})

export default ProductionBreakTime
