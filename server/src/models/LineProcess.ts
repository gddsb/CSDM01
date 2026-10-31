import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 产线-工序关联表
 * 描述产线与工序的多对多关系，用于配置柔性工艺路线。
 * (line_id, process_id) 唯一约束，同一工序可分配到多条产线。
 * sort_order 决定该工序在产线的执行顺序。
 */
const LineProcess = sequelize.define('LineProcess', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '关联记录ID（主键）',
  },
  line_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '产线ID（关联 master_production_line.line_id）',
  },
  process_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '工序ID（关联 master_process.process_id）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '执行顺序号（同产线下数值小的工序先执行）',
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '启用状态：1=启用（该工序在产线上生效）, 0=停用',
  },
}, {
  tableName: 'bas_line_process',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['line_id', 'process_id'] },
  ],
  comment: '产线-工序关联表：配置柔性工艺路线（产线能执行哪些工序及顺序）',
})

export default LineProcess
