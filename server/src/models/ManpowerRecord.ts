import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

// 人员使用记录子表（关联生产报工单）
const ManpowerRecord = sequelize.define('ManpowerRecord', {
  record_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_order_id: {
    type: DataTypes.INTEGER,
    index: true,
    comment: '生产报工单ID',
  },
  record_date: {
    type: DataTypes.DATEONLY,
    comment: '记录日期',
  },
  shift: {
    type: DataTypes.STRING(20),
    comment: '班次',
  },
  start_time: {
    type: DataTypes.DATE,
    comment: '开始时间',
  },
  end_time: {
    type: DataTypes.DATE,
    comment: '结束时间',
  },
  hours: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '工时',
  },
  skilled_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '熟手人数',
  },
  general_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '普工人数',
  },
  labor_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '劳务人数',
  },
  other_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '其他人数',
  },
  total_people: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总人数',
  },
  man_hours: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '人时',
  },
  remarks: {
    type: DataTypes.STRING(500),
    comment: '备注',
  },
  record_user: {
    type: DataTypes.STRING(50),
    comment: '记录人',
  },
  record_user_name: {
    type: DataTypes.STRING(50),
    comment: '记录人姓名',
  },
}, {
  tableName: 'production_manpower_record',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ManpowerRecord
