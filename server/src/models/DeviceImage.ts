import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 单据类型：fault=故障上报照片, repair=维修完成照片, inspection=点检照片, maintenance=维护照片, calibration=校准证书
const DeviceImage = sequelize.define('DeviceImage', {
  image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '图片ID',
  },
  doc_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    index: true,
    comment: '单据类型：fault/repair/inspection/maintenance/calibration',
  },
  doc_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '关联单据ID',
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '文件存储路径',
  },
  file_name: {
    type: DataTypes.STRING(200),
    comment: '原始文件名',
  },
  file_size: {
    type: DataTypes.INTEGER,
    comment: '文件大小（字节）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序',
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    comment: '上传人ID',
  },
  uploaded_by_name: {
    type: DataTypes.STRING(50),
    comment: '上传人姓名',
  },
}, {
  tableName: 'device_image',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['doc_type', 'doc_id'] },
  ],
})

export default DeviceImage
