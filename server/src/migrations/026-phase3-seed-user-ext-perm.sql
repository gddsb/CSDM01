-- Migration 026: Phase 3 权限种子 — system:user:extConfig
-- 规范 3.7 / 8.7 — 用户级 add/deny 双轨权限配置入口
-- 依赖：sys_permission 已有 system:user (perm_id=2) 父节点

INSERT INTO sys_permission
  (perm_code, perm_name, type, perm_type, parent_id, group_name, group_sort, route_path, sort, sort_order, is_abandon, visible, status, remark, created_at)
SELECT
  'system:user:extConfig',
  '用户附加权限配置',
  'button',
  2,
  (SELECT perm_id FROM sys_permission WHERE perm_code = 'system:user' LIMIT 1),
  'system:user',
  0,
  NULL,
  0,
  50,
  0,
  1,
  1,
  '规范 3.7/8.7 用户级 add/deny 双轨权限配置入口',
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'system:user:extConfig');

SET @new_perm_id = (SELECT perm_id FROM sys_permission WHERE perm_code = 'system:user:extConfig' LIMIT 1);

-- role_id=1 SUPER_ADMIN (terminal=1)
INSERT INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 1, @new_perm_id, 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND perm_id = @new_perm_id AND terminal = 1);
