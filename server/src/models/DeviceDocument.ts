import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 文档类型：factory=出厂资料, acceptance=验收资料, external_repair=外保记录, internal_repair=内部维修, modification=改造记录
const DOC_TYPE_MAP = {
  'factory': '出厂资料',
  'acceptance': '验收资料',
  'external_repair': '外保记录',
  'internal_repair': '内部维修',
  'modification': '改造记录',
}

const DeviceDocument = sequelize.define('DeviceDocument', {
  doc_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
    comment: '文档ID',
  },
  device_id: {
    type: DataTypes.INTEGER, allowNull: false, index: true,
    comment: '设备ID',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },
  doc_type: {
    type: DataTypes.STRING(30), allowNull: false, index: true,
    comment: '文档类型：factory/acceptance/external_repair/internal_repair/modification',
  },
  doc_name: {
    type: DataTypes.STRING(200), allowNull: false,
    comment: '文档名称（如：使用说明书、合格证、维修报告）',
  },
  file_path: {
    type: DataTypes.STRING(500), allowNull: false,
    comment: '文件存储路径',
  },
  file_format: {
    type: DataTypes.STRING(20),
    comment: '文件格式：pdf/doc/xlsx/jpg/png',
  },
  file_size: {
    type: DataTypes.INTEGER,
    comment: '文件大小（字节）',
  },
  version: {
    type: DataTypes.STRING(20), defaultValue: 'v1',
    comment: '版本号',
  },
  related_order: {
    type: DataTypes.STRING(50),
    comment: '关联工单号（故障/维护/校准）',
  },
  valid_until: {
    type: DataTypes.DATEONLY,
    comment: '有效期至（外保合同/质保截止）',
  },
  uploaded_by: { type: DataTypes.INTEGER, comment: '上传人ID' },
  uploaded_by_name: { type: DataTypes.STRING(50), comment: '上传人姓名' },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_document',
  timestamps: true, underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['doc_type'] },
    { fields: ['device_id', 'doc_type'] },
  ],
})

export { DOC_TYPE_MAP }
export default DeviceDocument
