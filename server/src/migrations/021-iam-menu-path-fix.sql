-- ============================================================
-- 021-iam-menu-path-fix.sql — 阶段 3 修复：菜单 path 对齐 + 缓存管理菜单
-- 幂等：IF NOT EXISTS / ON DUPLICATE KEY UPDATE
-- 依赖：020-permission-v2-dict-seed.sql 已执行（perm_id 800~883 存在）
-- ============================================================

-- 1. 权限资源池 path 对齐前端路由 /iam/permission（种子写的是 /iam/permissions，多了 s）
UPDATE sys_permission SET path = '/iam/permission' WHERE perm_id = 803;

-- 2. 权限审查 父节点 path 补上（侧边栏 Tree 渲染需要）
UPDATE sys_permission SET path = '/iam/audit' WHERE perm_id = 808;

-- 3. 新增：缓存管理 菜单（挂在顶级 800 下，perm_id 818）
INSERT INTO sys_permission
  (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 818, 800, '缓存管理', 'iam:cache', 'menu', 'DatabaseOutlined', '/iam/cache', NULL, 10, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 818);

-- 缓存管理按钮
INSERT INTO sys_permission
  (perm_id, parent_id, perm_name, perm_code, type, icon, path, component, sort_order, visible, status, created_at)
SELECT 819, 818, '清缓存', 'iam:cache:clear', 'button', NULL, NULL, NULL, 1, 0, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_id = 819);

-- 4. 把 cache 菜单分配给 SUPER_ADMIN 和 ADMIN 角色
-- 先查两个角色的 role_id
SET @super_id = (SELECT role_id FROM sys_role WHERE role_code = 'SUPER_ADMIN' LIMIT 1);
SET @admin_id = (SELECT role_id FROM sys_role WHERE role_code = 'ADMIN' LIMIT 1);

-- SUPER_ADMIN 加 818/819
INSERT IGNORE INTO sys_role_permission (role_id, perm_id) VALUES
  (@super_id, 818), (@super_id, 819),
  (@admin_id, 818), (@admin_id, 819);
