import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 检验数据统一存储改造（阶段1.2）
 * 统一检验子表：合并来料/产品/微生物三子表
 * 通过 source_type + inspection_id 多态外键关联三主表（无物理FK约束，应用层保证一致性）
 */
const QcInspectionItem = sequelize.define('QcInspectionItem', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '统一检验项ID',
  },
  source_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '来源类型：来料/产品/微生物（多态外键类型标识）',
  },
  inspection_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '多态外键，关联三主表inspection_id（无物理FK约束，应用层保证）',
  },
  item_cfg_id: {
    type: DataTypes.INTEGER,
    comment: '关联quality_inspection_standard_item.item_id（可空，旧数据无）',
  },
  item_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '检验项目名称',
  },
  category: {
    type: DataTypes.STRING(50),
    comment: '项目大类',
  },
  standard_value: {
    type: DataTypes.STRING(500),
    comment: '标准值（定性描述保留）',
  },
  actual_value_text: {
    type: DataTypes.STRING(500),
    comment: '兼容旧数据/单值场景/定性值汇总',
  },
  sample_count: {
    type: DataTypes.INTEGER,
    comment: '实际抽样数',
  },
  summary: {
    type: DataTypes.STRING(200),
    comment: '汇总如8件全合格',
  },
  result: {
    type: DataTypes.TINYINT,
    comment: '0不合格/1合格（综合判定）',
  },
  inspector_id: {
    type: DataTypes.INTEGER,
    comment: '项目检验人ID',
  },
  inspector_name: {
    type: DataTypes.STRING(50),
    comment: '冗余',
  },
  inspection_time: {
    type: DataTypes.DATE,
    comment: '项目检验时间',
  },
  unit: {
    type: DataTypes.STRING(20),
    comment: '单位',
  },
  // —— 检验数据统一存储改造（回填阶段）：从检验标准子表同步的配置字段 ——
  item_type: {
    type: DataTypes.STRING(20),
    comment: '项目类型：qualitative定性(仅判定OK/NG) / quantitative定量(记录测量数值)',
  },
  need_sample_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '默认抽样数（来自检验标准），0=不限制由实际抽样决定',
  },
  nominal_value: {
    type: DataTypes.DECIMAL(15, 4),
    comment: '标称值（定量用，来自检验标准）',
  },
  upper_limit: {
    type: DataTypes.DECIMAL(15, 4),
    comment: '上限（定量用，来自检验标准）',
  },
  lower_limit: {
    type: DataTypes.DECIMAL(15, 4),
    comment: '下限（定量用，来自检验标准）',
  },
  sample_rule: {
    type: DataTypes.STRING(200),
    comment: '抽样方案，来自检验标准',
  },
  sample_count_mode: {
    type: DataTypes.STRING(20),
    defaultValue: 'auto',
    comment: '抽样模式：fixed固定值/percent百分比/auto自动',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
}, {
  tableName: 'qc_inspection_item',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['source_type', 'inspection_id'], name: 'idx_qcii_source_inspection' },
    { fields: ['item_cfg_id'], name: 'idx_qcii_item_cfg' },
    { fields: ['result'], name: 'idx_qcii_result' },
    { fields: ['created_at'], name: 'idx_qcii_created_at' },
  ],
})

export default QcInspectionItem
