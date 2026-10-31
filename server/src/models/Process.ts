import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 工序主数据表
 * 定义工厂内所有标准化工序（如 冲压 / 印刷 / 灌装 / 检验）。
 * 工序通过 LineProcess / LineDevice 与产线和设备关联形成工艺路线。
 */
const Process = sequelize.define('Process', {
  process_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '工序ID（主键）',
  },
  process_code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    comment: '工序编码（英文唯一标识，如 PRESS / PRINT / FILL / QC）',
  },
  process_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '工序名称（中文显示名，如 冲压 / 印刷 / 灌装）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序序号（工序列表默认排序，数值小排前）',
  },
  has_material: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否消耗物料：1=是（需要录入投料记录）, 0=否',
    get() {
      const val = this.getDataValue('has_material')
      return val === 1 ? '是' : val === 0 ? '否' : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('has_material', val === '是' ? 1 : 0)
      } else {
        this.setDataValue('has_material', val)
      }
    },
  },
  must_report: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否必须报工：1=是（必须完成报工才能流转下一工序）, 0=否',
    get() {
      const val = this.getDataValue('must_report')
      return val === 1 ? '是' : val === 0 ? '否' : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('must_report', val === '是' ? 1 : 0)
      } else {
        this.setDataValue('must_report', val)
      }
    },
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '工序状态：1=启用（可分配到产线）, 0=停用',
    get() {
      const val = this.getDataValue('status')
      return val === 1 ? '启用' : val === 0 ? '停用' : val
    },
    set(val) {
      if (typeof val === 'string') {
        this.setDataValue('status', val === '启用' ? 1 : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
}, {
  tableName: 'master_process',
  timestamps: true,
  underscored: true,
  comment: '工序主数据表：定义工厂内标准化工序（冲压/印刷/灌装等）',
})

export default Process
