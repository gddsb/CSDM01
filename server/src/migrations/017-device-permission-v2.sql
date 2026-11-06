-- ============================================================
-- Migration 017: device 模块细粒度权限码升级
-- 新增 platform:module:submodule:action 体系
-- 旧 device:* 码保留，auth.ts 的 candidates 逻辑自动匹配新码
-- 幂等：INSERT IGNORE + 先查后写角色分配
-- ============================================================

-- ===== 第 1 部分：设备档案 =====
INSERT IGNORE INTO sys_permission (parent_id, perm_name, perm_code, type, sort_order, visible, status, created_at) VALUES
(0, 'PC端设备管理', 'pc:device', 'menu', 5, 1, 1, NOW()),
(0, '移动端设备管理', 'mobile:device', 'menu', 5, 1, 1, NOW()),
(0, '设备管理（通用）', 'all:device', 'menu', 5, 1, 1, NOW()),

(0, '查看设备档案', 'all:device:list:view', 'api', 10, 0, 1, NOW()),
(0, '新增设备档案', 'pc:device:list:create', 'api', 10, 0, 1, NOW()),
(0, '编辑设备档案', 'pc:device:list:update', 'api', 10, 0, 1, NOW()),
(0, '删除设备档案', 'pc:device:list:delete', 'api', 10, 0, 1, NOW()),
(0, '显示设备状态列', 'pc:device:list:column:status', 'button', 10, 0, 1, NOW()),
(0, '显示负责人列', 'pc:device:list:column:responsible', 'button', 10, 0, 1, NOW()),

-- ===== 第 2 部分：故障管理 =====
(0, '查看设备故障', 'all:device:fault:view', 'api', 20, 0, 1, NOW()),
(0, '新增故障记录', 'pc:device:fault:create', 'api', 20, 0, 1, NOW()),
(0, '派工', 'pc:device:fault:assign', 'api', 20, 0, 1, NOW()),
(0, '提交维修', 'pc:device:fault:submit_repair', 'api', 20, 0, 1, NOW()),
(0, '审批故障', 'pc:device:fault:approve', 'api', 20, 0, 1, NOW()),
(0, '关闭故障', 'pc:device:fault:close', 'api', 20, 0, 1, NOW()),
(0, '删除故障记录', 'pc:device:fault:delete', 'api', 20, 0, 1, NOW()),
(0, '上传故障图片', 'pc:device:fault:upload_image', 'button', 20, 0, 1, NOW()),
(0, '查看全部故障（数据权限）', 'all:device:fault:view_all', 'api', 20, 0, 1, NOW()),

(0, '移动端-查看故障', 'mobile:device:fault:view', 'api', 20, 0, 1, NOW()),
(0, '移动端-新增故障', 'mobile:device:fault:create', 'api', 20, 0, 1, NOW()),
(0, '移动端-派工', 'mobile:device:fault:assign', 'api', 20, 0, 1, NOW()),
(0, '移动端-提交维修', 'mobile:device:fault:submit_repair', 'api', 20, 0, 1, NOW()),
(0, '移动端-关闭故障', 'mobile:device:fault:close', 'api', 20, 0, 1, NOW()),

-- ===== 第 3 部分：保养管理 =====
(0, '查看保养记录', 'all:device:maintenance:view', 'api', 30, 0, 1, NOW()),
(0, '新建保养标准', 'pc:device:maintenance:create', 'api', 30, 0, 1, NOW()),
(0, '分配保养标准', 'pc:device:maintenance:assign', 'api', 30, 0, 1, NOW()),
(0, '生成保养执行单', 'pc:device:maintenance:generate', 'api', 30, 0, 1, NOW()),
(0, '清理重建', 'pc:device:maintenance:cleanup', 'api', 30, 0, 1, NOW()),
(0, '开始保养', 'pc:device:maintenance:start', 'api', 30, 0, 1, NOW()),
(0, '提交保养', 'pc:device:maintenance:submit', 'api', 30, 0, 1, NOW()),
(0, '批量提交', 'pc:device:maintenance:batch_submit', 'api', 30, 0, 1, NOW()),
(0, '跳过保养', 'pc:device:maintenance:skip', 'api', 30, 0, 1, NOW()),
(0, '删除保养记录', 'pc:device:maintenance:delete', 'api', 30, 0, 1, NOW()),
(0, '上传保养图片', 'pc:device:maintenance:upload_image', 'button', 30, 0, 1, NOW()),
(0, '查看全部保养（数据权限）', 'all:device:maintenance:view_all', 'api', 30, 0, 1, NOW()),

