import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 设备/仪器主数据表
 * 统一管理生产设备和检测仪器。entity_type 区分两大类：
 *   '设备' = 生产用设备（冲压机、印刷机、灌装机等）
 *   '仪器' = 检测仪器（卡尺、压力表、测试仪等，另有 Instrument 表扩展）
 * 部分字段仅某类资产使用（如 precision 仅仪器有值）。
 */
const Device = sequelize.define('Device', {
  device_id: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true,
    comment: '设备ID（主键，与 Instrument / 其他资产表共用）',
  },
  entity_type: {
    type: DataTypes.ENUM('设备', '仪器'),
    allowNull: false,
    defaultValue: '设备',
    comment: '资产类型：设备=生产设备, 仪器=检测仪器',
  },
  device_code: {
    type: DataTypes.STRING(50),
    allowNull: false, unique: true,
    comment: '资产编号（系统内唯一，如 EQ-PRESS-001 / INS-CALI-015）',
  },
  device_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '资产名称（中文显示名，如 1# 冲压机 / 数显卡尺-015）',
  },
  device_type: {
    type: DataTypes.STRING(50),
    comment: '资产类型/大类（如 冲压机 / 印刷机 / 灌装机 / 计量仪器）',
  },
  device_model: {
    type: DataTypes.STRING(100),
    comment: '型号规格（设备/仪器出厂型号，如 AIDA-2000）',
  },
  serial_no: {
    type: DataTypes.STRING(100),
    comment: '出厂序列号（厂家生产 SN，用于溯源）',
  },
  location: {
    type: DataTypes.STRING(100),
    comment: '放置位置（车间/工位，如 冲压车间 1#工位）',
  },
  line_id: {
    type: DataTypes.INTEGER,
    comment: '所属产线ID（关联 master_production_line.line_id）',
  },
  responsible_person: {
    type: DataTypes.STRING(50),
    comment: '责任人/保管人（员工姓名）',
  },
  is_special: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否特殊/关键设备：true=是（需重点维护和校准）, false=否',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '资产状态：1=正常（在用）, 0=停用, 2=维修中',
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
  last_inspection_date: {
    type: DataTypes.DATEONLY,
    comment: '上次点检/保养日期（DATEONLY 格式 YYYY-MM-DD）',
  },
  inspection_cycle: {
    type: DataTypes.STRING(50),
    comment: '点检/保养周期（如 每日 / 每周 / 每月 / 每季度 / 每半年）',
  },
  next_inspection_date: {
    type: DataTypes.DATEONLY,
    comment: '下次应点检/保养日期（系统自动计算，也可手动调整）',
  },
  precision: {
    type: DataTypes.STRING(50),
    field: '`precision`',
    comment: '精度要求（仅仪器有值，如 ±0.01mm / ±1%FS）',
  },
  department: {
    type: DataTypes.STRING(50),
    comment: '所属部门（如 冲压车间 / 质量部 / 研发中心）',
  },
  calibration_type: {
    type: DataTypes.STRING(20),
    comment: '校准类型：外校=第三方机构 / 内校=内部校准 / 不需要校准',
  },
  calibration_cycle: {
    type: DataTypes.INTEGER,
    comment: '校准周期（天，如 365=每年校准一次）',
  },
  last_calibration_date: {
    type: DataTypes.DATEONLY,
    comment: '上次校准完成日期',
  },
  next_calibration_date: {
    type: DataTypes.DATEONLY,
    comment: '下次应校准日期（到期前系统提醒）',
  },
  supplier: {
    type: DataTypes.STRING(100),
    comment: '供应商名称（购置渠道）',
  },
  manufacturer: {
    type: DataTypes.STRING(100),
    comment: '生产厂家（设备/仪器制造商）',
  },
  purchase_date: {
    type: DataTypes.DATEONLY,
    comment: '购置/入库日期',
  },
  warranty_end: {
    type: DataTypes.DATEONLY,
    comment: '质保到期日（超期后维修费自理）',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注说明（其他需要记录的信息）',
  },
}, {
  tableName: 'master_device',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['entity_type'] },
    { fields: ['status'] },
  ],
  comment: '设备/仪器主数据表：统一管理生产设备和检测仪器基础信息',
})

export default Device
