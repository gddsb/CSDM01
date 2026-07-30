import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const TaskSetting = sequelize.define('TaskSetting', {
  setting_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  task_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: '任务类型：items/customers/env_monitor/weather',
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '任务名称',
  },
  description: {
    type: DataTypes.STRING(1000),
    comment: '任务描述',
  },
  source_url: {
    type: DataTypes.STRING(500),
    comment: '数据源URL',
  },
  field_count: {
    type: DataTypes.INTEGER,
    comment: '字段数量',
  },
  is_active: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '是否启用：1-启用 0-停用',
  },
  params: {
    type: DataTypes.TEXT,
    comment: '执行参数(JSON)，如用户名、密码等',
    get() {
      const raw = this.getDataValue('params')
      if (!raw) return null
      try { return JSON.parse(raw) } catch { return null }
    },
    set(val) {
      this.setDataValue('params', val ? JSON.stringify(val) : null)
    },
  },
}, {
  tableName: 'u9_task_setting',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})

export default TaskSetting
