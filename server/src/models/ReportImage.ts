import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 报工单图片记录子表
// 统一存储报工单相关的各类图片（不良/标签/异常）
const ReportImage = sequelize.define('ReportImage', {
  image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联生产报工单ID',
  },
  category: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: '图片分类：defect=不良, label=标签, exception=异常',
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '图片URL',
  },
  file_hash: {
    type: DataTypes.STRING(64),
    comment: '文件哈希（MD5/SHA-256，用于去重）',
  },
}, {
  tableName: 'production_report_image',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ReportImage
