import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 生产订单主表
 * 从 U9 同步或在 MES 中创建，驱动整条生产链路。
 * 一个订单对应一个料品（Material），可派生成多个工单（ReportOrder）。
 * status 与 u9_status 双轨：u9_status 保留 U9 原始状态字符串，status 是 MES 本地状态。
 */
const Order = sequelize.define('Order', {
  order_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '订单ID（主键）',
  },
  order_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '生产订单号（来自 U9 或本地生成，如 MO20261031001）',
  },
  material_id: {
    type: DataTypes.UUID,
    comment: '料品ID（关联 bas_material.material_id，UUID 类型主键）',
  },
  material_code: {
    type: DataTypes.STRING(50),
    comment: '料品编码（冗余，来自 bas_material.material_code）',
  },
  material_name: {
    type: DataTypes.STRING(100),
    comment: '料品名称（冗余，来自 bas_material.material_name）',
  },
  specification: {
    type: DataTypes.STRING(200),
    comment: '规格型号（冗余，来自 bas_material.specification）',
  },
  film_version: {
    type: DataTypes.STRING(50),
    comment: '菲林编号/版本（来自料品档案 film_no）',
  },
  version_no: {
    type: DataTypes.STRING(50),
    comment: '版本号（料品设计版本，如 V1 / V2.1）',
  },
  barcode: {
    type: DataTypes.STRING(100),
    comment: '料品条形码（生产追溯扫码用）',
  },
  planned_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '计划生产数量（订单要求数量）',
  },
  finished_qty: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: '累计完工数量（从 MES 报工单汇总回填）',
  },
  u9_qualified: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    comment: 'U9 同步的累计合格数量（U9 端返回）',
  },
  plan_start_time: {
    type: DataTypes.DATE,
    comment: '计划开工时间（排产时设定）',
  },
  plan_end_time: {
    type: DataTypes.DATE,
    comment: '计划完工时间（排产时设定）',
  },
  u9_status: {
    type: DataTypes.STRING(50),
    comment: 'U9 原始状态字符串（如 开立 / 开工 / 完工 / 关闭，保留 U9 原始值）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: 'MES 本地状态：0=开立, 1=下发, 2=开工, 3=完工, 4=关闭',
    get() {
      const val = this.getDataValue('status')
      const map = { 0: '开立', 1: '下发', 2: '开工', 3: '完工', 4: '关闭' }
      return map[val] !== undefined ? map[val] : val
    },
    set(val) {
      if (typeof val === 'string') {
        const map = { '开立': 0, '下发': 1, '开工': 2, '完工': 3, '关闭': 4 }
        this.setDataValue('status', map[val] !== undefined ? map[val] : 0)
      } else {
        this.setDataValue('status', val)
      }
    },
  },
  release_time: {
    type: DataTypes.DATE,
    comment: '下发/开工时间（订单状态转为开工时记录）',
  },
  close_time: {
    type: DataTypes.DATE,
    comment: '完工关闭时间（订单状态转为关闭时记录）',
  },
  created_by: {
    type: DataTypes.STRING(50),
    comment: '创建人（操作人 username，自动或手动创建时记录）',
  },
}, {
  tableName: 'production_order',
  timestamps: true,
  underscored: true,
  comment: '生产订单主表：从 U9 同步或本地创建，驱动整条生产链路',
})

export default Order
