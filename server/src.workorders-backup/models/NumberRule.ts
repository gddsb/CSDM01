import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 编号规则表（sys_number_rule）
// 用于系统中所有自动编号的可视化配置管理
// 设计要点：
// 1. 用户可自由组合编号规则：前缀 + 日期格式 + 序号位数 + 分隔符
// 2. 规则审核使用后不允许修改，但可以停用/启用
// 3. 每个规则可指定关联系统中需要使用编号规则的表单字段（target_table / target_field）
// 4. 显示当前最新编号（current_no）和已经使用的记录数（used_count）
const NumberRule = sequelize.define('NumberRule', {
  rule_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // 规则名称，如"生产订单号"
  rule_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  // 规则编码，对应 sys_sequence.seq_key，如 ORDER/WORK_ORDER 等
  rule_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  // 前缀，如 MO-16 / WO / LL
  prefix: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  // 日期格式：none / YYMMDD / YYYYMMDD / YYYY
  date_format: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'YYMMDD',
  },
  // 分隔符（前缀/日期/序号之间），如 - 或空字符串
  separator: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: '',
  },
  // 序号位数（3/4/5/6）
  seq_width: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
  },
  // 重置周期：daily（每日）/ yearly（每年）/ never（从不）
  reset_by: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'daily',
  },
  // 关联表名，如 production_order / work_order
  target_table: {
    type: DataTypes.STRING(100),
  },
  // 关联字段名，如 order_no / work_order_no
  target_field: {
    type: DataTypes.STRING(100),
  },
  // 关联字段中文说明，如"订单编号"
  target_label: {
    type: DataTypes.STRING(100),
  },
  // 当前最新编号（最近一次生成的完整编号字符串）
  current_no: {
    type: DataTypes.STRING(50),
  },
  // 已使用记录数（已生成的编号总数）
  used_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  // 状态：0-停用 / 1-启用
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  // 是否已审核使用（审核使用后不允许修改前缀/日期格式/序号位数/重置周期等核心配置）
  is_locked: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  // 规则说明
  description: {
    type: DataTypes.STRING(500),
  },
  created_by: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'sys_number_rule',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})

export default NumberRule