(0, '移动端-查看保养', 'mobile:device:maintenance:view', 'api', 30, 0, 1, NOW()),
(0, '移动端-开始保养', 'mobile:device:maintenance:start', 'api', 30, 0, 1, NOW()),
(0, '移动端-提交保养', 'mobile:device:maintenance:submit', 'api', 30, 0, 1, NOW()),
(0, '移动端-跳过保养', 'mobile:device:maintenance:skip', 'api', 30, 0, 1, NOW()),

-- ===== 第 4 部分：点检管理 =====
(0, '查看点检计划', 'all:device:inspection:view', 'api', 40, 0, 1, NOW()),
(0, '新建点检计划', 'pc:device:inspection:create', 'api', 40, 0, 1, NOW()),
(0, '提交点检', 'pc:device:inspection:submit', 'api', 40, 0, 1, NOW()),
(0, '跳过大检', 'pc:device:inspection:skip', 'api', 40, 0, 1, NOW()),

(0, '移动端-点检', 'mobile:device:inspection:view', 'api', 40, 0, 1, NOW()),
(0, '移动端-提交点检', 'mobile:device:inspection:submit', 'api', 40, 0, 1, NOW()),

-- ===== 第 5 部分：校准管理 =====
(0, '查看校准', 'all:device:calibration:view', 'api', 50, 0, 1, NOW()),
(0, '新建校准计划', 'pc:device:calibration:create_plan', 'api', 50, 0, 1, NOW()),
(0, '编辑校准计划', 'pc:device:calibration:update_plan', 'api', 50, 0, 1, NOW()),
(0, '删除校准计划', 'pc:device:calibration:delete_plan', 'api', 50, 0, 1, NOW()),
(0, '提交校准结果', 'pc:device:calibration:submit', 'api', 50, 0, 1, NOW()),
(0, '上传校准证书', 'pc:device:calibration:upload_certificate', 'button', 50, 0, 1, NOW()),

(0, '移动端-校准提醒', 'mobile:device:calibration:view', 'api', 50, 0, 1, NOW()),
(0, '移动端-提交校准', 'mobile:device:calibration:submit', 'api', 50, 0, 1, NOW()),
(0, '移动端-上传证书', 'mobile:device:calibration:upload_certificate', 'button', 50, 0, 1, NOW()),

-- ===== 第 6 部分：备件管理 =====
(0, '查看备件', 'all:device:spare-part:view', 'api', 60, 0, 1, NOW()),
(0, '新增备件', 'pc:device:spare-part:create', 'api', 60, 0, 1, NOW()),
(0, '编辑备件', 'pc:device:spare-part:update', 'api', 60, 0, 1, NOW()),
(0, '删除备件', 'pc:device:spare-part:delete', 'api', 60, 0, 1, NOW()),
(0, '备件入库', 'pc:device:spare-part:stock_in', 'api', 60, 0, 1, NOW()),
(0, '备件出库', 'pc:device:spare-part:stock_out', 'api', 60, 0, 1, NOW()),
(0, '备件调整', 'pc:device:spare-part:stock_adjust', 'api', 60, 0, 1, NOW()),

