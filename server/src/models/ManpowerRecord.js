import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ManpowerRecord = sequelize.define('ManpowerRecord', {
  record_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  work_order_id: {
    type: DataTypes.INTEGER,
  },
  work_order_no: {
    type: DataTypes.STRING(50),
  },
  record_date: {
    type: DataTypes.DATEONLY,
  },
  shift: {
    type: DataTypes.STRING(20),
  },
  start_time: {
    type: DataTypes.DATE,
  },
  end_time: {
    type: DataTypes.DATE,
  },
  hours: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  skilled_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  general_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  labor_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  other_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_people: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  man_hours: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  remarks: {
    type: DataTypes.STRING(500),
  },
  record_user: {
    type: DataTypes.STRING(50),
  },
  record_user_name: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'production_manpower_record',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ManpowerRecord
