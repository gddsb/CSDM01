import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 设备保养标准（统一版）
 * 合并旧的 DeviceInspectionStandard + DeviceMaintenanceStandard。
 * 一台设备可以配置多条保养标准，每条标准指定触发频率。
 *
 * 触发频率 trigger_mode 四种互斥值：
 *   daily    — 每天自动生成一条执行记录
 *   weekly   — 每周一自动生成一条执行记录
 *   monthly  — 按 monthly_plan 12 位布尔数组指定哪些月份生成
 *   runtime  — 累计运行时长 >= runtime_threshold 时生成
 */
const DeviceMaintenanceStandard = sequelize.define('DeviceMaintenanceStandard', {
  standard_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '保养标准ID',
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
    comment: '设备ID',
  },
  device_code: { type: DataTypes.STRING(50), comment: '设备编号（冗余）' },
  device_name: { type: DataTypes.STRING(100), comment: '设备名称（冗余）' },

  // ===== 模板左列完整字段 =====
  item_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: '保养项名称（每日点检时必填，其他频率可选）',
  },
  mechanism: { type: DataTypes.STRING(50), comment: '机构（如：压缩机冷热机、散热机构）' },
  component: { type: DataTypes.STRING(50), comment: '部件（如：交换管、过滤网）' },
  location: { type: DataTypes.STRING(50), comment: '部位（如：排风扇、过滤网）' },
  maintenance_method: { type: DataTypes.STRING(50), comment: '保养方法（如：定期点检、定期清理）' },
  maintenance_content: { type: DataTypes.TEXT, comment: '保养内容描述' },

  // ===== 参数 =====
  judge_type: {
    type: DataTypes.STRING(20),
    defaultValue: '定性',
    comment: '判定方式：定性（正常/异常）、定量（数值范围）',
  },
  standard_value: {
    type: DataTypes.STRING(200),
    comment: '判定基准（如：冷凝器两侧干净无绒毛飞絮、≤60℃）',
  },
  unit: { type: DataTypes.STRING(30), comment: '单位' },
  point_count: { type: DataTypes.INTEGER, defaultValue: 1, comment: '保养点位件数' },
  time_per_point: { type: DataTypes.INTEGER, defaultValue: 0, comment: '单件保养时间（分钟）' },

  // ===== 触发频率 =====
  trigger_mode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'daily',
    comment: '触发频率：daily / weekly / monthly / runtime',
  },
  monthly_plan: {
    type: DataTypes.JSON,
    comment: '月度计划矩阵：12 位布尔数组 [true,false,...] 表示1月~12月哪些月执行（trigger_mode=monthly时有效）',
  },
  runtime_threshold: {
    type: DataTypes.DECIMAL(12, 2),
    comment: '运行时长阈值（小时，trigger_mode=runtime时有效）',
  },

  // ===== 执行追踪 =====
  last_trigger_value: {
    type: DataTypes.STRING(50),
    comment: '上次触发的时间点或累计时长值（用于判断下一次触发）',
  },

  sort_order: { type: DataTypes.INTEGER, defaultValue: 0, comment: '排序' },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '状态：1启用, 0禁用',
  },
  remarks: { type: DataTypes.STRING(500), comment: '备注' },
}, {
  tableName: 'device_standard',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['trigger_mode'] },
    { fields: ['status'] },
  ],
})

export default DeviceMaintenanceStandard
