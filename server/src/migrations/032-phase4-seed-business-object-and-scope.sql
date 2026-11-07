-- ============================================================================
-- Phase 4 Seed — sys_business_object + sys_data_dimension 扩展 + sys_data_scope 规则
-- ============================================================================

-- 1. 业务对象字典（INSERT IGNORE 幂等）
INSERT IGNORE INTO sys_business_object (business_obj, obj_name, table_name, remark, sort_order, status, created_at, updated_at) VALUES
('production_order',            '生产订单',     'production_order',            'MES 生产订单',                  1, 1, NOW(), NOW()),
('production_report_order',     '报工单主表',   'production_report_order',     '工序报工单主表',                2, 1, NOW(), NOW()),
('production_report_process',   '报工工序明细', 'production_report_process',   '报工工序级明细',                3, 1, NOW(), NOW()),
('quality_incoming_inspection', '来料检验单',   'quality_incoming_inspection', '来料检验',                      4, 1, NOW(), NOW()),
('quality_process_inspection',  '制程检验单',   'quality_process_inspection',  '制程检验',                      5, 1, NOW(), NOW()),
('device_fault',                '设备故障',     'device_fault',                '设备故障记录',                  6, 1, NOW(), NOW()),
('device_maintenance',          '设备维保',     'device_maintenance_profile',  '设备维保档案',                  7, 1, NOW(), NOW()),
('device_record',               '设备点检',     'device_record',               '设备点检记录',                  8, 1, NOW(), NOW()),
('device_calibration',          '设备校准',     'device_calibration_record',   '设备校准',                      9, 1, NOW(), NOW()),
('bas_material',                '料品档案',     'bas_material',                '基础数据-料品',                 10, 1, NOW(), NOW()),
('bas_customer',                '客户档案',     'bas_customer',                '基础数据-客户',                 11, 1, NOW(), NOW()),
('bas_supplier',                '供应商档案',   'bas_supplier',                '基础数据-供应商',               12, 1, NOW(), NOW());

-- 2. DataDimension 扩展 column_map + self_column_map（JSON）
--    employee 维度：不同业务表的"创建人/操作人"列名不同
UPDATE sys_data_dimension SET
  column_map = '{"production_order":"created_by","production_report_order":"report_user_name","quality_incoming_inspection":"inspector_name","quality_process_inspection":"inspector_name","device_fault":"reporter_name","device_maintenance":"created_by","production_report_process":"created_by"}',
  self_column_map = '{"production_order":"created_by","production_report_order":"report_user_name","quality_incoming_inspection":"inspector_name","quality_process_inspection":"inspector_name","device_fault":"reporter_name"}'
WHERE dim_code = 'employee';

--    production_line 维度：production_order 没有 line_id，其他表有
UPDATE sys_data_dimension SET
  column_map = '{"production_report_order":"line_id","production_process_record":"line_id","device_fault":"device_id","device_maintenance":"device_id"}',
  self_column_map = NULL
WHERE dim_code = 'production_line';

--    material 维度：
UPDATE sys_data_dimension SET
  column_map = '{"production_order":"material_id","production_report_order":"material_id","production_process_record":"material_id"}',
  self_column_map = NULL
WHERE dim_code = 'material';

-- 3. sys_data_scope 规则 — 清空旧数据（旧规则没 role_code 短路，且覆盖不全）
DELETE FROM sys_data_scope;

