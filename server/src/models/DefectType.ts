import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 不良分类主数据表
 * 定义工厂内所有质量不良的分类，支持树形结构（parent_id 自关联，0=顶级）。
 * 被 ProcessDefect（报工不良）、QualityComplaint（质量投诉）等表引用。
 */
const DefectType = sequelize.define('DefectType', {
  defect_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '不良分类ID（主键）',
  },
  defect_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '不良分类编码（英文唯一标识，如 DEF-SCRATCH / DEF-CRACK）',
  },
  defect_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '不良分类名称（中文显示名，如 划痕 / 裂纹 / 色偏）',
  },
  defect_type: {
    type: DataTypes.STRING(50),
    comment: '不良大类/类型（如 外观 / 尺寸 / 重量 / 材质 / 印刷）',
  },
  category_name: {
    type: DataTypes.STRING(50),
    comment: '所属分类名（冗余，与 parent_id 配合构建分类层级）',
  },
  parent_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '上级分类ID（自关联，0=顶级分类，形成树形结构）',
  },
  defect_unit: {
    type: DataTypes.STRING(20),
    comment: '默认计量单位（如 个 / 件 / % / mg）',
  },
  available_units: {
    type: DataTypes.STRING(255),
    comment: '可选计量单位列表（逗号分隔，如 "个,件,箱"，get/set 自动转数组）',
    get() {
      const val = this.getDataValue('available_units')
      if (!val) return []
      if (Array.isArray(val)) return val
      return val.split(',').map(s => s.trim()).filter(Boolean)
    },
    set(val) {
      if (Array.isArray(val)) {
        this.setDataValue('available_units', val.join(','))
      } else {
        this.setDataValue('available_units', val)
      }
    },
  },
  display: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '前端是否显示：true=显示（报工不良时可选）, false=隐藏（已废弃）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序序号（同级数值小排前）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：1=启用（可用于新建不良记录）, 0=停用',
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
  related_processes: {
    type: DataTypes.STRING(255),
    comment: '关联工序ID列表（逗号分隔，如 "3,5,7"，get/set 自动转数字数组）',
    get() {
      const val = this.getDataValue('related_processes')
      if (!val) return []
      if (Array.isArray(val)) return val
      return val.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
    },
    set(val) {
      if (Array.isArray(val)) {
        this.setDataValue('related_processes', val.join(','))
      } else {
        this.setDataValue('related_processes', val)
      }
    },
  },
  category_desc: {
    type: DataTypes.STRING(500),
    comment: '分类详细说明（描述该不良分类包含哪些具体不良现象）',
  },
}, {
  tableName: 'master_defect_type',
  timestamps: true,
  underscored: true,
  comment: '不良分类主数据表：定义质量不良分类（支持树形结构，被报工/投诉等引用）',
})

export default DefectType
