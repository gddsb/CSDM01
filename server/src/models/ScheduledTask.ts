import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 定时调度计划表（审核优化原有 comment）
 * 存储用户在前端配置的定时任务调度计划，后端 taskScheduler 轮询此表执行。
 * exec_mode 决定触发方式：periodic=按周期（cron）, scheduled=指定单次时间, once=仅执行一次。
 */
const ScheduledTask = sequelize.define('ScheduledTask', {
  schedule_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '调度计划ID（主键）',
  },
  schedule_biz_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '业务调度UUID（前端创建时生成，用于唯一标识）',
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '调度计划名称（用户自定义，如 每天凌晨导出工单报表）',
  },
  task_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '任务类型（与 taskScheduler 中注册的 handler 名称对应，如 daily_report_export）',
  },
  exec_mode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '执行方式：periodic=周期性（cron）, scheduled=指定单次时间, once=仅执行一次',
  },
  config: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '调度配置（JSON，含 cron 表达式、时间点、业务参数等）',
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
    comment: '下次计划执行时间（taskScheduler 扫描此字段触发执行）',
  },
  last_run_at: {
    type: DataTypes.DATE,
    comment: '上次实际执行时间',
  },
  last_run_result: {
    type: DataTypes.STRING(500),
    comment: '上次执行结果（成功/失败 + 简要说明）',
  },
  is_enabled: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '是否启用：1=启用（taskScheduler 会扫描执行）, 0=停用（跳过）',
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
  comment: '定时调度计划表：存储用户配置的周期性/一次性定时任务',
})

export default ScheduledTask