-- 3a. SUPER_ADMIN (role_id=1) + ADMIN (role_id=7) 全部 scope_type=all（但 role_code 也短路）
INSERT INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at) VALUES
(1, NULL, 'production_order',            'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'production_report_order',     'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'production_report_process',   'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'quality_incoming_inspection', 'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'quality_process_inspection',  'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'device_fault',                'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'device_maintenance',          'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'device_record',               'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'device_calibration',          'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'bas_material',                'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'bas_customer',                'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),
(1, NULL, 'bas_supplier',                'all', NULL, 'IN', NULL, NULL, 'SUPER_ADMIN 全量', 1, 1, NOW(), NOW()),

(7, NULL, 'production_order',            'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'production_report_order',     'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'production_report_process',   'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'quality_incoming_inspection', 'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'quality_process_inspection',  'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'device_fault',                'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'device_maintenance',          'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'device_record',               'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'device_calibration',          'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'bas_material',                'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'bas_customer',                'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW()),
(7, NULL, 'bas_supplier',                'all', NULL, 'IN', NULL, NULL, 'ADMIN 全量', 1, 1, NOW(), NOW());

-- 3b. PLANNER (role_id=2) — 生产+订单全量
INSERT INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at) VALUES
(2, NULL, 'production_order',        'all', NULL, 'IN', NULL, NULL, '计划员看全部订单', 1, 1, NOW(), NOW()),
(2, NULL, 'production_report_order', 'all', NULL, 'IN', NULL, NULL, '计划员看全部报工', 1, 1, NOW(), NOW()),
(2, NULL, 'bas_material',            'all', NULL, 'IN', NULL, NULL, '计划员看全部料品', 1, 1, NOW(), NOW());

-- 3c. PROD_MANAGER (role_id=5) — 生产+订单全量
INSERT INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at) VALUES
(5, NULL, 'production_order',        'all', NULL, 'IN', NULL, NULL, '生产管理员看全部订单', 1, 1, NOW(), NOW()),
(5, NULL, 'production_report_order', 'all', NULL, 'IN', NULL, NULL, '生产管理员看全部报工', 1, 1, NOW(), NOW()),
(5, NULL, 'production_report_process','all', NULL, 'IN', NULL, NULL, '生产管理员看全部报工工序', 1, 1, NOW(), NOW());

-- 3d. OPERATOR (role_id=6) — 报工单 scope_type=self 只看自己报的
INSERT INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at) VALUES
(6, NULL, 'production_report_order', 'self', 'employee', 'IN', NULL, NULL, '操作人只看自己的报工单', 1, 1, NOW(), NOW());

-- 3e. QC_MANAGER (role_id=3) — 质量全量
INSERT INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at) VALUES
(3, NULL, 'quality_incoming_inspection', 'all', NULL, 'IN', NULL, NULL, '质量管理员看全部来料检验', 1, 1, NOW(), NOW()),
(3, NULL, 'quality_process_inspection',  'all', NULL, 'IN', NULL, NULL, '质量管理员看全部制程检验', 1, 1, NOW(), NOW());

-- 3f. QC_INSPECTOR (role_id=4) — 检验单 scope_type=self 只看自己
INSERT INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at) VALUES
(4, NULL, 'quality_incoming_inspection', 'self', 'employee', 'IN', NULL, NULL, '检验员只看自己的来料检验单', 1, 1, NOW(), NOW()),
(4, NULL, 'quality_process_inspection',  'self', 'employee', 'IN', NULL, NULL, '检验员只看自己的制程检验单', 1, 1, NOW(), NOW());

-- 3g. MAINTENANCE (role_id=8) — 设备全量
INSERT INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at) VALUES
(8, NULL, 'device_fault',       'all', NULL, 'IN', NULL, NULL, '设备管理员看全部故障', 1, 1, NOW(), NOW()),
(8, NULL, 'device_maintenance', 'all', NULL, 'IN', NULL, NULL, '设备管理员看全部维保', 1, 1, NOW(), NOW()),
(8, NULL, 'device_record',      'all', NULL, 'IN', NULL, NULL, '设备管理员看全部点检', 1, 1, NOW(), NOW()),
(8, NULL, 'device_calibration', 'all', NULL, 'IN', NULL, NULL, '设备管理员看全部校准', 1, 1, NOW(), NOW());

-- 3h. WarehouseClerk (role_id=11) — 基础数据全量
INSERT INTO sys_data_scope (role_id, user_id, obj_code, scope_type, dim_code, operator, dim_value, perm_code, description, sort_order, status, created_at, updated_at) VALUES
(11, NULL, 'bas_material', 'all', NULL, 'IN', NULL, NULL, '仓库管理员看全部料品', 1, 1, NOW(), NOW()),
(11, NULL, 'bas_customer', 'all', NULL, 'IN', NULL, NULL, '仓库管理员看全部客户', 1, 1, NOW(), NOW()),
(11, NULL, 'bas_supplier', 'all', NULL, 'IN', NULL, NULL, '仓库管理员看全部供应商', 1, 1, NOW(), NOW());
