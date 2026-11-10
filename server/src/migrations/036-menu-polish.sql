-- =============================================================================
-- 036-menu-polish.sql — 菜单管理界面 UI 清理
-- 目的：简化 PC 端"用户与权限"侧边栏，只保留真正在生产使用的菜单项
-- =============================================================================

-- 前置检查：version 记录（migrate.ts 自动跑）
-- SELECT 1 FROM migration_version WHERE version = '036-menu-polish.sql';

START TRANSACTION;

-- ==============================================================
-- P1: 隐藏脚手架占位菜单（visible=0）
--     这些菜单有前端页面实现但业务不涉及，隐藏不影响已有角色权限
--     （role_permission 里的引用会保留，但菜单入口消失）
-- ==============================================================

-- 业务状态规则（脚手架占位）
UPDATE sys_permission SET visible = 0 WHERE perm_code = 'iam:biz-status';

-- 业务对象字典（脚手架占位）
UPDATE sys_permission SET visible = 0 WHERE perm_code = 'iam:business-object';

-- 数据维度字典（脚手架占位）
UPDATE sys_permission SET visible = 0 WHERE perm_code = 'iam:data-dimension';

-- 审计日志查询（与 iam:audit 合并，iam:audit 已 redirect 到 /iam/audit/permission）
UPDATE sys_permission SET visible = 0 WHERE perm_code = 'iam:audit-log';

-- 数据范围规则（暂未使用；如后续需要数据权限隔离可重新 visible=1）
UPDATE sys_permission SET visible = 0 WHERE perm_code = 'iam:data-scope';

-- ==============================================================
-- P2: 在线用户与缓存（iam:cache）移到"系统管理"下
--     运维级功能放在系统管理更合理，不应和用户/角色/权限配置放一起
-- ==============================================================

UPDATE sys_permission SET parent_id = 1, sort_order = 10 WHERE perm_code = 'iam:cache';

-- ==============================================================
-- P3: iam:permission 改名
--     原"权限资源池"容易和 RoleManagement 的权限配置混淆
--     实际功能是菜单 CRUD，改名叫"菜单管理"更准确
-- ==============================================================

UPDATE sys_permission SET perm_name = '菜单管理' WHERE perm_code = 'iam:permission';

-- ==============================================================
-- 验证
-- ==============================================================

-- SELECT perm_code, perm_name, parent_id, visible FROM sys_permission WHERE perm_code LIKE 'iam:%' ORDER BY parent_id, sort_order;

COMMIT;
