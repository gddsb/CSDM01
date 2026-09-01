import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 设备维护标准档案（设备级）
 * 一台设备一个档案，承载该设备所有点检/维护/保养标准的总体状态。
 *
 * 状态 status 三态：
 *   编制 — 正在配置标准项，不生成执行记录
 *   生效 — 已发布生效，按计划生成执行记录
 *   停用 — 已停用，不再生成新执行记录
 *
 * 设备级状态统一控制该设备下所有标准项（DeviceMaintenanceStandard）的执行记录生成。
 */
const DeviceMaintenanceProfile = sequelize.define('DeviceMaintenanceProfile', {
  profile_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '档案ID',
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    comment: '设备ID（唯一，一台设备一个档案）',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },

  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '编制',
    comment: '档案状态：编制 / 生效 / 停用',
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '版本号，每次重新生效递增',
  },
  effective_date: {
    type: DataTypes.DATEONLY,
    comment: '生效日期',
  },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_maintenance_profile',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['device_id'] },
    { fields: ['status'] },
  ],
})

export default DeviceMaintenanceProfile
