import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const SyncTask = sequelize.define('SyncTask', {
  task_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  task_biz_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '业务任务ID(UUID)',
  },
  task_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '任务类型：items/customers/env_monitor/weather',
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'pending',
    comment: '状态：pending/running/completed/failed',
  },
  progress: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '进度(0-100)',
  },
  current_step: {
    type: DataTypes.STRING(500),
    defaultValue: '',
    comment: '当前步骤说明',
  },
  steps: {
    type: DataTypes.TEXT,
    comment: '步骤日志(JSON)',
    get() {
      const raw = this.getDataValue('steps')
      if (!raw) return []
      try { return JSON.parse(raw) } catch { return [] }
    },
    set(val) {
      this.setDataValue('steps', val ? JSON.stringify(val) : '[]')
    },
  },
  total_records: {
    type: DataTypes.INTEGER,
    comment: '总记录数',
  },
  output_file: {
    type: DataTypes.STRING(500),
    comment: '输出文件路径',
  },
  output_size: {
    type: DataTypes.BIGINT,
    comment: '输出文件大小(bytes)',
  },
  error_msg: {
    type: DataTypes.STRING(2000),
    comment: '错误信息',
  },
  started_at: {
    type: DataTypes.DATE,
    comment: '开始时间',
  },
  ended_at: {
    type: DataTypes.DATE,
    comment: '结束时间',
  },
}, {
  tableName: 'task_sync_log',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['task_type', 'status'] },
    { fields: ['created_at'] },
  ],
})

export default SyncTask
