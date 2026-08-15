import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const WeatherInfo = sequelize.define('WeatherInfo', {
  weather_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  city: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '城市/区县名称',
  },
  temperature: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    comment: '温度(℃)',
  },
  humidity: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    comment: '相对湿度(%)',
  },
  pressure: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    comment: '大气压(hPa)',
  },
  weather_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '气象发布/观测时间',
  },
  source: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '数据来源站点',
  },
  raw_data: {
    type: DataTypes.TEXT,
    comment: '原始片段(调试用)',
  },
}, {
  tableName: 'task_weather_info',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['city'] },
    { fields: ['weather_time'] },
    { fields: ['source'] },
    { fields: ['city', 'weather_time'] },
  ],
})

export default WeatherInfo
