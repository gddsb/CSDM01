-- ============================================================================
-- Migration 038 — 移动端菜单独立显示名 + M 前缀
--
-- 需求来源：
--   需求 2：移动端菜单需要独立设置显示名称（避免 PC 端名称过长）
--   需求 3：移动端菜单名以 M 开头，显示时自动去掉 M
--
-- 设计：
--   新增 mobile_perm_name VARCHAR(64) DEFAULT NULL
--   后端 buildMobileMenuTree 里 text = stripLeadingM(mobile_perm_name || perm_name)
--   M 前缀是"移动端专属"标识，只在 DB 存储层存在，渲染时剥离
--
-- 初始值策略：
--   1. 先用 CONCAT('M', perm_name) 批量填充所有配了 mobile_tab_group 的菜单
--   2. 然后对 8 条有差异化需求的记录手动覆盖（PC 端名称 != 移动端显示名称）
-- ============================================================================

START TRANSACTION;

-- STEP 1: 加字段（可空，向后兼容；空值 fallback 到 perm_name）
ALTER TABLE sys_permission
  ADD COLUMN mobile_perm_name VARCHAR(64) DEFAULT NULL COMMENT '移动端显示名称（以 M 开头，显示时剥离 M；空则 fallback 到 perm_name）';

-- STEP 2: 批量填充 —— 所有配了 mobile_tab_group 的菜单，默认 M + perm_name
UPDATE sys_permission
SET mobile_perm_name = CONCAT('M', perm_name)
WHERE mobile_tab_group IS NOT NULL AND mobile_tab_group != '' AND mobile_perm_name IS NULL;

-- STEP 3: 差异化覆盖 —— PC 端名称与移动端期望显示名不同的记录
--    PC perm_name        →  mobile_perm_name (M前缀)
UPDATE sys_permission SET mobile_perm_name = 'M成品检验'   WHERE perm_code = 'quality:product';        -- PC: 产品检测
UPDATE sys_permission SET mobile_perm_name = 'M过程检验'   WHERE perm_code = 'quality:process';         -- PC: 制程检验
UPDATE sys_permission SET mobile_perm_name = 'M投诉上报'   WHERE perm_code = 'quality:complaint';       -- PC: 投诉管理
UPDATE sys_permission SET mobile_perm_name = 'M设备维保'   WHERE perm_code = 'device:maintenance';      -- PC: 保养管理
UPDATE sys_permission SET mobile_perm_name = 'M设备故障上报' WHERE perm_code = 'device:fault';          -- PC: 故障管理
UPDATE sys_permission SET mobile_perm_name = 'M校准提醒'   WHERE perm_code = 'device:calibration';      -- PC: 校准管理

-- 验证
-- SELECT perm_code, perm_name, mobile_perm_name, mobile_tab_group
-- FROM sys_permission WHERE mobile_tab_group IS NOT NULL ORDER BY mobile_tab_group, mobile_sort_order;
-- 期望: 所有 mobile_perm_name 都以 M 开头

COMMIT;
