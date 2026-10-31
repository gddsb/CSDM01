import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 业务编号序列表
 * 解决通过 count+1 生成编号的并发冲突风险（原 Order/WorkOrder 方式）。
 * 通过 (seq_key, seq_date) 唯一约束 + 事务行锁保证原子性自增。
 * 每次取号：UPDATE ... SET current_value = current_value + 1 RETURNING current_value。
 *
 * 常见 seq_key：ORDER=生产订单, WORK_ORDER=工单, INCOMING=来料检验,
 *   PROCESS=过程检验, FINISHED=成品检验, MICROBE=微生物检验,
 *   ENV=环境监测, COMPLAINT=投诉, SUPPLIER_COMPLAINT=供应商投诉,
 *   NCR=不合格品报告, STANDARD=检验标准, DEVICE_FLT=设备故障,
 *   DEVICE_MAINT=设备保养
 */
const Sequence = sequelize.define('Sequence', {
  seq_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '序列记录ID（主键）',
  },
  seq_key: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '序列类型键（如 ORDER / WORK_ORDER / INCOMING，对应 NumberRule.rule_code）',
  },
  seq_date: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '',
    comment: '序列日期（按日重置用 YYYYMMDD，按年重置用 YYYY，永不用空字符串）',
  },
  current_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '当前序号值（已成功分配的最新值，下次取号时 +1）',
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
  comment: '业务编号序列表：原子化自增编号生成器（按日/年/永不重置）',
})

export default Sequence
