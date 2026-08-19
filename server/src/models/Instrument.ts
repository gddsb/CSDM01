import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 检测仪器表（独立于 master_device，专用于质量检验仪器管理）
const Instrument = sequelize.define('Instrument', {
  instrument_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  instrument_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '仪器编号（用户手动输入，生成后不可修改）',
  },
  instrument_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '仪器名称',
  },
  instrument_model: {
    type: DataTypes.STRING(100),
    comment: '型号',
  },
  precision: {
    type: DataTypes.STRING(50),
    comment: '设备精度',
  },
  department: {
    type: DataTypes.STRING(50),
    comment: '使用部门',
  },
  location: {
    type: DataTypes.STRING(100),
    comment: '存放地点',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '在用',
    comment: '状态：在用/停用',
  },
  calibration_type: {
    type: DataTypes.STRING(20),
    comment: '校验类型：外校/内校/不需要校准',
  },
  calibration_cycle: {
    type: DataTypes.INTEGER,
    comment: '校准周期（天）',
  },
  last_calibration_date: {
    type: DataTypes.DATEONLY,
    comment: '上次校准日期',
  },
  next_calibration_date: {
    type: DataTypes.DATEONLY,
    comment: '下次校准日期',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
  supplier: {
    type: DataTypes.STRING(100),
    comment: '供应商',
  },
}, {
  tableName: 'quality_instrument',
  timestamps: true,
  underscored: true,
  comment: '检测仪器台账',
})

export default Instrument
