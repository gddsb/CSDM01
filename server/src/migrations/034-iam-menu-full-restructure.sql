-- ============================================================================
-- Phase 34 — 用户与权限菜单全量重构（方案 A 硬切）
-- 规范 §8 菜单组织 + §8.2 同级 12 个页面 + §8.4/§8.5/§8.7 弹窗
--
-- 动作：
--   1. 新建一级菜单 "用户与权限"（perm_code: iam）
--   2. 新建 12 个二级菜单权限码（iam:* 系列）
--   3. 停用旧 system 菜单下的用户/角色条目（不是删除，保留权限码和历史关联）
--   4. RolePermission 批量重绑定：所有角色把 system:user:* / system:role:* 换成 iam:user:* / iam:role:* / iam:permission:*
--   5. 新建 sys_menu 记录（如果存在的话 — 旧项目用 sys_permission 当菜单表）
-- ============================================================================

-- ============================================================================
-- STEP 1: 权限码映射表（system:* → iam:* 一对一替换）
-- ============================================================================
-- 说明：这个步骤是把每个角色的 role_permission 里 perm_id 从 system:* 换成 iam:*
-- 首先确保 iam:* 权限码已存在（之前 Phase 2-4 migration 应该已创建）

-- 1.1 确保顶层 iam 菜单节点存在（若不存在则 INSERT）
INSERT INTO sys_permission (perm_code, parent_perm_code, perm_name, type, path, icon, sort_order, status, group_name, create_time, update_time)
SELECT 'iam', NULL, '用户与权限', 'menu', '/iam', 'SafetyOutlined', 10, 1, '用户与权限', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'iam');

-- 1.2 iam:user 菜单节点（替代 system:user）
INSERT INTO sys_permission (perm_code, parent_perm_code, perm_name, type, path, sort_order, status, group_name, create_time, update_time)
SELECT 'iam:user', 'iam', '用户管理', 'menu', '/iam/users', 1, 1, '用户与权限', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'iam:user');

-- 1.3 iam:role 菜单节点（替代 system:role）
INSERT INTO sys_permission (perm_code, parent_perm_code, perm_name, type, path, sort_order, status, group_name, create_time, update_time)
SELECT 'iam:role', 'iam', '角色管理', 'menu', '/iam/roles', 2, 1, '用户与权限', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'iam:role');

-- 1.4 10 个二级菜单节点（规范 §8.2）
INSERT INTO sys_permission (perm_code, parent_perm_code, perm_name, type, path, sort_order, status, group_name, create_time, update_time)
SELECT v.perm_code, 'iam', v.perm_name, 'menu', v.path, v.sort_order, 1, '用户与权限', NOW(), NOW()
FROM (
  SELECT 'iam:permission' AS perm_code, '权限资源池' AS perm_name, '/iam/permission' AS path, 3 AS sort_order
  UNION ALL SELECT 'iam:data-scope', '数据范围规则', '/iam/data-scopes', 4
  UNION ALL SELECT 'iam:biz-status', '业务状态规则', '/iam/biz-status-rules', 5
  UNION ALL SELECT 'iam:business-object', '业务对象字典', '/iam/business-objects', 6
  UNION ALL SELECT 'iam:data-dimension', '数据维度字典', '/iam/data-dimensions', 7
  UNION ALL SELECT 'iam:audit', '权限审查报告', '/iam/audit/permission', 8
  UNION ALL SELECT 'iam:audit-log', '审计日志查询', '/iam/audit-log', 9
  UNION ALL SELECT 'iam:cache', '在线用户与缓存', '/iam/cache', 10
) v
WHERE NOT EXISTS (SELECT 1 FROM sys_permission p WHERE p.perm_code = v.perm_code);

-- 1.5 按钮级权限：iam:user:*（替代 system:user:*）
INSERT INTO sys_permission (perm_code, parent_perm_code, perm_name, type, sort_order, status, group_name, create_time, update_time)
SELECT v.perm_code, v.parent_code, v.perm_name, 'button', v.sort_order, 1, '用户与权限', NOW(), NOW()
FROM (
  SELECT 'iam:user:view' AS perm_code, 'iam:user' AS parent_code, '查看' AS perm_name, 1 AS sort_order
  UNION ALL SELECT 'iam:user:create', 'iam:user', '新增', 2
  UNION ALL SELECT 'iam:user:update', 'iam:user', '修改', 3
  UNION ALL SELECT 'iam:user:delete', 'iam:user', '删除', 4
  UNION ALL SELECT 'iam:user:toggle', 'iam:user', '启停', 5
  UNION ALL SELECT 'iam:user:extConfig', 'iam:user', '附加权限配置', 6
  UNION ALL SELECT 'iam:user:resetPwd', 'iam:user', '重置密码', 7
) v
WHERE NOT EXISTS (SELECT 1 FROM sys_permission p WHERE p.perm_code = v.perm_code);

