import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const STAGE_MAP: Record<string, number> = {
  '调查': 1,
  '处理': 2,
  '原因分析': 3,
  '回复客户': 4,
  '客户反馈': 5,
  '关闭': 6,
}
const STAGE_REVERSE: Record<number, string> = Object.fromEntries(
  Object.entries(STAGE_MAP).map(([k, v]) => [v, k])
)

const QualityComplaintRecord = sequelize.define('QualityComplaintRecord', {
  record_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '记录ID',
  },
  complaint_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '关联客诉ID',
  },
  stage: {
    type: DataTypes.STRING(30),
    index: true,
    comment: '阶段：调查/处理/原因分析/回复客户/客户反馈/关闭',
    get() {
      const val = this.getDataValue('stage')
      return STAGE_MAP[val] !== undefined ? val : val
    },
  },
  content: {
    type: DataTypes.TEXT,
    comment: '处理内容',
  },
  handler_id: {
    type: DataTypes.INTEGER,
    comment: '处理人ID',
  },
  handler_name: {
    type: DataTypes.STRING(50),
    comment: '处理人姓名（冗余）',
  },
  attachment_url: {
    type: DataTypes.STRING(500),
    comment: '附件URL',
  },
}, {
  tableName: 'quality_complaint_record',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['complaint_id'] },
    { fields: ['stage'] },
  ],
})

export { STAGE_MAP, STAGE_REVERSE }
export default QualityComplaintRecord
