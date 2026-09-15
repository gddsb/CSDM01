import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 过程检验主表
 *
 * 业务流（移动端简化版）：
 *   选在制品（报工单）→ 填过程参数（温度/湿度/pH 等）→ 快速判定（合格/不合格）→ 提交
 *
 * 编号规则：GC + YYMMDD + 3位序号（参考 sequence.ts 的 PROCESS 键）
 */
const STATUS_MAP = { 0: '待检', 1: '检验中', 2: '已完成', 3: '已关闭' }
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const ProcessInspection = sequelize.define('ProcessInspection', {
  inspection_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '过程检验ID',
  },
  inspection_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '检验编号（GC+YYMMDD+3位序号）',
  },
  report_order_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '关联生产报工单ID（在制品来源）',
  },
  work_order_no: {
    type: DataTypes.STRING(50),
    comment: '报工单号（冗余，便于移动端展示）',
  },
  process_name: {
    type: DataTypes.STRING(100),
    comment: '工序名称（冗余）',
  },
  product_name: {
    type: DataTypes.STRING(200),
    comment: '产品名称（冗余）',
  },
  material_code: {
    type: DataTypes.STRING(50),
    comment: '料号（冗余）',
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '检验时数量',
  },
  // 过程参数（移动端快速填写）
  temperature: { type: DataTypes.STRING(50), comment: '温度（°C）' },
  humidity: { type: DataTypes.STRING(50), comment: '湿度（%）' },
  ph: { type: DataTypes.STRING(50), comment: 'pH 值' },
  params_extra: {
    type: DataTypes.TEXT,
    comment: '扩展参数 JSON（如压力、转速等附加项）',
  },
  result: {
    type: DataTypes.STRING(20),
    comment: '总结果：合格/不合格',
  },
  handle_type: {
    type: DataTypes.STRING(50),
    comment: '处理方式',
  },
  handle_reason: {
    type: DataTypes.STRING(500),
    comment: '处理原因',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    index: true,
    comment: '状态：0=待检, 1=检验中, 2=已完成, 3=已关闭',
    get() {
      const val = this.getDataValue('status')
      return STATUS_MAP[val] !== undefined ? STATUS_MAP[val] : val
    },
    set(val: any) {
      if (typeof val === 'string') {
        this.setDataValue('status', STATUS_REVERSE[val] !== undefined ? STATUS_REVERSE[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  inspector_id: { type: DataTypes.INTEGER, comment: '检验人ID' },
  inspector_name: { type: DataTypes.STRING(50), comment: '检验人姓名（冗余）' },
  inspection_time: { type: DataTypes.DATE, comment: '检验时间' },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'quality_process_inspection',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['inspection_no'], unique: true },
    { fields: ['report_order_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default ProcessInspection
