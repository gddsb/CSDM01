import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 编号规则表
 * 系统所有自动编号的可视化配置管理。用户可自由组合 前缀 + 日期格式 + 序号位数 + 分隔符。
 * 审核使用后不允许修改前缀/日期格式/序号位数/重置周期等核心配置（is_locked=1）。
 * 每条规则关联一个业务表单（target_table / target_field）和一个序列键（rule_code → sys_sequence.seq_key）。
 *
 * 示例：前缀 WO, 日期 YYMMDD, 序号 4 位, 分隔符 -, 每日重置 → WO-261031-0001
 */
const NumberRule = sequelize.define('NumberRule', {
  rule_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '编号规则ID（主键）',
  },
  rule_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '规则名称（如 生产订单号 / 工单号 / 来料检验单号）',
  },
  rule_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '规则编码（英文唯一标识，同时也是 sys_sequence.seq_key，如 ORDER / WORK_ORDER）',
  },
  prefix: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '编号前缀（如 MO / WO / LL / F 等，生成编号时的首段）',
  },
  date_format: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'YYMMDD',
    comment: '日期段格式：none=无日期, YYMMDD=261031, YYYYMMDD=20261031, YYYY=2026',
  },
  separator: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: '',
    comment: '各段之间的分隔符（如 - 或 / 或空字符串）',
  },
  seq_width: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    comment: '序号位数（左侧补零，如 3 位 → 001 / 002；常用 3-6 位）',
  },
  reset_by: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'daily',
    comment: '序号重置周期：daily=每日重置, yearly=每年重置, never=永不重置',
  },
  target_table: {
    type: DataTypes.STRING(100),
    comment: '关联业务表名（如 production_order / work_order，便于溯源）',
  },
  target_field: {
    type: DataTypes.STRING(100),
    comment: '关联字段名（如 order_no / work_order_no，便于溯源）',
  },
  target_label: {
    type: DataTypes.STRING(100),
    comment: '关联字段中文说明（如 订单编号，前端展示用）',
  },
  current_no: {
    type: DataTypes.STRING(50),
    comment: '最新生成的完整编号（冗余，展示用；如 WO-261031-0123）',
  },
  used_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '已使用的编号总数（用于统计和追溯）',
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '规则状态：1=启用（编号生成时使用）, 0=停用',
  },
  is_locked: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    comment: '是否已审核锁定：0=未锁定（可修改核心配置）, 1=已锁定（核心配置不可改）',
  },
  description: {
    type: DataTypes.STRING(500),
    comment: '规则说明（备注/用途说明）',
  },
  created_by: {
    type: DataTypes.STRING(50),
    comment: '创建人（操作人 username）',
  },
}, {
  tableName: 'sys_number_rule',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '编号规则配置表：前缀+日期+序号+分隔符的可视化编号模板',
})

export default NumberRule
