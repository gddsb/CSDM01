import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 产线-工序关联表（bas_line_process，设计文档 §2.2.6）
// 描述产线与工序多对多关系，用于柔性工艺路线配置
const LineProcess = sequelize.define('LineProcess', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  line_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  process_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'bas_line_process',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['line_id', 'process_id'] },
  ],
})

export default LineProcess