-- 1.6 按钮级权限：iam:role:*（替代 system:role:*）
INSERT INTO sys_permission (perm_code, parent_perm_code, perm_name, type, sort_order, status, group_name, create_time, update_time)
SELECT v.perm_code, v.parent_code, v.perm_name, 'button', v.sort_order, 1, '用户与权限', NOW(), NOW()
FROM (
  SELECT 'iam:role:view' AS perm_code, 'iam:role' AS parent_code, '查看' AS perm_name, 1 AS sort_order
  UNION ALL SELECT 'iam:role:create', 'iam:role', '新增', 2
  UNION ALL SELECT 'iam:role:update', 'iam:role', '修改', 3
  UNION ALL SELECT 'iam:role:delete', 'iam:role', '删除', 4
  UNION ALL SELECT 'iam:role:assign', 'iam:role', '分配权限', 5
  UNION ALL SELECT 'iam:role:dataScope', 'iam:role', '数据范围配置', 6
) v
WHERE NOT EXISTS (SELECT 1 FROM sys_permission p WHERE p.perm_code = v.perm_code);

-- 1.7 其他按钮级权限：iam:permission / iam:data-scope / iam:biz-status / iam:cache
INSERT INTO sys_permission (perm_code, parent_perm_code, perm_name, type, sort_order, status, group_name, create_time, update_time)
SELECT v.perm_code, v.parent_code, v.perm_name, 'button', v.sort_order, 1, '用户与权限', NOW(), NOW()
FROM (
  -- 权限资源池
  SELECT 'iam:permission:view' AS perm_code, 'iam:permission' AS parent_code, '查看' AS perm_name, 1 AS sort_order
  UNION ALL SELECT 'iam:permission:create', 'iam:permission', '新增', 2
  UNION ALL SELECT 'iam:permission:update', 'iam:permission', '修改', 3
  UNION ALL SELECT 'iam:permission:delete', 'iam:permission', '删除', 4
  UNION ALL SELECT 'iam:permission:sync', 'iam:permission', '元同步', 5
  -- 数据范围规则
  UNION ALL SELECT 'iam:data-scope:view', 'iam:data-scope', '查看', 1
  UNION ALL SELECT 'iam:data-scope:create', 'iam:data-scope', '新增', 2
  UNION ALL SELECT 'iam:data-scope:update', 'iam:data-scope', '修改', 3
  UNION ALL SELECT 'iam:data-scope:delete', 'iam:data-scope', '删除', 4
  -- 业务状态规则
  UNION ALL SELECT 'iam:biz-status:view', 'iam:biz-status', '查看', 1
  UNION ALL SELECT 'iam:biz-status:create', 'iam:biz-status', '新增', 2
  UNION ALL SELECT 'iam:biz-status:update', 'iam:biz-status', '修改', 3
  UNION ALL SELECT 'iam:biz-status:delete', 'iam:biz-status', '删除', 4
  -- 业务对象字典
  UNION ALL SELECT 'iam:business-object:view', 'iam:business-object', '查看', 1
  UNION ALL SELECT 'iam:business-object:create', 'iam:business-object', '新增', 2
  UNION ALL SELECT 'iam:business-object:update', 'iam:business-object', '修改', 3
  UNION ALL SELECT 'iam:business-object:delete', 'iam:business-object', '删除', 4
  UNION ALL SELECT 'iam:business-object:scan', 'iam:business-object', '扫描', 5
  -- 数据维度字典
  UNION ALL SELECT 'iam:data-dimension:view', 'iam:data-dimension', '查看', 1
  UNION ALL SELECT 'iam:data-dimension:update', 'iam:data-dimension', '启停/修改', 2
  UNION ALL SELECT 'iam:data-dimension:scan', 'iam:data-dimension', '扫描', 3
  -- 权限审查
  UNION ALL SELECT 'iam:audit:permission:run', 'iam:audit', '执行权限审查', 1
  UNION ALL SELECT 'iam:audit:business-obj:run', 'iam:audit', '业务对象扫描', 2
  UNION ALL SELECT 'iam:audit:data-dimension:run', 'iam:audit', '数据维度扫描', 3
  -- 审计日志查询
  UNION ALL SELECT 'iam:audit-log:view', 'iam:audit-log', '查看', 1
  UNION ALL SELECT 'iam:audit-log:export', 'iam:audit-log', '导出', 2
  -- 在线用户 & 缓存
  UNION ALL SELECT 'iam:cache:view', 'iam:cache', '查看', 1
  UNION ALL SELECT 'iam:cache:clear', 'iam:cache', '手动清缓存', 2
) v
WHERE NOT EXISTS (SELECT 1 FROM sys_permission p WHERE p.perm_code = v.perm_code);


-- ============================================================================
-- STEP 2: RolePermission 批量重绑定 — system:* → iam:* 替换
-- ============================================================================
-- 策略：
--   对每个 role_id + terminal：
--     把 system:user:xxx 的 perm_id 换成对应的 iam:user:xxx
--     把 system:role:xxx 的 perm_id 换成对应的 iam:role:xxx
--   不删除旧记录（保险起见用 UPDATE 改 perm_id）
--   如果 iam:* 已经存在就跳过（避免重复）

