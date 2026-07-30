import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DashboardShare = sequelize.define('DashboardShare', {
  share_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  share_token: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '访问令牌(URL参数)',
  },
  config_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联的看板配置ID',
  },
  user_ids: {
    type: DataTypes.TEXT,
    comment: '允许访问的用户ID数组JSON，空表示所有看板查看者',
  },
  expires_at: {
    type: DataTypes.DATE,
    comment: '过期时间，NULL表示永不过期',
  },
  created_by: {
    type: DataTypes.INTEGER,
    comment: '创建人ID',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态: 0-禁用, 1-启用',
  },
  access_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '访问次数统计',
  },
  last_access_at: {
    type: DataTypes.DATE,
    comment: '最后访问时间',
  },
  creator_signature: {
    type: DataTypes.STRING(128),
    comment: '创建人签名(HMAC-SHA256，用于防篡改验证)',
  },
}, {
  tableName: 'dashboard_share',
  timestamps: true,
  underscored: true,
})

export default DashboardShare
