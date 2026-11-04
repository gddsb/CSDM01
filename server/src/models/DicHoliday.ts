import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 休息日/节假日字典（维保跳过用）
const DicHoliday = sequelize.define('DicHoliday', {
  holiday_date: {
    type: DataTypes.DATE,
    primaryKey: true,
    comment: '休息日日期',
  },
  holiday_name: {
    type: DataTypes.STRING(100),
    comment: '休息日名称（如厂休/春节/国庆）',
  },
  is_workday: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '是否调休上班：1=虽然是休息日但要做维保（调休），0=真休息跳过维保',
  },
}, {
  tableName: 'dic_holiday',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '休息日/节假日字典表：用于维保计划生成时跳过休息日',
})

export default DicHoliday
