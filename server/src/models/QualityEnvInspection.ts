import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STATUS_MAP: Record<number, string> = { 0: '待检', 1: '检验中', 2: '已完成', 3: '已关闭' }
const STATUS_REVERSE: Record<string, number> = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, Number(k)]))

const QualityEnvInspection = sequelize.define('QualityEnvInspection', {
  inspection_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '环境检验ID',
  },
  inspection_no: {
    type: DataTypes.STRING(50),
    unique: true,
    comment: '检验编号（前缀HJ+日期+序号）',
  },
  area_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '关联区域ID',
  },
  area_name: {
    type: DataTypes.STRING(100),
    comment: '区域名称（冗余）',
  },
  trigger_type: {
    type: DataTypes.STRING(20),
    defaultValue: '手工',
    comment: '触发方式：自动/手工',
  },
  result: {
    type: DataTypes.STRING(20),
    comment: '总结果：合格/不合格',
  },
  correction_action: {
    type: DataTypes.STRING(500),
    comment: '纠正措施',
  },
  recheck_date: {
    type: DataTypes.DATE,
    comment: '复查日期',
  },
  recheck_result: {
    type: DataTypes.STRING(20),
    comment: '复查结果：合格/不合格',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    index: true,
    comment: '状态：0=待检, 1=检验中, 2=已完成, 3=已关闭',
    get() {
      const val = this.getDataValue('status')
      return (STATUS_MAP as any)[val] !== undefined ? (STATUS_MAP as any)[val] : val
    },
    set(val: any) {
      if (typeof val === 'string') {
        this.setDataValue('status', (STATUS_REVERSE as any)[val] !== undefined ? (STATUS_REVERSE as any)[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  inspector_id: {
    type: DataTypes.INTEGER,
    comment: '检验人ID',
  },
  inspector_name: {
    type: DataTypes.STRING(50),
    comment: '检验人姓名（冗余）',
  },
  inspection_date: {
    type: DataTypes.DATE,
    comment: '检验日期',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
}, {
  tableName: 'quality_env_inspection',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['inspection_no'], unique: true },
    { fields: ['area_id'] },
    { fields: ['status'] },
    { fields: ['inspection_date'] },
  ],
})

export { STATUS_MAP, STATUS_REVERSE }
export default QualityEnvInspection
