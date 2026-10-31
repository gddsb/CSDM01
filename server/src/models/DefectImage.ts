import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const DefectImage = sequelize.define('DefectImage', {
  image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '图片ID（主键，不良项配图）',
  },
  defect_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联不良项ID',
  },
  image_url: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '图片访问路径',
  },
  image_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '重命名后的文件名（不良编码+两位流水码）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序号',
  },
  file_hash: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '文件MD5哈希值，用于去重',
  },
}, {
  tableName: 'master_defect_image',
  timestamps: true,
  underscored: true,
  comment: '不良图片表：存储每个不良分类/不良项的现场照片、标注图',
})

export default DefectImage
