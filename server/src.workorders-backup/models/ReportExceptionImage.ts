import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const ReportExceptionImage = sequelize.define('ReportExceptionImage', {
  image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  report_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
}, {
  tableName: 'production_report_exception_image',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})

export default ReportExceptionImage