(0, '移动端-备件', 'mobile:device:spare-part:view', 'api', 60, 0, 1, NOW()),
(0, '移动端-入库', 'mobile:device:spare-part:stock_in', 'api', 60, 0, 1, NOW()),
(0, '移动端-出库', 'mobile:device:spare-part:stock_out', 'api', 60, 0, 1, NOW()),

-- ===== 第 7 部分：文档 / OEE / Dashboard =====
(0, '查看设备文档', 'all:device:document:view', 'api', 70, 0, 1, NOW()),
(0, '上传文档', 'pc:device:document:create', 'api', 70, 0, 1, NOW()),
(0, '编辑文档', 'pc:device:document:update', 'api', 70, 0, 1, NOW()),
(0, '删除文档', 'pc:device:document:delete', 'api', 70, 0, 1, NOW()),
(0, '下载文档', 'pc:device:document:download', 'button', 70, 0, 1, NOW()),
(0, '移动端-文档', 'mobile:device:document:view', 'api', 70, 0, 1, NOW()),

(0, '查看设备 OEE', 'all:device:oee:view', 'api', 80, 0, 1, NOW()),
(0, 'PC端-OEE', 'pc:device:oee:view', 'api', 80, 0, 1, NOW()),

(0, '查看设备看板', 'all:device:dashboard:view', 'api', 90, 0, 1, NOW()),
(0, 'PC端-设备看板', 'pc:device:dashboard:view', 'api', 90, 0, 1, NOW())
;


-- ============================================================
-- 角色权限分配（幂等）
-- 规则：view 类两端联动（配了 all:*），action 类只配 pc:*
-- 移动端需要的 action 码单独配 mobile:*
-- ============================================================

-- 先给超级管理员配 '*' 通配符（彻底替代 role_code === 'SUPER_ADMIN' 硬编码）
INSERT IGNORE INTO sys_permission (parent_id, perm_name, perm_code, type, sort_order, visible, status, created_at)
SELECT 0, '超级通配', '*', 'api', 0, 0, 1, NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = '*');

-- SUPER_ADMIN: '*' 通配 + 全模块显式分配（双保险）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'SUPER_ADMIN'
  AND (p.perm_code = '*' OR p.perm_code LIKE '%:device:%' OR p.perm_code LIKE 'device%');

-- SYSTEM_ADMIN: 全模块权限（与 SUPER_ADMIN 同级，不含 '*' 通配符以避免系统保护绕过）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'SYSTEM_ADMIN'
  AND (p.perm_code LIKE '%:device:%' OR p.perm_code LIKE 'device%');

-- 生产主管 PM: 设备档案 view, 故障 view+assign+view_all, 保养 view, 点检 view, 校准 view
-- 移动端: 故障 view/create, 保养 view/start/submit, 点检 view/submit
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'PM' AND p.perm_code IN (
  -- 档案
  'all:device', 'pc:device',
  'all:device:list:view',
  'pc:device:list:column:status', 'pc:device:list:column:responsible',
  -- 故障 view + 派工 + 看全部
  'all:device:fault:view', 'pc:device:fault:assign', 'pc:device:fault:close',
  'all:device:fault:view_all',
  -- 保养 / 点检 / 校准 / OEE / Dashboard
  'all:device:maintenance:view', 'all:device:inspection:view',
  'all:device:calibration:view', 'all:device:oee:view', 'all:device:dashboard:view',
  -- 移动端
  'mobile:device:menu', 'mobile:device:fault:view', 'mobile:device:fault:create',
  'mobile:device:maintenance:view', 'mobile:device:maintenance:start', 'mobile:device:maintenance:submit',
  'mobile:device:inspection:view', 'mobile:device:inspection:submit'
);

