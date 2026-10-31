import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 字典类型表
 * 定义数据字典的分类（如 故障等级 / 工单状态 / 检验方案类型）。
 * 与 DictData 通过 dict_type 字段关联（一对多）。
 */
const DictType = sequelize.define('DictType', {
  dict_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '字典类型ID（主键）',
  },
  dict_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '字典类型中文名称（如 故障等级 / 工单状态）',
  },
  dict_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '字典类型编码（英文唯一标识，如 fault_level / order_status）',
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '字典状态：1=启用, 0=禁用',
  },
  remark: {
    type: DataTypes.STRING(500),
    comment: '备注说明（用途、与哪个业务模块关联等）',
  },
  created_by: {
    type: DataTypes.STRING(50),
    comment: '创建人（操作人 username）',
  },
}, {
  tableName: 'sys_dict_type',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '数据字典类型表：定义字典分类，如故障等级、工单状态等',
})

export default DictType
