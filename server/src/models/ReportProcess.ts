import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 报工工序子表
// 创建报工单时从产线工序表(bas_line_process)继承工序列表
const ReportProcess = sequelize.define('ReportProcess', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联生产报工单ID',
  },
  process_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '工序ID',
  },
  process_code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: '工序编码',
  },
  process_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '工序名称',
  },
  has_material: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否引入物料：0=否, 1=是',
  },
  must_report: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否必须报工：0=否, 1=是',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '工序顺序',
  },
}, {
  tableName: 'production_report_process',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['report_order_id', 'process_id'] },
    { fields: ['report_order_id'] },
  ],
})

export default ReportProcess
