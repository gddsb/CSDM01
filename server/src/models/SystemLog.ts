import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 系统日志表
 * 记录服务器运行时产生的 pino 结构化日志（info/warn/error）。
 * 数据来源于 logger.ts 的 DB 批量写入 hook，每次服务启动时自动同步表结构。
 * updatedAt 禁用（日志只追加不修改）。
 */
const SystemLog = sequelize.define('SystemLog', {
  log_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '日志ID（主键）',
  },
  level: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: '日志级别（INFO / WARN / ERROR）',
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '日志分类（如 request / auth / migration / sync — 从 pino 结构化 fields 提取）',
  },
  message: {
    type: DataTypes.TEXT,
    comment: '日志消息（人类可读的简短摘要）',
  },
  details: {
    type: DataTypes.TEXT,
    comment: '完整 JSON 载荷（pino 原始 log 对象 JSON 序列化，含 request/error/stack 等详情）',
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    comment: '请求耗时（毫秒，仅 request 类日志有值）',
  },
  path: {
    type: DataTypes.STRING(255),
    comment: '请求路径（仅 request 类日志有值）',
  },
  method: {
    type: DataTypes.STRING(10),
    comment: 'HTTP 方法（仅 request 类日志有值）',
  },
  status: {
    type: DataTypes.INTEGER,
    comment: 'HTTP 状态码（仅 request 类日志有值）',
  },
  source: {
    type: DataTypes.STRING(100),
    comment: '日志来源模块（如 logger.ts / middleware / service）',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '记录创建时间（服务器本地时区，Sequelize +08:00 自动转北京时间 DATETIME）',
  },
}, {
  tableName: 'sys_system_log',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['level'] },
    { fields: ['created_at'] },
    { fields: ['path'] },
  ],
  comment: '系统日志表：记录服务器运行时的结构化 pino 日志（info/warn/error），用于运维诊断',
})

export default SystemLog
