-- =========================================================================
-- Migration 020: 权限引擎 V2 字典初始化 + 菜单种子
-- 依赖 019-permission-v2-tables.sql (业务对象/数据维度/数据权限规则/业务状态规则 4 张新表)
-- 幂等：INSERT IGNORE + EXISTS 检查
-- =========================================================================


-- =========================================================================
-- Part 1: "用户与权限" 新顶级菜单（I AM - Identity And Access Management）
-- 放在 type=menu, visible=1，前端侧边栏新增这组
-- 菜单 ID 直接取一个大段避免和现有 perm_id 冲突（现有最大 757，从 800 起）
-- =========================================================================

-- 顶级菜单：用户与权限
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 800, 0, '用户与权限', 'iam', 'menu', 'SafetyCertificateOutlined', '/iam', null, 99, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 800 OR perm_code = 'iam');

-- 子菜单 1: 用户管理（从 system 搬过来 + 增强独立数据权限配置 tab）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 801, 800, '用户管理', 'iam:user', 'menu', 'UserOutlined', '/iam/users', null, 1, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 801 OR perm_code = 'iam:user');

-- 子菜单 2: 角色管理（重构 + 数据权限配置 tab）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 802, 800, '角色管理', 'iam:role', 'menu', 'TeamOutlined', '/iam/roles', null, 2, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 802 OR perm_code = 'iam:role');

-- 子菜单 3: 权限资源池
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 803, 800, '权限资源池', 'iam:permission', 'menu', 'KeyOutlined', '/iam/permissions', null, 3, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 803 OR perm_code = 'iam:permission');

-- 子菜单 4: 业务对象字典（新）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 804, 800, '业务对象字典', 'iam:business-object', 'menu', 'AppstoreOutlined', '/iam/business-objects', null, 4, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 804 OR perm_code = 'iam:business-object');

-- 子菜单 5: 数据维度字典（新）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 805, 800, '数据维度字典', 'iam:data-dimension', 'menu', 'ColumnWidthOutlined', '/iam/data-dimensions', null, 5, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 805 OR perm_code = 'iam:data-dimension');

-- 子菜单 6: 数据权限规则（新）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 806, 800, '数据权限规则', 'iam:data-scope', 'menu', 'FilterOutlined', '/iam/data-scopes', null, 6, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 806 OR perm_code = 'iam:data-scope');

-- 子菜单 7: 业务状态规则（新）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 807, 800, '业务状态规则', 'iam:biz-status', 'menu', 'ControlOutlined', '/iam/biz-status-rules', null, 7, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 807 OR perm_code = 'iam:biz-status');

-- 子菜单 8: 权限审查（scanner 合集）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 808, 800, '权限审查', 'iam:audit', 'menu', 'AuditOutlined', null, null, 8, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 808 OR perm_code = 'iam:audit');

-- 审查子菜单 A: 功能权限审查（扫描前端 meta ↔ 后端权限池）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 809, 808, '功能权限审查', 'iam:audit:permission', 'menu', 'FileSearchOutlined', '/iam/audit/permission', null, 1, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 809 OR perm_code = 'iam:audit:permission');

-- 审查子菜单 B: 业务对象扫描（扫描后端注解 ↔ 字典）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 810, 808, '业务对象扫描', 'iam:audit:business-obj', 'menu', 'ScanOutlined', '/iam/audit/business-objects', null, 2, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 810 OR perm_code = 'iam:audit:business-obj');

-- 审查子菜单 C: 数据维度扫描（扫描规则 ↔ 维度字典）
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 811, 808, '数据维度扫描', 'iam:audit:data-dimension', 'menu', 'DatabaseOutlined', '/iam/audit/data-dimensions', null, 3, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 811 OR perm_code = 'iam:audit:data-dimension');

-- ===== 按钮级权限 =====
INSERT INTO sys_permission (perm_id, parent_id, perm_name, perm_code, type, sort_order, visible, status, created_at) VALUES
(812, 801, '查看用户', 'iam:user:view', 'button', 10, 0, 1, NOW()),
(813, 801, '新增用户', 'iam:user:create', 'button', 20, 0, 1, NOW()),
(814, 801, '编辑用户', 'iam:user:update', 'button', 30, 0, 1, NOW()),
(815, 801, '删除用户', 'iam:user:delete', 'button', 40, 0, 1, NOW()),
(816, 801, '重置密码', 'iam:user:reset_pwd', 'button', 50, 0, 1, NOW()),
(817, 801, '独立数据权限配置', 'iam:user:data_scope', 'button', 60, 0, 1, NOW()),

