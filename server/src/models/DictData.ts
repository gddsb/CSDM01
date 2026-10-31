import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 字典数据表
 * 存放每种字典类型下的具体枚举值（如 fault_level 字典下有 {label:'一般', value:'1'} 等）。
 * 通过 dict_type 与 DictType.dict_type 字段关联。
 */
const DictData = sequelize.define('DictData', {
  dict_code: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '字典数据ID（主键）',
  },
  dict_sort: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '字典项排序序号（同级按此排序显示）',
  },
  dict_label: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '字典项显示标签（如 一般 / 严重 / 紧急，前端下拉/单选显示）',
  },
  dict_value: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '字典项值（如 1 / 2 / 3，后端存储用的实际值）',
  },
  dict_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '所属字典类型编码（关联 sys_dict_type.dict_type）',
  },
  css_class: {
    type: DataTypes.STRING(100),
    comment: '前端自定义 CSS 类名（用于特殊样式展示）',
  },
  list_class: {
    type: DataTypes.STRING(100),
    comment: '前端列表样式类名（如 ant-tag-red 标签色）',
  },
  is_default: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    comment: '是否该字典类型的默认选项：0=否, 1=是',
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '字典项状态：1=启用, 0=禁用（禁用后前端不下发）',
  },
  remark: {
    type: DataTypes.STRING(500),
    comment: '备注说明',
  },
}, {
  tableName: 'sys_dict_data',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '数据字典数据表：存放具体枚举值，如故障等级=一般/严重/紧急',
})

export default DictData
