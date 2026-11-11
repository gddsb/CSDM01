import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

/**
 * 权限池（对齐规范文档 3.5 节）
 *
 * 双轨兼容说明 —— 旧字段保留，新字段逐步接管：
 *   旧字段 type varchar(20) → 新字段 perm_type TINYINT  ← Phase 1 已完成迁移
 *   旧字段 path varchar(200) → 新字段 route_path varchar(255)
 *   旧字段 sort_order int → 新字段 sort int
 *   旧字段 parent_id 自关联树形 → 新字段 group_name 字符串分组  ← Phase 7 切换
 *
 * 新字段（规范定义）：
 *   perm_type    tinyint  NOT NULL DEFAULT 1  — 1=页面查看(view), 2=页面按钮(button), 3=表单控件(form), 4=上传控件(upload)
 *   group_name   varchar(64)                  — 归属页面分组名称（按此字段归集权限分组）
 *   group_sort   int       DEFAULT 0           — 分组排序（同级分组间排序）
 *   route_path   varchar(255)                — 页面路由路径（仅 perm_type=1 填写）
 *   sort         int       DEFAULT 0           — 分组内排序（perm_type=1 固定置顶）
 *   is_abandon   tinyint  NOT NULL DEFAULT 0  — 废弃标记：0=正常, 1=废弃（审查未检出，禁止新增勾选）
 *   last_sync_time  datetime                 — 最近一次前端 meta 声明注册上报时间
 *   last_scan_time  datetime                 — 最近一次权限审查扫描命中时间
 *   remark       varchar(255)                 — 备注
 *
 * createdAt 保留，updatedAt 禁用（权限数据通常不更新修改时间）。
 */
const Permission = sequelize.define('Permission', {
  perm_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '权限ID（主键）',
  },

  // —— 旧字段（向后兼容，Phase 5 前代码仍在读写） ——
  parent_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '父级权限ID（0=顶级节点，自关联形成树形结构 — Phase 7 后逐步被 group_name 替代）',
  },
  perm_name: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '权限名称（权限树展示用，规范 3.5：VARCHAR(64)）',
  },
  perm_code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '权限编码（英文唯一标识，如 device:fault:create — 规范文档称 perm_key，本项目用 perm_code 保持向后兼容）',
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'menu',
    comment: '旧权限类型字符串：menu=菜单, button=按钮, api=接口（Phase 5 后切换用 perm_type tinyint）',
  },
  icon: {
    type: DataTypes.STRING(64),
    comment: '菜单图标（Ant Design 图标名，仅 perm_type=1(view) 有值 — 规范 3.5：VARCHAR(64)）',
  },
  path: {
    type: DataTypes.STRING(200),
    comment: '旧前端路由路径（保留兼容，新代码应写 route_path）',
  },
  component: {
    type: DataTypes.STRING(200),
    comment: '前端组件路径（如 pages/device/Fault，仅 type=menu 有值 — 非规范字段，前端概念）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '旧同级排序（保留兼容，新代码应写 sort）',
  },
  visible: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '是否在前端菜单显示：1=显示（可见可访问）, 0=隐藏（不可见但可访问 — 非规范字段，规范用 is_abandon）',
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 1,
    comment: '权限状态：1=启用, 0=停用',
  },

  // —— Phase 1 新增（规范 3.5 对齐字段） ——
  perm_type: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '权限类型（规范 3.5）: 1=页面查看(view), 2=页面按钮(button), 3=表单控件(form), 4=上传控件(upload)',
  },
  group_name: {
    type: DataTypes.STRING(64),
    comment: '归属页面分组名称（按此字段归集权限分组，对应父级菜单 perm_code — 规范 3.5）',
  },
  group_sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '分组排序（同级分组间排序，数值小排前 — 规范 3.5）',
  },
  route_path: {
    type: DataTypes.STRING(255),
    comment: '页面路由路径（如 /system/users，仅 perm_type=1(view) 填写 — 规范 3.5）',
  },
  sort: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '分组内排序（数值小排前，perm_type=1(view) 固定置顶 — 规范 3.5）',
  },
  is_abandon: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    comment: '废弃标记（规范 3.5）: 0=正常（权限审查检出）, 1=废弃（审查未检出，禁止新增勾选）',
  },
  last_sync_time: {
    type: DataTypes.DATE,
    comment: '最近一次前端 meta 声明注册上报时间（规范 3.5）',
  },
  last_scan_time: {
    type: DataTypes.DATE,
    comment: '最近一次权限审查扫描命中时间（规范 3.5）',
  },
  remark: {
    type: DataTypes.STRING(255),
    comment: '备注（规范 3.5）',
  },
}, {
  tableName: 'sys_permission',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
  comment: '系统权限池（规范 3.5）：按 group_name 字符串分组，perm_type tinyint 枚举替代旧 type 字符串',
})

export default Permission