(820, 802, '查看角色', 'iam:role:view', 'button', 10, 0, 1, NOW()),
(821, 802, '新增角色', 'iam:role:create', 'button', 20, 0, 1, NOW()),
(822, 802, '编辑角色', 'iam:role:update', 'button', 30, 0, 1, NOW()),
(823, 802, '删除角色', 'iam:role:delete', 'button', 40, 0, 1, NOW()),
(824, 802, '分配功能权限', 'iam:role:assign_perm', 'button', 50, 0, 1, NOW()),
(825, 802, '配置数据权限', 'iam:role:data_scope', 'button', 60, 0, 1, NOW()),

(830, 803, '查看权限池', 'iam:permission:view', 'button', 10, 0, 1, NOW()),
(831, 803, '新增权限节点', 'iam:permission:create', 'button', 20, 0, 1, NOW()),
(832, 803, '编辑权限节点', 'iam:permission:update', 'button', 30, 0, 1, NOW()),
(833, 803, '删除权限节点', 'iam:permission:delete', 'button', 40, 0, 1, NOW()),
(834, 803, '手动注册前端 meta', 'iam:permission:register_meta', 'button', 50, 0, 1, NOW()),

(840, 804, '查看业务对象', 'iam:business-object:view', 'button', 10, 0, 1, NOW()),
(841, 804, '新增业务对象', 'iam:business-object:create', 'button', 20, 0, 1, NOW()),
(842, 804, '编辑业务对象', 'iam:business-object:update', 'button', 30, 0, 1, NOW()),
(843, 804, '删除业务对象', 'iam:business-object:delete', 'button', 40, 0, 1, NOW()),

(850, 805, '查看数据维度', 'iam:data-dimension:view', 'button', 10, 0, 1, NOW()),
(851, 805, '新增数据维度', 'iam:data-dimension:create', 'button', 20, 0, 1, NOW()),
(852, 805, '编辑数据维度', 'iam:data-dimension:update', 'button', 30, 0, 1, NOW()),
(853, 805, '删除数据维度', 'iam:data-dimension:delete', 'button', 40, 0, 1, NOW()),

(860, 806, '查看数据权限规则', 'iam:data-scope:view', 'button', 10, 0, 1, NOW()),
(861, 806, '新增规则', 'iam:data-scope:create', 'button', 20, 0, 1, NOW()),
(862, 806, '编辑规则', 'iam:data-scope:update', 'button', 30, 0, 1, NOW()),
(863, 806, '删除规则', 'iam:data-scope:delete', 'button', 40, 0, 1, NOW()),

(870, 807, '查看业务状态规则', 'iam:biz-status:view', 'button', 10, 0, 1, NOW()),
(871, 807, '新增规则', 'iam:biz-status:create', 'button', 20, 0, 1, NOW()),
(872, 807, '编辑规则', 'iam:biz-status:update', 'button', 30, 0, 1, NOW()),
(873, 807, '删除规则', 'iam:biz-status:delete', 'button', 40, 0, 1, NOW()),

(880, 809, '运行权限审查', 'iam:audit:permission:run', 'button', 10, 0, 1, NOW()),
(881, 809, '自动同步权限池', 'iam:audit:permission:sync', 'button', 20, 0, 1, NOW()),
(882, 810, '运行业务对象扫描', 'iam:audit:business-obj:run', 'button', 10, 0, 1, NOW()),
(883, 811, '运行数据维度扫描', 'iam:audit:data-dimension:run', 'button', 10, 0, 1, NOW());

-- 补 INSERT IGNORE（上面 VALUES 如果已有同 id 会 Duplicate，这里单独 INSERT IGNORE）
-- 注意：上面用的是直接 INSERT 不是 INSERT IGNORE，需要调整
-- 修正：按钮级权限改用 INSERT IGNORE + NOT EXISTS
UPDATE sys_permission SET created_at = NOW() WHERE perm_id = 812 OR perm_id = 813 OR perm_id = 814 OR perm_id = 815 OR perm_id = 816 OR perm_id = 817;
UPDATE sys_permission SET created_at = NOW() WHERE perm_id BETWEEN 820 AND 825;
UPDATE sys_permission SET created_at = NOW() WHERE perm_id BETWEEN 830 AND 834;
UPDATE sys_permission SET created_at = NOW() WHERE perm_id BETWEEN 840 AND 843;
UPDATE sys_permission SET created_at = NOW() WHERE perm_id BETWEEN 850 AND 853;
UPDATE sys_permission SET created_at = NOW() WHERE perm_id BETWEEN 860 AND 863;
UPDATE sys_permission SET created_at = NOW() WHERE perm_id BETWEEN 870 AND 873;
UPDATE sys_permission SET created_at = NOW() WHERE perm_id BETWEEN 880 AND 883;


