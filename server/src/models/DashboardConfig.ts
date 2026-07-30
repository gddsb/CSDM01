import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DashboardConfig = sequelize.define('DashboardConfig', {
  config_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  config_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '滚动看板配置名称',
  },
  dashboards: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '看板列表JSON: [{path, name, sort_order, duration}]',
  },
  default_duration: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: '每个看板默认停留时间(秒)',
  },
  is_default: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否默认配置: 0-否, 1-是',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态: 0-禁用, 1-启用',
  },
  created_by: {
    type: DataTypes.INTEGER,
    comment: '创建人ID',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
}, {
  tableName: 'dashboard_config',
  timestamps: true,
  underscored: true,
})

export default DashboardConfig
