import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DashboardAccessLog = sequelize.define('DashboardAccessLog', {
  log_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  share_id: {
    type: DataTypes.INTEGER,
    comment: '关联的分享链接ID',
  },
  share_token: {
    type: DataTypes.STRING(64),
    comment: '访问令牌',
  },
  config_id: {
    type: DataTypes.INTEGER,
    comment: '看板配置ID',
  },
  ip: {
    type: DataTypes.STRING(64),
    comment: '访问IP地址',
  },
  user_agent: {
    type: DataTypes.STRING(500),
    comment: '浏览器User-Agent',
  },
  referer: {
    type: DataTypes.STRING(500),
    comment: '来源页面',
  },
  access_result: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '访问结果: 1-成功, 0-失败',
  },
  fail_reason: {
    type: DataTypes.STRING(200),
    comment: '失败原因(如token无效、过期等)',
  },
}, {
  tableName: 'dashboard_access_log',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['share_id'] },
    { fields: ['share_token'] },
    { fields: ['ip'] },
    { fields: ['created_at'] },
  ],
})

export default DashboardAccessLog