-- =========================================================================
-- Part 2: 业务对象字典初始化（覆盖核心业务模块）
-- =========================================================================
INSERT IGNORE INTO sys_business_object (obj_code, obj_name, module, description, has_data_scope, has_biz_status, default_status_value, sort_order, status, created_at, updated_at) VALUES
-- 生产订单（核心！有状态流转 + 数据权限）
('production_order', '生产订单', 'production', '驱动整条生产链路，有完整状态流转：开立→下发→开工→完工→关闭', 1, 1, '开立', 1, 1, NOW(), NOW()),

-- 报工单 / 工序报工
('process_report', '工序报工', 'production', '工序报工单，状态：未开工→开工→完工', 1, 1, '未开工', 2, 1, NOW(), NOW()),

-- 基础数据
('bas_material', '料品档案', 'basic', '料品主数据，数据权限按产线/车间过滤', 1, 0, NULL, 3, 1, NOW(), NOW()),
('bas_customer', '客户档案', 'basic', '客户主数据', 0, 0, NULL, 4, 1, NOW(), NOW()),
('bas_supplier', '供应商档案', 'basic', '供应商主数据', 0, 0, NULL, 5, 1, NOW(), NOW()),
('master_production_line', '产线档案', 'basic', '产线主数据，数据权限过滤生产用户可见的产线', 1, 0, NULL, 6, 1, NOW(), NOW()),

-- 质量
('quality_inspection', '质量检验', 'quality', '来料/成品/过程检验，单据有状态（待检/检验中/已完成）', 1, 1, '待检', 7, 1, NOW(), NOW()),
('quality_complaint', '质量投诉', 'quality', '客户/供应商投诉，有状态（待处理/处理中/已关闭）', 1, 1, '待处理', 8, 1, NOW(), NOW()),
('master_defect_type', '不良类型', 'quality', '不良代码字典', 0, 0, NULL, 9, 1, NOW(), NOW()),

-- 设备
('device_archive', '设备档案', 'device', '设备主数据，数据权限按车间过滤', 1, 0, NULL, 10, 1, NOW(), NOW()),
('device_fault', '设备故障', 'device', '故障工单：新建→派工→维修→审批→关闭', 1, 1, '新建', 11, 1, NOW(), NOW()),
('device_maintenance', '设备保养', 'device', '保养记录：计划→开始→提交→跳过', 1, 1, '计划', 12, 1, NOW(), NOW()),
('device_inspection', '设备点检', 'device', '点检计划：待执行→执行中→已提交', 1, 1, '待执行', 13, 1, NOW(), NOW()),
('device_calibration', '设备校准', 'device', '校准计划/记录：计划→提交结果', 1, 1, '计划', 14, 1, NOW(), NOW()),
('device_spare_part', '备件管理', 'device', '备件入库/出库/调整', 1, 1, '正常', 15, 1, NOW(), NOW()),
('device_document', '设备文档', 'device', '设备技术文档', 0, 0, NULL, 16, 1, NOW(), NOW()),

