import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 业务编号序列表
// 解决原有 Order/WorkOrder 通过 count+1 生成编号的并发冲突风险
// 通过 seq_key + seq_date 唯一约束 + 事务行锁保证原子性
const Sequence = sequelize.define('Sequence', {
  seq_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // 序列键，如 ORDER / WORK_ORDER / INCOMING / PROCESS / FINISHED / MICROBE / ENV / INSTRUMENT / COMPLAINT / SUPPLIER_COMPLAINT / NCR / STANDARD
  seq_key: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  // 序列日期，格式 YYYYMMDD；按日重置的编号（如订单号）使用具体日期，按年重置的编号使用 'YYYY' 形式
  seq_date: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '',
  },
  // 当前序号值
  current_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'sys_sequence',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['seq_key', 'seq_date'] },
  ],
})

export default Sequence
