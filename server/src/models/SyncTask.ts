import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 外部数据同步任务表（审核优化原有 comment）
 * 记录 U9 / 外部系统的数据拉取同步任务状态、进度和错误信息。
 * 任务类型包括 items=料品 / customers=客户 / env_monitor=环境监测 / weather=天气。
 */
const SyncTask = sequelize.define('SyncTask', {
  task_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '同步任务ID（主键）',
  },
  task_biz_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '业务任务UUID（前端发起时生成，用于追踪同一次请求）',
  },
  task_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '同步任务类型：items=料品, customers=客户, env_monitor=环境监测, weather=天气',
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'pending',
    comment: '任务状态：pending=等待中, running=执行中, completed=已完成, failed=失败',
  },
  progress: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '当前进度百分比（0-100）',
  },
  current_step: {
    type: DataTypes.STRING(500),
    defaultValue: '',
    comment: '当前执行步骤的文字说明',
  },
  steps: {
    type: DataTypes.TEXT,
    comment: '完整步骤日志（JSON 数组，每项含 step/index/time/status/message）',
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
    comment: '预期/实际同步的总记录数（用于进度计算）',
  },
  output_file: {
    type: DataTypes.STRING(500),
    comment: '输出文件路径（当同步结果导出为文件时）',
  },
  output_size: {
    type: DataTypes.BIGINT,
    comment: '输出文件大小（bytes）',
  },
  error_msg: {
    type: DataTypes.STRING(2000),
    comment: '失败时的错误信息（堆栈或友好提示）',
  },
  started_at: {
    type: DataTypes.DATE,
    comment: '任务开始执行时间',
  },
  ended_at: {
    type: DataTypes.DATE,
    comment: '任务结束时间（完成或失败时写入）',
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
  comment: '外部数据同步任务日志表：记录 U9/外部系统数据拉取任务状态、进度、错误',
})

export default SyncTask
