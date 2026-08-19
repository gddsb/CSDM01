import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const InspectionStandardItem = sequelize.define('InspectionStandardItem', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '检验标准项目ID',
  },
  standard_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '关联检验标准ID',
  },
  item_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '项目名称',
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '项目大类：外观/尺寸/性能/理化/微生物/环境',
  },
  method: {
    type: DataTypes.STRING(200),
    comment: '检验方法',
  },
  sampling_plan: {
    type: DataTypes.STRING(20),
    comment: '抽样方案：AQL抽样/按数量抽样/固定数量抽样/全检',
  },
  sampling_ratio: {
    type: DataTypes.INTEGER,
    comment: '抽样比例（百分比，如 10 表示 10%）',
  },
  sampling_detail: {
    type: DataTypes.TEXT,
    comment: '抽样方案详情JSON：AQL值/分段数量/固定数量/Ac/Re',
  },
  standard_value: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '标准值',
  },
  unit: {
    type: DataTypes.STRING(20),
    comment: '单位',
  },
  defect_level: {
    type: DataTypes.STRING(20),
    comment: '缺陷等级：A类致命缺陷、B类严重缺陷、C类次要缺陷',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序',
  },
  inspection_types: {
    type: DataTypes.STRING(200),
    comment: '检验类型（多选，逗号分隔：首件,制程,成品,来料,其它）',
  },
  // —— 检验数据统一存储改造（阶段1.1）新增字段 ——
  item_type: {
    type: DataTypes.STRING(20),
    comment: '项目类型：qualitative定性(仅判定OK/NG) / quantitative定量(记录测量数值)',
  },
  nominal_value: {
    type: DataTypes.DECIMAL(15, 4),
    comment: '标称值（定量用）',
  },
  upper_limit: {
    type: DataTypes.DECIMAL(15, 4),
    comment: '上限（定量用，可空）',
  },
  lower_limit: {
    type: DataTypes.DECIMAL(15, 4),
    comment: '下限（定量用，可空）',
  },
  // 抽样相关：由 sampling_plan / sampling_ratio / sampling_detail 驱动
}, {
  tableName: 'quality_inspection_standard_item',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['standard_id'] },
  ],
})

export default InspectionStandardItem
