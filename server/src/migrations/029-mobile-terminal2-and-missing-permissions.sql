-- Migration 029: 权限池补 quality:process / device:inspection + mobile:* 按钮 + 全角色 terminal=2 分配
-- 背景：
--   1. 前端移动端引用了 quality:process / device:inspection 菜单节点
--      但 DefaultPermissions.ts 种子缺失 → 每次 initDefaultPermissions 启动时被当"废弃菜单"清理
--   2. 前端移动端引用了 6 个 mobile:* 按钮级权限（mobile:device:fault:create 等）
--      但 sys_permission 权限池里根本没有
--   3. 所有角色 terminal=2（移动端APP）全部 0 条权限
--
-- 本次修复：
--   a) 直接 INSERT 权限池缺失的菜单节点 + mobile:* 按钮（DefaultPermissions.ts 已同步补）
--   b) 一次性清空 terminal=2 旧残留 + 重分配 7 个角色的移动端权限
--
-- 前置条件：旧唯一约束 sys_role_permission_perm_id_role_id_unique 已 DROP
--           只剩 uk_role_perm_terminal (role_id, perm_id, terminal) 含 terminal 维度
--
-- 幂等策略：DELETE terminal=2 再 INSERT IGNORE（perm_code IN (...) 映射 perm_id）

-- ===== 权限池补节点 =====

-- quality:process 菜单（parent_id=30 quality）
INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, perm_type, group_name, sort, visible, status, is_abandon, created_at)
SELECT 30, '制程检验', 'quality:process', 'menu', 1, 'quality', 3, 1, 1, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'quality:process');

-- device:inspection 菜单（parent_id=50 device）
-- ⚠️ 2026-11-10 注释掉：后端 DeviceMaintenanceUnified 已合并点检（daily）和保养（weekly/monthly）
--   PC 端无 /device/inspection 路由，移动端 routes.tsx 也已重定向到 maintenance
--   Migration 040 反向删除这个节点（如果 029 已执行过）
-- INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, perm_type, group_name, sort, visible, status, is_abandon, created_at)
-- SELECT 50, '设备点检', 'device:inspection', 'menu', 1, 'device', 4, 1, 1, 0, NOW()
-- WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'device:inspection');

-- 6 个 mobile:* 按钮级（parent 菜单节点已存在）
INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, perm_type, group_name, sort, visible, status, is_abandon, created_at)
SELECT p.perm_id, '移动端-新增故障', 'mobile:device:fault:create', 'button', 2, 'pc', 5, 1, 1, 0, NOW()
FROM sys_permission p WHERE p.perm_code = 'device:fault'
AND NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'mobile:device:fault:create');

INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, perm_type, group_name, sort, visible, status, is_abandon, created_at)
SELECT p.perm_id, '移动端-开始维保', 'mobile:device:maintenance:start', 'button', 2, 'pc', 5, 1, 1, 0, NOW()
FROM sys_permission p WHERE p.perm_code = 'device:maintenance'
AND NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'mobile:device:maintenance:start');

INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, perm_type, group_name, sort, visible, status, is_abandon, created_at)
SELECT p.perm_id, '移动端-提交维保', 'mobile:device:maintenance:submit', 'button', 2, 'pc', 5, 1, 1, 0, NOW()
FROM sys_permission p WHERE p.perm_code = 'device:maintenance'
AND NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'mobile:device:maintenance:submit');

-- ⚠️ 2026-11-10 注释掉：父节点 device:inspection 已废弃（见上方注释）
-- INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, perm_type, group_name, sort, visible, status, is_abandon, created_at)
-- SELECT p.perm_id, '移动端-提交点检', 'mobile:device:inspection:submit', 'button', 2, 'pc', 5, 1, 1, 0, NOW()
-- FROM sys_permission p WHERE p.perm_code = 'device:inspection'
-- AND NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'mobile:device:inspection:submit');

INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, perm_type, group_name, sort, visible, status, is_abandon, created_at)
SELECT p.perm_id, '移动端-删除备件', 'mobile:device:spare-part:delete', 'button', 2, 'pc', 5, 1, 1, 0, NOW()
FROM sys_permission p WHERE p.perm_code = 'device:spare-part'
AND NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'mobile:device:spare-part:delete');

INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, perm_type, group_name, sort, visible, status, is_abandon, created_at)
SELECT p.perm_id, '移动端-删除档案', 'mobile:device:document:delete', 'button', 2, 'pc', 5, 1, 1, 0, NOW()
FROM sys_permission p WHERE p.perm_code = 'device:document'
AND NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'mobile:device:document:delete');

-- ===== terminal=2 全角色分配 =====
DELETE FROM sys_role_permission WHERE terminal = 2;

-- role_id=6 OPERATOR 工序操作人（现场报工 + 故障上报）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 6, p.perm_id, 2, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'production','production:order','production:reporting',
  'production:reporting:create','production:reporting:update','production:reporting:finish','production:reporting:close',
  'quality','quality:incoming',
  'device','device:fault','mobile:device:fault:create','device:calibration',
  'bigscreen','bigscreen:production'
);

-- role_id=8 MAINTENANCE 设备管理员（维保/故障/校准/点检/备件/档案 + 全部 mobile:*）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 8, p.perm_id, 2, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'device','device:list','device:maintenance','device:fault','device:calibration',
  -- 'device:inspection', -- 2026-11-10 废弃节点（见 Migration 040）
  'device:spare-part','device:document','device:oee','device:dashboard',
  'mobile:device:fault:create','mobile:device:maintenance:start','mobile:device:maintenance:submit',
  -- 'mobile:device:inspection:submit', -- 2026-11-10 父节点废弃
  'mobile:device:spare-part:delete','mobile:device:document:delete',
  'production','production:order','bigscreen','bigscreen:production'
);

-- role_id=4 QC_INSPECTOR 质量检验员（执行级 create/update only）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 4, p.perm_id, 2, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'quality','quality:incoming','quality:incoming:create','quality:incoming:update',
  'quality:product','quality:product:create','quality:product:update',
  'quality:process','quality:process:create','quality:process:update',
  'quality:microbe','quality:microbe:create','quality:microbe:update',
  'bigscreen','bigscreen:quality'
);

-- role_id=3 QC_MANAGER 质量管理员（完整 CRUD）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 3, p.perm_id, 2, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'quality','quality:incoming','quality:incoming:create','quality:incoming:update','quality:incoming:delete',
  'quality:product','quality:product:create','quality:product:update','quality:product:delete',
  'quality:process','quality:process:create','quality:process:update','quality:process:delete',
  'quality:microbe','quality:microbe:create','quality:microbe:update','quality:microbe:delete',
  'quality:complaint','quality:complaint:customer','quality:complaint:create',
  'bigscreen','bigscreen:quality'
);

-- role_id=2 PLANNER 计划员（生产订单 + 报工）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 2, p.perm_id, 2, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'production','production:order','production:reporting','production:reporting:update','production:reporting:finish',
  'bigscreen','bigscreen:production'
);

-- role_id=5 PROD_MANAGER 生产管理员（完整 CRUD）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 5, p.perm_id, 2, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'production','production:order','production:reporting','production:reporting:create','production:reporting:update',
  'production:reporting:delete','production:reporting:finish','production:reporting:close',
  'bigscreen','bigscreen:production','bigscreen:management'
);

-- role_id=11 WarehouseClerk 仓库管理员（只读参考）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 11, p.perm_id, 2, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'production','production:order','quality','quality:incoming','bigscreen','bigscreen:production'
);