-- 设备维护员 MAINT: 档案 view+update, 故障 view+create+submit_repair+close+view_all, 保养全, 点检全, 备件 in/out
-- 移动端: 故障 view+create+submit+close, 保养 view+start+submit+skip, 点检全, 备件 in/out
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'MAINT' AND p.perm_code IN (
  'all:device', 'pc:device', 'pc:device:list:create', 'pc:device:list:update', 'pc:device:list:delete',
  'all:device:list:view',
  'pc:device:list:column:status', 'pc:device:list:column:responsible',
  -- 故障
  'all:device:fault:view', 'pc:device:fault:create', 'pc:device:fault:submit_repair',
  'pc:device:fault:close', 'pc:device:fault:delete', 'pc:device:fault:upload_image',
  'all:device:fault:view_all',
  -- 保养
  'all:device:maintenance:view', 'pc:device:maintenance:start', 'pc:device:maintenance:submit',
  'pc:device:maintenance:batch_submit', 'pc:device:maintenance:skip', 'pc:device:maintenance:upload_image',
  'all:device:maintenance:view_all',
  -- 点检
  'all:device:inspection:view', 'pc:device:inspection:submit', 'pc:device:inspection:skip',
  -- 校准 view
  'all:device:calibration:view',
  -- 备件
  'all:device:spare-part:view', 'pc:device:spare-part:stock_in', 'pc:device:spare-part:stock_out', 'pc:device:spare-part:stock_adjust',
  -- OEE / Dashboard
  'all:device:oee:view', 'all:device:dashboard:view', 'pc:device:dashboard:view',
  -- 移动端
  'mobile:device',
  'mobile:device:fault:view', 'mobile:device:fault:create', 'mobile:device:fault:submit_repair', 'mobile:device:fault:close',
  'mobile:device:maintenance:view', 'mobile:device:maintenance:start', 'mobile:device:maintenance:submit', 'mobile:device:maintenance:skip',
  'mobile:device:inspection:view', 'mobile:device:inspection:submit',
  'mobile:device:spare-part:view', 'mobile:device:spare-part:stock_in', 'mobile:device:spare-part:stock_out'
);

-- 质量管理员 QM: 校准全 + 故障 view
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'QM' AND p.perm_code IN (
  'all:device', 'pc:device',
  'all:device:fault:view',
  'all:device:calibration:view', 'pc:device:calibration:create_plan', 'pc:device:calibration:update_plan',
  'pc:device:calibration:delete_plan', 'pc:device:calibration:submit', 'pc:device:calibration:upload_certificate',
  'pc:device:fault:approve',
  -- 移动端
  'mobile:device', 'mobile:device:fault:view',
  'mobile:device:calibration:view', 'mobile:device:calibration:submit', 'mobile:device:calibration:upload_certificate'
);

-- 质量检验员 QC: 校准 view+submit
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'QC' AND p.perm_code IN (
  'all:device', 'all:device:calibration:view', 'pc:device:calibration:submit',
  -- 移动端
  'mobile:device', 'mobile:device:calibration:view', 'mobile:device:calibration:submit'
);

-- 工序操作人 OP: 故障 view+create, 保养 view+start, 点检 view+submit
-- 移动端同
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'OP' AND p.perm_code IN (
  'all:device',
  'all:device:fault:view', 'pc:device:fault:create',
  'all:device:maintenance:view', 'pc:device:maintenance:start',
  'all:device:inspection:view', 'pc:device:inspection:submit', 'pc:device:inspection:skip',
  'all:device:dashboard:view',
  -- 移动端
  'mobile:device',
  'mobile:device:fault:view', 'mobile:device:fault:create',
  'mobile:device:maintenance:view', 'mobile:device:maintenance:start', 'mobile:device:maintenance:submit',
  'mobile:device:inspection:view', 'mobile:device:inspection:submit'
);

-- 看板查看者 VIEWER: 只看 OEE / Dashboard（不进入 device 模块）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'VIEWER' AND p.perm_code IN (
  'all:device:dashboard:view', 'pc:device:dashboard:view',
  'all:device:oee:view', 'pc:device:oee:view'
);
