import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 产线主数据表
 * 定义工厂内的生产流水线（如 1# 冲压线 / 2# 印刷线 / 灌装A线）。
 * 产线通过 LineProcess / LineDevice 关联工序和设备形成工艺路线。
 */
const ProductionLine = sequelize.define('ProductionLine', {
  line_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '产线ID（主键）',
  },
  line_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '产线编码（英文唯一标识，如 LINE_P01 / LINE_PRINT02）',
  },
  line_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '产线名称（中文显示名，如 1# 冲压线 / 2# 印刷线）',
  },
  workshop: {
    type: DataTypes.STRING(50),
    comment: '所属车间（如 冲压车间 / 印刷车间 / 灌装车间）',
  },
  line_leader: {
    type: DataTypes.STRING(50),
    comment: '产线负责人（班组长姓名）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序序号（数值小排前）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '产线状态：1=运行中, 2=维护中, 0=停用',
    get() {
      const val = this.getDataValue('status')
      const map = { 1: '运行中', 2: '维护中', 0: '停用' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '运行中': 1, '维护中': 2, '停用': 0 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 1)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
}, {
  tableName: 'master_production_line',
  timestamps: true,
  underscored: true,
  comment: '产线主数据表：定义工厂内的生产流水线及其基本信息',
})

export default ProductionLine
