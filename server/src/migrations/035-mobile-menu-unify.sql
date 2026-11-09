-- ============================================================================
-- Migration 035 — 移动端菜单统一接入 sys_permission（双端同表）
--
-- 背景：sys_permission 是全局唯一权限目录（perm_code 两端共享），但菜单
--   渲染数据源不统一 — PC 端动态从 DB 拉，移动端前端硬编码。
--   本 migration 为 sys_permission 增加 6 个 mobile_* 字段承载移动端菜单。
--
-- 策略：
--   1. ALTER TABLE 加 6 个字段（全有安全默认值，向后兼容）
--   2. UPDATE 14 条现有 type=menu 记录填移动端菜单数据
--   3. INSERT 1 条 APP 专属菜单：检验历史（mobile:inspection-history）
--
-- 双端共享同一 perm_id 体系，但菜单树层级、路由、分组不同：
--   PC 端 → route_path / parent_id / icon / sort_order / visible
--   APP 端 → mobile_* 字段（空值 fallback 到 PC 字段）
-- ============================================================================

-- STEP 1: 加 6 个字段
ALTER TABLE sys_permission
  ADD COLUMN mobile_parent_id   INT          NOT NULL DEFAULT 0  COMMENT '移动端菜单树父级ID（0=TabBar根级）',
  ADD COLUMN mobile_route_path  VARCHAR(255) DEFAULT NULL          COMMENT '移动端路由（如 /m/device-maintenance）',
  ADD COLUMN mobile_tab_group   VARCHAR(20)  DEFAULT NULL          COMMENT '移动端归属Tab分组：production/inspection/device/NULL',
  ADD COLUMN mobile_icon        VARCHAR(64)  DEFAULT NULL          COMMENT '移动端图标（可空，空则复用 icon）',
  ADD COLUMN mobile_sort_order  INT          DEFAULT 0            COMMENT '移动端同级排序（可空，空则复用 sort_order）',
  ADD COLUMN mobile_visible     TINYINT      NOT NULL DEFAULT 1  COMMENT '移动端是否可见（1=显示）';

-- STEP 2: PRODUCTION Tab（2 项）
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/production-orders',  mobile_tab_group='production', mobile_sort_order=1 WHERE perm_code='production:order';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/process-reporting',  mobile_tab_group='production', mobile_sort_order=2 WHERE perm_code='production:reporting';

-- STEP 3: INSPECTION Tab（6 项 + 1 新增）
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/incoming-inspection', mobile_tab_group='inspection', mobile_sort_order=1 WHERE perm_code='quality:incoming';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/product-inspection',  mobile_tab_group='inspection', mobile_sort_order=2 WHERE perm_code='quality:product';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/process-inspection',   mobile_tab_group='inspection', mobile_sort_order=3 WHERE perm_code='quality:process';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/microbe-inspection',  mobile_tab_group='inspection', mobile_sort_order=4 WHERE perm_code='quality:microbe';
-- 检验历史：APP 独有菜单（INSERT IF NOT EXISTS）
INSERT INTO sys_permission (perm_code, perm_name, type, parent_id, mobile_route_path, mobile_tab_group, mobile_sort_order, mobile_parent_id, icon, sort_order, visible, status, created_at)
SELECT 'mobile:inspection-history', '检验历史', 'menu', 0, '/m/inspection-history', 'inspection', 5, 0, 'HistoryOutlined', 5, 1, 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE perm_code = 'mobile:inspection-history');
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/complaint-report',    mobile_tab_group='inspection', mobile_sort_order=6 WHERE perm_code='quality:complaint';

-- STEP 4: DEVICE Tab（6 项）
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/device-maintenance',   mobile_tab_group='device', mobile_sort_order=1 WHERE perm_code='device:maintenance';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/device-fault',         mobile_tab_group='device', mobile_sort_order=2 WHERE perm_code='device:fault';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/calibration-reminder', mobile_tab_group='device', mobile_sort_order=3 WHERE perm_code='device:calibration';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/device-oee',           mobile_tab_group='device', mobile_sort_order=4 WHERE perm_code='device:oee';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/spare-parts',         mobile_tab_group='device', mobile_sort_order=5 WHERE perm_code='device:spare-part';
UPDATE sys_permission SET mobile_parent_id=0, mobile_route_path='/m/device-documents',     mobile_tab_group='device', mobile_sort_order=6 WHERE perm_code='device:document';