-- 2.1 system:user:* → iam:user:*
UPDATE sys_role_permission rp
JOIN sys_permission p_old ON rp.perm_id = p_old.perm_id
JOIN sys_permission p_new ON p_new.perm_code = REPLACE(p_old.perm_code, 'system:user', 'iam:user')
SET rp.perm_id = p_new.perm_id, rp.update_time = NOW()
WHERE p_old.perm_code LIKE 'system:user:%'
  AND p_new.perm_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission rp2
    WHERE rp2.role_id = rp.role_id AND rp2.perm_id = p_new.perm_id AND rp2.terminal = rp.terminal
  );

-- 2.2 system:role:* → iam:role:*
UPDATE sys_role_permission rp
JOIN sys_permission p_old ON rp.perm_id = p_old.perm_id
JOIN sys_permission p_new ON p_new.perm_code = REPLACE(p_old.perm_code, 'system:role', 'iam:role')
SET rp.perm_id = p_new.perm_id, rp.update_time = NOW()
WHERE p_old.perm_code LIKE 'system:role:%'
  AND p_new.perm_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission rp2
    WHERE rp2.role_id = rp.role_id AND rp2.perm_id = p_new.perm_id AND rp2.terminal = rp.terminal
  );


-- ============================================================================
-- STEP 3: 停用旧 system 菜单（保留权限码，但前端不再展示）
-- ============================================================================
-- 不删除，避免历史审计日志关联断裂
UPDATE sys_permission SET status = 0 WHERE perm_code IN (
  'system:user', 'system:user:view', 'system:user:create', 'system:user:update',
  'system:user:delete', 'system:user:toggle', 'system:user:extConfig', 'system:user:resetPwd',
  'system:role', 'system:role:view', 'system:role:create', 'system:role:update',
  'system:role:delete', 'system:role:assign'
);
-- 注意：system:menu / system:dict / system:config / system:log 这些保留不动


-- ============================================================================
-- STEP 4: 确保 SUPER_ADMIN 角色拥有全部 iam:* 权限（terminal=1 和 terminal=2 双端）
-- ============================================================================
-- SUPER_ADMIN 有 '*' 通配符，理论上全部放行，但角色权限配置页面还是要展示全部
-- 从 system_permission 里把所有 iam:* perm_id 插进去

INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT r.role_id, p.perm_id, 1, NOW()
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'SUPER_ADMIN' AND p.perm_code LIKE 'iam:%' AND p.type IN ('menu', 'button');

INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT r.role_id, p.perm_id, 2, NOW()
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'SUPER_ADMIN' AND p.perm_code LIKE 'iam:%' AND p.type IN ('menu', 'button');


-- ============================================================================
-- STEP 5: 其他核心角色的 iam:* 权限分配（terminal=1 为主）
-- ============================================================================

-- role_id=7 ADMIN (sysadmin) — 拥有全部 iam:* 权限（除了危险的 delete 可能）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 7, p.perm_id, 1, NOW()
FROM sys_permission p
WHERE p.perm_code LIKE 'iam:%' AND p.type IN ('menu', 'button');

-- role_id=3 QC_MANAGER / role_id=4 QC_INSPECTOR — 有 iam:business-object / iam:data-dimension 查看
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT r.role_id, p.perm_id, 1, NOW()
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code IN ('QC_MANAGER', 'QC_INSPECTOR')
  AND p.perm_code IN (
    'iam:business-object', 'iam:business-object:view',
    'iam:data-dimension', 'iam:data-dimension:view',
    'iam:audit', 'iam:audit:permission:run'
  );

-- role_id=5 PROD_MANAGER / role_id=8 MAINTENANCE — 同上（可看数据范围规则）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT r.role_id, p.perm_id, 1, NOW()
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code IN ('PROD_MANAGER', 'MAINTENANCE')
  AND p.perm_code IN (
    'iam:data-scope', 'iam:data-scope:view',
    'iam:business-object', 'iam:business-object:view',
    'iam:data-dimension', 'iam:data-dimension:view',
    'iam:biz-status', 'iam:biz-status:view'
  );

-- role_id=2 PLANNER — 可看业务状态规则
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT r.role_id, p.perm_id, 1, NOW()
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'PLANNER'
  AND p.perm_code IN (
    'iam:biz-status', 'iam:biz-status:view',
    'iam:business-object', 'iam:business-object:view'
  );


-- ============================================================================
-- STEP 6: 验证结果（注释掉，运行时手动 SELECT）
-- ============================================================================
-- SELECT '=== 新菜单结构 ===' AS section;
-- SELECT perm_id, perm_code, parent_perm_code, perm_name, type, path, sort_order, status FROM sys_permission WHERE perm_code LIKE 'iam:%' ORDER BY parent_perm_code, sort_order;
-- SELECT '=== 角色新权限统计 ===' AS section;
-- SELECT rp.role_id, r.role_code, rp.terminal, COUNT(*) AS cnt FROM sys_role_permission rp JOIN sys_permission p ON rp.perm_id = p.perm_id JOIN sys_role r ON rp.role_id = r.role_id WHERE p.perm_code LIKE 'iam:%' GROUP BY rp.role_id, r.role_code, rp.terminal ORDER BY rp.role_id, rp.terminal;
