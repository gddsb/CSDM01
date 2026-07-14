import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const AppVersion = sequelize.define('AppVersion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  version: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '版本号',
  },
  platform: {
    type: DataTypes.STRING(20),
    defaultValue: 'all',
    comment: '平台: android/ios/all',
  },
  description: {
    type: DataTypes.TEXT,
    comment: '更新描述',
  },
  download_url: {
    type: DataTypes.STRING(500),
    comment: '下载地址',
  },
  is_force: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否强制更新: 0-否 1-是',
  },
  is_latest: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '是否最新版本: 0-否 1-是',
  },
  file_size: {
    type: DataTypes.STRING(50),
    comment: '文件大小',
  },
  created_by: {
    type: DataTypes.STRING(50),
    comment: '发布人',
  },
}, {
  tableName: 'sys_app_version',
  timestamps: true,
  underscored: true,
})

export default AppVersion
