import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const U9Customer = sequelize.define('U9Customer', {
  customer_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '来源同步任务ID',
  },
  customer_code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '客户编码',
  },
  customer_name: {
    type: DataTypes.STRING(500),
    comment: '客户名称',
  },
  short_name: {
    type: DataTypes.STRING(200),
    comment: '简称',
  },
  category_id: {
    type: DataTypes.STRING(100),
    comment: '客户分类ID',
  },
  category_name: {
    type: DataTypes.STRING(200),
    comment: '分类名称',
  },
  is_active: {
    type: DataTypes.TINYINT,
    comment: '是否生效',
  },
  expire_date: {
    type: DataTypes.STRING(50),
    comment: '失效日期',
  },
  effective_date: {
    type: DataTypes.STRING(50),
    comment: '生效日期',
  },
}, {
  tableName: 'u9_customer',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['customer_code'], unique: true },
    { fields: ['task_id'] },
    { fields: ['customer_name'] },
  ],
})

export default U9Customer
