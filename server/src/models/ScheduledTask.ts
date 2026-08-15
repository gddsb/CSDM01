import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ScheduledTask = sequelize.define('ScheduledTask', {
  schedule_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  schedule_biz_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '计划业务ID',
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '计划名称',
  },
  task_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '任务类型',
  },
  exec_mode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '执行方式：periodic/scheduled/once',
  },
  config: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '调度配置(JSON)',
    get() {
      const raw = this.getDataValue('config')
      if (!raw) return {}
      try { return JSON.parse(raw) } catch { return {} }
    },
    set(val) {
      this.setDataValue('config', val ? JSON.stringify(val) : '{}')
    },
  },
  next_run_at: {
    type: DataTypes.DATE,
    comment: '下次执行时间',
  },
  last_run_at: {
    type: DataTypes.DATE,
    comment: '上次执行时间',
  },
  last_run_result: {
    type: DataTypes.STRING(500),
    comment: '上次执行结果',
  },
  is_enabled: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '是否启用：1-启用 0-停用',
  },
}, {
  tableName: 'task_scheduled',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['is_enabled', 'next_run_at'] },
    { fields: ['task_type'] },
  ],
})

export default ScheduledTask
