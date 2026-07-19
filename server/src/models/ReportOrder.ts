import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 生产报工单主表
// 业务流：生产订单下发后直接创建报工单进行开工报工（无工单层）
// 状态：0=开工, 1=完工
const ReportOrder = sequelize.define('ReportOrder', {
  report_order_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '生产报工单ID',
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联生产订单ID',
  },
  order_no: {
    type: DataTypes.STRING(50),
    comment: '订单号（冗余）',
  },
  report_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '报工单号（WO-16+YYMMDD+3位序号）',
  },
  line_id: {
    type: DataTypes.INTEGER,
    comment: '生产产线ID',
  },
  line_name: {
    type: DataTypes.STRING(100),
    comment: '产线名称（冗余）',
  },
  material_id: {
    type: DataTypes.UUID,
    comment: '料品ID（从订单带出）',
  },
  material_code: {
    type: DataTypes.STRING(50),
    comment: '料号（冗余）',
  },
  material_name: {
    type: DataTypes.STRING(200),
    comment: '料品名称（冗余）',
  },
  specification: {
    type: DataTypes.STRING(200),
    comment: '规格（冗余）',
  },
  report_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '报工数量',
  },
  report_time: {
    type: DataTypes.DATE,
    comment: '报工时间（创建时间）',
  },
  finish_time: {
    type: DataTypes.DATE,
    comment: '完工时间',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '工单状态：0=开工, 1=完工',
    get() {
      const val = this.getDataValue('status')
      const map = { 0: '开工', 1: '完工' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '开工': 0, '完工': 1 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  report_user_id: {
    type: DataTypes.INTEGER,
    comment: '报工人员ID',
  },
  report_user_name: {
    type: DataTypes.STRING(50),
    comment: '报工人员姓名（冗余）',
  },
  finish_user_id: {
    type: DataTypes.INTEGER,
    comment: '完工人员ID',
  },
  finish_user_name: {
    type: DataTypes.STRING(50),
    comment: '完工人员姓名（冗余）',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
}, {
  tableName: 'production_report_order',
  timestamps: true,
  underscored: true,
})

export default ReportOrder
