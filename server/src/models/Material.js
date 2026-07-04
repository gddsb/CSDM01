import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const Material = sequelize.define('Material', {
  material_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  category_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  material_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  material_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  specification: {
    type: DataTypes.STRING(200),
  },
  unit_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  film_no: {
    type: DataTypes.STRING(50),
  },
  version_no: {
    type: DataTypes.STRING(50),
  },
  cutting_size: {
    type: DataTypes.STRING(50),
  },
  printing_process: {
    type: DataTypes.STRING(50),
  },
  color_separation: {
    type: DataTypes.STRING(50),
  },
  blanking_diameter: {
    type: DataTypes.DECIMAL(11, 2),
  },
  material_thickness: {
    type: DataTypes.DECIMAL(11, 2),
  },
  material_width: {
    type: DataTypes.DECIMAL(11, 2),
  },
  material_height: {
    type: DataTypes.DECIMAL(11, 2),
  },
  scrap_weight: {
    type: DataTypes.DECIMAL(11, 2),
  },
  unit_weight: {
    type: DataTypes.DECIMAL(11, 2),
  },
  unit_volume: {
    type: DataTypes.DECIMAL(11, 2),
  },
  weight_unit: {
    type: DataTypes.STRING(20),
  },
  volume_unit: {
    type: DataTypes.STRING(20),
  },
  inventory_category: {
    type: DataTypes.STRING(20),
  },
  unit_code: {
    type: DataTypes.STRING(20),
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  effective_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'bas_material',
  timestamps: true,
  underscored: true,
})

export default Material