-- ============================================================================
-- Migration 037 — 移动端 Tab 分组名对齐 PC 一级菜单 perm_code
--
-- 背景：Migration 035 引入 mobile_tab_group 时使用了 "inspection"，
--   但 PC 端对应的一级菜单 perm_code 是 "quality"（质量管理）。
--   需求 1 要求 TabBar title 直接取 PC 一级菜单的 perm_name，
--   所以 mobile_tab_group 必须与 PC 一级菜单的 perm_code 一致，
--   buildMobileMenuTree 才能通过 group 值反查 perm_name。
--
-- 变更：
--   mobile_tab_group 值  inspection  →  quality
--                         production → production （不变，已是 PC perm_code）
--                         device     → device      （不变，已是 PC perm_code）
--
-- 同步影响（在代码变更中体现，本 migration 只改 DB 数据）：
--   PermissionService.ts TAB_GROUPS 从 ['production','inspection','device']
--                                   改为 ['production','quality','device']
-- ============================================================================

START TRANSACTION;

-- 把所有 inspection 分组的菜单改为 quality
UPDATE sys_permission
SET mobile_tab_group = 'quality'
WHERE mobile_tab_group = 'inspection';

-- 验证
-- SELECT mobile_tab_group, COUNT(*) FROM sys_permission WHERE mobile_tab_group IS NOT NULL GROUP BY mobile_tab_group;
-- 期望: production=2, quality=7, device=6  (合计 15 条)

COMMIT;
