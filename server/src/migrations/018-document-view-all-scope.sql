-- ============================================================
-- Migration 018: 设备文档数据权限 view_all 范围
-- 新增 all:device:document:view_all 权限码（参照 device:fault/view_all 模式）
-- 无此权限码的角色，DeviceDocumentService.list() 只返回 uploaded_by = 当前 userId 的记录
-- 幂等：INSERT IGNORE + 先查后写角色分配
-- ============================================================

-- ===== 第 1 部分：插入 view_all 权限码 =====
INSERT IGNORE INTO sys_permission (parent_id, perm_name, perm_code, type, sort_order, visible, status, created_at)
VALUES
(0, '查看全部设备文档（数据权限）', 'all:device:document:view_all', 'api', 70, 0, 1, NOW())
;

-- ===== 第 2 部分：角色分配 =====
-- SUPER_ADMIN / ADMIN 已在 017 用 CROSS JOIN 覆盖所有 %:device:% 码，新码自动生效

-- PROD_MANAGER: 需要 view_all 才能跨设备查文档（设备档案管理场景）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'PROD_MANAGER'
  AND p.perm_code = 'all:device:document:view_all';

-- MAINTENANCE: 设备维保时需要跨设备查文档（手册/校准证书/维修记录）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'MAINTENANCE'
  AND p.perm_code = 'all:device:document:view_all';

-- QC_MANAGER: 质量审核需要查所有设备文档（校准证书/检验报告）
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'QC_MANAGER'
  AND p.perm_code = 'all:device:document:view_all';

-- QC_INSPECTOR: 检验员也需要 view_all 才能查校准证书
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM sys_role r JOIN sys_permission p ON TRUE
WHERE r.role_code = 'QC_INSPECTOR'
  AND p.perm_code = 'all:device:document:view_all';

-- OPERATOR: 工序操作人只看自己上传的文档——不分配 view_all（scope 过滤自动生效）
-- DASHBOARD_VIEWER: 看板查看者不进 device 模块——不分配
