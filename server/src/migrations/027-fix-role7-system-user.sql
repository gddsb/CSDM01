-- Migration 027: role_id=7 ADMIN 补齐 system:user 权限体系
-- 背景：role_id=7 只有 iam:user:* (V2新) 但缺 system:user:* (legacy)
--      UserManagement 前端按钮用 legacy 码 → sysadmin 登录后所有按钮不显示
-- 修复：补全 system:user 菜单节点 + 5 个按钮级权限（terminal=1）
-- effect: role_id=7 权限数 38 → 44

INSERT INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 7, p.perm_id, 1, NOW()
FROM sys_permission p
WHERE p.perm_code IN (
  'system:user',
  'system:user:create',
  'system:user:update',
  'system:user:delete',
  'system:user:toggle',
  'system:user:extConfig'
)
AND NOT EXISTS (
  SELECT 1 FROM sys_role_permission rp
  WHERE rp.role_id = 7 AND rp.perm_id = p.perm_id AND rp.terminal = 1
);
