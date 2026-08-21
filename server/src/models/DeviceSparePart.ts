import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DeviceSparePart = sequelize.define('DeviceSparePart', {
  part_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
    comment: '备件ID',
  },
  part_code: {
    type: DataTypes.STRING(50), unique: true,
    comment: '备件编号',
  },
  part_name: {
    type: DataTypes.STRING(200), allowNull: false,
    comment: '备件名称',
  },
  specification: {
    type: DataTypes.STRING(200),
    comment: '规格型号',
  },
  unit: {
    type: DataTypes.STRING(20), defaultValue: '个',
    comment: '单位',
  },
  applicable_devices: {
    type: DataTypes.JSON,
    comment: '适用设备JSON：[{device_id, device_code, device_name}]',
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '备件分类：机械/电气/液压/气动/电子等',
  },
  safety_stock_min: {
    type: DataTypes.INTEGER, defaultValue: 0,
    comment: '安全库存下限',
  },
  safety_stock_max: {
    type: DataTypes.INTEGER, defaultValue: 0,
    comment: '安全库存上限',
  },
  current_stock: {
    type: DataTypes.INTEGER, defaultValue: 0,
    comment: '当前库存',
  },
  warehouse: { type: DataTypes.STRING(50), comment: '仓库' },
  shelf: { type: DataTypes.STRING(50), comment: '货架' },
  layer: { type: DataTypes.STRING(20), comment: '层位' },
  status: {
    type: DataTypes.TINYINT, defaultValue: 1,
    comment: '状态：1启用, 0禁用',
  },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_spare_part',
  timestamps: true, underscored: true,
  indexes: [{ fields: ['part_code'] }, { fields: ['part_name'] }, { fields: ['category'] }],
})

export default DeviceSparePart
