import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Supplier = sequelize.define('Supplier', {
  supplier_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  supplier_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  supplier_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  short_name: {
    type: DataTypes.STRING(100),
  },
  supplier_category: {
    type: DataTypes.STRING(50),
  },
  contact_person: {
    type: DataTypes.STRING(50),
  },
  phone: {
    type: DataTypes.STRING(50),
  },
  email: {
    type: DataTypes.STRING(100),
  },
  address: {
    type: DataTypes.STRING(300),
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  credit_level: {
    type: DataTypes.STRING(20),
  },
  tax_id: {
    type: DataTypes.STRING(50),
  },
  bank_account: {
    type: DataTypes.STRING(50),
  },
  bank_name: {
    type: DataTypes.STRING(100),
  },
  remark: {
    type: DataTypes.STRING(500),
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  created_by: {
    type: DataTypes.STRING(50),
  },
}, {
  tableName: 'bas_supplier',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})

export default Supplier
