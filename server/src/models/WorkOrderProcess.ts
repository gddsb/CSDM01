import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 生产工单工序表
// 记录生产工单选择的产线对应工序，与生产工单关联
const WorkOrderProcess = sequelize.define('WorkOrderProcess', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  work_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '生产工单ID',
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
    comment: '是否引入物料 0-否 1-是',
    get() {
      const val = this.getDataValue('has_material')
      return val === 1 ? '是' : val === 0 ? '否' : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('has_material', val === '是' ? 1 : 0)
      } else {
        this.setDataValue('has_material', val)
      }
    },
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '工序顺序',
  },
}, {
  tableName: 'production_work_order_process',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['work_order_id', 'process_id'] },
    { fields: ['work_order_id'] },
  ],
})

export default WorkOrderProcess