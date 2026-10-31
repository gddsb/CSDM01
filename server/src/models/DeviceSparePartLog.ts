import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 备件出入库流水表
 * 记录备件每次入库/出库/调整操作，用于追溯备件消耗和流向。
 * 与 DeviceSparePart（备件档案）通过 part_id 关联。
 */
const LOG_TYPE_MAP = { 'in': '入库', 'out': '出库', 'adjust': '调整' }

const DeviceSparePartLog = sequelize.define('DeviceSparePartLog', {
  log_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
    comment: '流水ID（主键）',
  },
  part_id: {
    type: DataTypes.INTEGER, allowNull: false, index: true,
    comment: '备件ID（关联 device_spare_part.part_id）',
  },
  part_code: {
    type: DataTypes.STRING(50),
    comment: '备件编号（冗余，来自 device_spare_part.part_code）',
  },
  part_name: {
    type: DataTypes.STRING(200),
    comment: '备件名称（冗余，来自 device_spare_part.part_name）',
  },
  log_type: {
    type: DataTypes.STRING(10), allowNull: false,
    comment: '流水类型：in=入库, out=出库, adjust=库存调整',
  },
  quantity: {
    type: DataTypes.INTEGER, allowNull: false,
    comment: '本次数量（出库为正数记录减少，入库为正数记录增加）',
  },
  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '出入库时的单价（元，用于成本核算）',
  },
  total_price: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '总金额（= quantity × unit_price）',
  },
  supplier: {
    type: DataTypes.STRING(200),
    comment: '供应商名称（入库时记录供货方）',
  },
  purchase_no: {
    type: DataTypes.STRING(50),
    comment: '关联采购单号（入库时追溯采购单）',
  },
  related_order: {
    type: DataTypes.STRING(50),
    comment: '关联工单/维修单号（出库到某维修/保养工单时记录）',
  },
  operator_id: {
    type: DataTypes.INTEGER,
    comment: '操作人ID（关联 sys_user.user_id）',
  },
  operator_name: {
    type: DataTypes.STRING(50),
    comment: '操作人姓名（冗余，方便查询）',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注说明（调整原因、特殊说明等）',
  },
}, {
  tableName: 'device_spare_part_log',
  timestamps: true, underscored: true,
  indexes: [{ fields: ['part_id'] }, { fields: ['log_type'] }, { fields: ['created_at'] }],
  comment: '备件出入库流水表：追溯备件每次入库/出库/调整操作',
})

export { LOG_TYPE_MAP }
export default DeviceSparePartLog
