import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Device = sequelize.define('Device', {
  device_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  entity_type: {
    type: DataTypes.ENUM('设备', '仪器'),
    allowNull: false,
    defaultValue: '设备',
    comment: '资产类型：设备/仪器',
  },
  device_code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  device_name: { type: DataTypes.STRING(100), allowNull: false },
  device_type: { type: DataTypes.STRING(50) },
  device_model: { type: DataTypes.STRING(100) },
  serial_no: { type: DataTypes.STRING(100) },
  location: { type: DataTypes.STRING(100) },
  line_id: { type: DataTypes.INTEGER },
  responsible_person: { type: DataTypes.STRING(50) },
  is_special: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    get() {
      const val = this.getDataValue('status')
      const map = { 1: '正常', 0: '停用', 2: '维修' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val: any) {
      if (typeof val === 'string') {
        const map: Record<string, number> = { '正常': 1, '停用': 0, '维修': 2, '在用': 1, '运行': 1 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 1)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  // 校准/保养
  last_inspection_date: { type: DataTypes.DATEONLY },
  inspection_cycle: { type: DataTypes.STRING(50) },
  next_inspection_date: { type: DataTypes.DATEONLY },
  // 仪器专属
  precision: { type: DataTypes.STRING(50), field: '`precision`' },
  department: { type: DataTypes.STRING(50) },
  calibration_type: { type: DataTypes.STRING(20), comment: '校准类型：外校/内校/不需要校准' },
  calibration_cycle: { type: DataTypes.INTEGER, comment: '校准周期（天）' },
  last_calibration_date: { type: DataTypes.DATEONLY },
  next_calibration_date: { type: DataTypes.DATEONLY },
  supplier: { type: DataTypes.STRING(100) },
  manufacturer: { type: DataTypes.STRING(100) },
  purchase_date: { type: DataTypes.DATEONLY },
  warranty_end: { type: DataTypes.DATEONLY },
  remarks: { type: DataTypes.STRING(500) },
}, {
  tableName: 'master_device',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['entity_type'] },
    { fields: ['status'] },
  ],
})

export default Device
