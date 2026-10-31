import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 操作日志表
 * 记录用户在系统中的登录查询/增删改等操作，用于审计追溯。
 * status=1 表示操作成功，0 表示失败。
 * updatedAt 禁用（日志只追加不修改）。
 */
const OperationLog = sequelize.define('OperationLog', {
  log_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '日志ID（主键）',
  },
  user_id: {
    type: DataTypes.INTEGER,
    comment: '操作人用户ID（关联 sys_user.user_id，冗余）',
  },
  username: {
    type: DataTypes.STRING(50),
    comment: '操作人登录账号（冗余，方便查询）',
  },
  module: {
    type: DataTypes.STRING(50),
    comment: '操作模块（如 设备管理 / 工单管理 / 系统设置）',
  },
  action: {
    type: DataTypes.STRING(50),
    comment: '操作类型（如 查询 / 新增 / 修改 / 删除 / 导出 / 登录）',
  },
  operation: {
    type: DataTypes.STRING(100),
    comment: '操作描述（简短一句话，如 新增设备故障 F20261031001）',
  },
  content: {
    type: DataTypes.TEXT,
    comment: '操作详情（较长的描述或数据快照，可选）',
  },
  method: {
    type: DataTypes.STRING(10),
    comment: 'HTTP 请求方法（GET / POST / PUT / DELETE）',
  },
  params: {
    type: DataTypes.TEXT,
    comment: '请求参数（JSON 字符串，敏感字段已脱敏）',
  },
  ip: {
    type: DataTypes.STRING(45),
    comment: '客户端 IP（兼容 IPv6）',
  },
  ip_address: {
    type: DataTypes.STRING(45),
    comment: '同上（部分调用处用 ip 部分用 ip_address，同义冗余字段）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '操作结果：1=成功, 0=失败',
  },
}, {
  tableName: 'sys_operation_log',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
  comment: '操作日志表：记录用户登录/查询/增删改等操作，用于审计追溯',
})

export default OperationLog
