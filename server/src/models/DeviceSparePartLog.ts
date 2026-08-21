import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const LOG_TYPE_MAP = { 'in': '入库', 'out': '出库', 'adjust': '调整' }

const DeviceSparePartLog = sequelize.define('DeviceSparePartLog', {
  log_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
  },
  part_id: {
    type: DataTypes.INTEGER, allowNull: false, index: true,
    comment: '备件ID',
  },
  part_code: { type: DataTypes.STRING(50), comment: '备件编号（冗余）' },
  part_name: { type: DataTypes.STRING(200), comment: '备件名称（冗余）' },
  log_type: {
    type: DataTypes.STRING(10), allowNull: false,
    comment: '类型：in入库, out出库, adjust调整',
  },
  quantity: {
    type: DataTypes.INTEGER, allowNull: false,
    comment: '数量（正数）',
  },
  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '单价',
  },
  total_price: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '金额',
  },
  supplier: { type: DataTypes.STRING(200), comment: '供应商' },
  purchase_no: { type: DataTypes.STRING(50), comment: '采购单号' },
  related_order: { type: DataTypes.STRING(50), comment: '关联工单号（维护/维修）' },
  operator_id: { type: DataTypes.INTEGER, comment: '操作人ID' },
  operator_name: { type: DataTypes.STRING(50), comment: '操作人姓名' },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_spare_part_log',
  timestamps: true, underscored: true,
  indexes: [{ fields: ['part_id'] }, { fields: ['log_type'] }, { fields: ['created_at'] }],
})

export { LOG_TYPE_MAP }
export default DeviceSparePartLog