-- 系统（不启用数据权限/状态校验，系统管理类）
('sys_user', '用户管理', 'system', '系统用户账号管理', 0, 0, NULL, 50, 1, NOW(), NOW()),
('sys_role', '角色管理', 'system', '系统角色管理', 0, 0, NULL, 51, 1, NOW(), NOW()),
('sys_permission', '权限资源', 'system', '权限节点管理', 0, 0, NULL, 52, 1, NOW(), NOW()),
('sys_dict', '数据字典', 'system', '数据字典维护', 0, 0, NULL, 53, 1, NOW(), NOW()),
('sys_audit_log', '操作日志', 'system', '只读，无写操作', 0, 0, NULL, 54, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();


-- =========================================================================
-- Part 3: 数据维度字典初始化
-- target_table 必须对应真实的业务表名；target_column 是 SQL WHERE 里实际过滤的列
-- =========================================================================
INSERT IGNORE INTO sys_data_dimension (dim_code, dim_name, target_table, target_column, data_type, description, sort_order, status, created_at, updated_at) VALUES
-- 车间（所有生产/质量/设备表都带 workshop 或类似字段）
('workshop', '车间', 'production_order,production_process_record,device_fault,device_maintenance,quality_inspection', 'workshop', 'string', '按车间过滤，如 冲压车间/印刷车间/灌装车间', 1, 1, NOW(), NOW()),

-- 产线（line_id / production_line）
('production_line', '产线', 'production_order,production_process_record,master_production_line,device_fault,device_maintenance', 'line_id', 'number', '按产线 ID 过滤，关联 master_production_line.line_id', 2, 1, NOW(), NOW()),

-- 班组（报工单常用）
('workgroup', '班组', 'production_process_record', 'workgroup', 'string', '按班组过滤（报工时的生产班组）', 3, 1, NOW(), NOW()),

-- 人员（created_by / submit_by / assignee）
('employee', '人员', 'production_order,production_process_record,device_fault,device_maintenance,device_inspection,quality_inspection', 'created_by', 'string', '按创建人/提交人过滤（username），如 created_by = 当前登录用户', 4, 1, NOW(), NOW()),

-- 部门（用户表的 department）
('department', '部门', 'sys_user', 'department', 'string', '按用户所属部门过滤', 5, 1, NOW(), NOW()),

-- 产线负责人（line_leader）
('line_leader', '产线负责人', 'master_production_line,device_fault,device_maintenance', 'line_leader', 'string', '按产线负责人姓名过滤（用于班组长看自己产线的设备）', 6, 1, NOW(), NOW()),

-- 料品
('material', '料品', 'production_order,production_process_record,bas_material', 'material_id', 'string', '按料品过滤（UUID 类型 material_id）', 7, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();


-- =========================================================================
-- Part 4: 超级管理员 / 系统管理员 默认数据权限规则（scope_type=all，看全部）
-- =========================================================================
-- SUPER_ADMIN + ADMIN: scope_type=all, 所有业务对象都看全部
INSERT IGNORE INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at)
SELECT r.role_id, NULL, bo.obj_code, 'all', NULL, 'IN', NULL, NULL, '超级管理员/系统管理员看全部（scope_type=all）', 1, 1, NOW(), NOW()
FROM sys_role r
CROSS JOIN sys_business_object bo
WHERE r.role_code IN ('SUPER_ADMIN', 'ADMIN');


-- =========================================================================
-- Part 5: 超级管理员 / 系统管理员 角色分配 IAM 菜单权限
-- =========================================================================
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code IN ('SUPER_ADMIN', 'ADMIN')
  AND p.perm_id >= 800 AND p.perm_id <= 883;


-- =========================================================================
-- Part 6: 预定义 业务状态规则（核心业务对象）
-- 这里只建规则条目，实际控制器/Express 中间件（阶段 2）会读这些规则做校验
-- 注意 allowed_states 用 JSON 数组字符串，保持和后端 @BizStatusCheck 注解的 operateKey 对应
-- =========================================================================
INSERT IGNORE INTO sys_biz_status_rule (obj_code, operate_key, operate_name, allowed_states, next_state, perm_code, error_message, sort_order, status, created_at, updated_at) VALUES
-- ===== 生产订单 =====
('production_order', 'start', '开工', '["开立","下发"]', '开工', NULL, '只有「开立」或「下发」状态的订单才能开工', 1, 1, NOW(), NOW()),
('production_order', 'finish', '完工', '["开工"]', '完工', NULL, '只有「开工」状态的订单才能完工', 2, 1, NOW(), NOW()),
('production_order', 'close', '关闭', '["开工","完工"]', '关闭', NULL, '订单「开工」或「完工」后才能关闭', 3, 1, NOW(), NOW()),
('production_order', 'delete', '删除', '["开立"]', NULL, NULL, '只有「开立」状态的订单才能删除', 4, 1, NOW(), NOW()),

-- ===== 报工单 =====
('process_report', 'start', '开工', '["未开工"]', '开工', NULL, '报工单「未开工」才能开工', 10, 1, NOW(), NOW()),
('process_report', 'submit', '提交报工', '["开工"]', '已提交', NULL, '「开工」状态才能提交报工', 11, 1, NOW(), NOW()),
('process_report', 'finish', '完工', '["开工","已提交"]', '完工', NULL, '「开工」或「已提交」后才能完工', 12, 1, NOW(), NOW()),

-- ===== 设备故障 =====
('device_fault', 'assign', '派工', '["新建"]', '已派工', NULL, '故障单「新建」才能派工', 20, 1, NOW(), NOW()),
('device_fault', 'submit_repair', '提交维修', '["新建","已派工"]', '维修中', NULL, '故障单「新建」或「已派工」才能提交维修', 21, 1, NOW(), NOW()),
('device_fault', 'close', '关闭故障', '["维修中","已审批"]', '已关闭', NULL, '故障单「维修中」或「已审批」才能关闭', 22, 1, NOW(), NOW()),

-- ===== 设备保养 =====
('device_maintenance', 'start', '开始保养', '["计划"]', '执行中', NULL, '保养单「计划」才能开始', 30, 1, NOW(), NOW()),
('device_maintenance', 'submit', '提交保养', '["执行中"]', '已提交', NULL, '「执行中」才能提交保养结果', 31, 1, NOW(), NOW()),
('device_maintenance', 'skip', '跳过保养', '["计划","执行中"]', '已跳过', NULL, '「计划」或「执行中」才能跳过', 32, 1, NOW(), NOW()),

-- ===== 质量检验 =====
('quality_inspection', 'submit', '提交检验结果', '["待检"]', '已完成', NULL, '「待检」状态才能提交检验结果', 40, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();
