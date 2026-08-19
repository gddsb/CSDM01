import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 检验数据统一存储改造（阶段1.3）
 * 样品测量值明细表：一条记录 = 1个样板的1个检验项目的1组结果
 * 不管定性、定量全部落在这里，一套结构兼容两种场景
 * - 定量：measure_value_num 存数值，可聚合做SPC
 * - 定性：measure_value_text 存 OK/NG/无缺口 等描述
 */
const QcInspectionSampleValue = sequelize.define('QcInspectionSampleValue', {
  value_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '测量值ID',
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联qc_inspection_item.item_id',
  },
  sample_no: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '样板序号1..N（第几件样品）',
  },
  dimension_code: {
    type: DataTypes.STRING(30),
    comment: '测量维度编码如D/d/b/H（单值时统一VALUE）',
  },
  dimension_name: {
    type: DataTypes.STRING(100),
    comment: '维度名称如钩边外径',
  },
  measure_value_num: {
    type: DataTypes.DECIMAL(15, 4),
    comment: '定量值（可聚合，SPC用）',
  },
  measure_value_text: {
    type: DataTypes.STRING(50),
    comment: '定性值OK/NG/无缺口',
  },
  is_qualified: {
    type: DataTypes.TINYINT,
    comment: '0不合格/1合格',
  },
  defect_desc: {
    type: DataTypes.STRING(500),
    comment: '缺陷描述',
  },
  measured_at: {
    type: DataTypes.DATE,
    comment: '测量时间',
  },
  inspector_id: {
    type: DataTypes.INTEGER,
    comment: '测量人ID',
  },
}, {
  tableName: 'qc_inspection_sample_value',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['item_id', 'sample_no', 'dimension_code'], unique: true, name: 'uk_qcisv_item_sample_dim' },
    { fields: ['item_id'], name: 'idx_qcisv_item' },
    { fields: ['sample_no'], name: 'idx_qcisv_sample' },
  ],
})

export default QcInspectionSampleValue
