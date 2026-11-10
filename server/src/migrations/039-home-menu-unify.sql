-- ============================================================================
-- Migration 039 — 往 sys_permission 插入 home（工作台/首页）记录
--
-- 背景：PC 端 /dashboard 和移动端 /m/dashboard 都是硬编码路由，
--   从未进入 sys_permission 菜单体系。本次把它们合并为同一条记录，
--   两端菜单数据统一。
--
-- 设计：
--   PC 端:   parent_id=0, path='/dashboard', visible=0
--           visible=0 因为工作台不出现在左侧菜单树里（它是登录默认跳转页）
--   APP 端: mobile_parent_id=0, mobile_route_path='/m/dashboard', mobile_visible=1
--           mobile_tab_group=NULL — 不属于 production/quality/device 任何一组，
--           它是 TabBar 固定首页 Tab（和 FIXED_PROFILE 一样的框架层入口）
--   mobile_perm_name='M首页' — 移动端显示名
-- ============================================================================

START TRANSACTION;

INSERT INTO sys_permission (
  perm_code, perm_name, type, path, parent_id, sort_order, status, visible, icon,
  mobile_route_path, mobile_parent_id, mobile_tab_group, mobile_sort_order, mobile_visible, mobile_perm_name
)
SELECT 'home', '工作台', 'menu', '/dashboard', 0, 0, 1, 0, 'DashboardOutlined',
       '/m/dashboard', 0, NULL, 0, 1, 'M首页'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'home');

COMMIT;
