-- Migration 030: SUPER_ADMIN 显式分配 terminal=2 全量权限
-- 背景：
--   之前 RoleService.initDefaultPermissions 写死 terminal=1 只给 super_admin 分配 PC 端
--   terminal=2 依赖 PermissionEngine.isSuperAdmin 短路返回权限池全量
--   短路是隐式逻辑，排查问题时 SQL 看不到 role_permission 数据
-- 修复：
--   a) RoleService.initDefaultPermissions 改为 for (terminal of [1,2]) 循环
--      → 每次启动自动两端同步，未来新权限节点自动覆盖两个终端
--   b) 本 migration 直接 INSERT 补齐（INSERT IGNORE 幂等）
-- effect: role_id=1 terminal=2 从 0 → 249 (权限池全量)

INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 1, p.perm_id, 2, NOW()
FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0;
