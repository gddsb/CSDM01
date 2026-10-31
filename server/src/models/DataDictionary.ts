import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 数据字典（元数据登记）表
 * 用于在系统内登记各业务表的用途、字段数、记录数等元信息。
 * fields 字段以 JSON 格式存储字段列表详情（字段名、类型、说明）。
 * 与 sys_dict_type / sys_dict_data 不同，后者是系统枚举字典，本表是业务数据字典登记。
 */
const DataDictionary = sequelize.define('DataDictionary', {
  dict_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '登记记录ID（主键）',
  },
  table_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '表名（对应 MySQL 中的物理表名，如 device_fault）',
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: '业务表',
    comment: '表分类（如 业务表 / 系统表 / U9同步表 / 日志表）',
  },
  purpose: {
    type: DataTypes.STRING(500),
    comment: '表用途说明（一句话描述本表的业务职责）',
  },
  field_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '字段数量（冗余，便于快速统计）',
  },
  record_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '记录行数（冗余，最后一次统计时的行数快照）',
  },
  fields: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '字段详情（JSON 数组，每项含 {name,type,comment,is_nullable,is_pk}）',
    get() {
      const raw = this.getDataValue('fields')
      if (!raw) return []
      try {
        return JSON.parse(raw)
      } catch {
        return []
      }
    },
    set(val) {
      this.setDataValue('fields', val ? JSON.stringify(val) : null)
    },
  },
  last_update: {
    type: DataTypes.DATE,
    comment: '上次刷新统计时间（field_count / record_count 何时更新）',
  },
}, {
  tableName: 'sys_data_dictionary',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '数据字典登记表：登记各业务表的用途、字段元信息',
})

export default DataDictionary
