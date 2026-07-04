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
  skilled_workers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  general_workers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  contract_workers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  auxiliary_workers: {
    type: DataTypes.INTEGER,
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
