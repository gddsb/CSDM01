-- 022-auto-task-seed.sql
-- 自动任务模块默认数据补全
-- 问题：task_setting / task_scheduled / task_sync_log 三张表 seed 脚本未覆盖，生产 rebuild 后为空
-- 修复：补 7 种采集类型默认设置 + 6 个默认定时任务
-- 幂等：INSERT IGNORE

INSERT IGNORE INTO task_setting (task_type, name, description, source_url, field_count, is_active, params, created_at, updated_at) VALUES
('env_monitor',        '环境监测采集',        '连接环境监测平台，采集温湿度/PM2.5 等数据', NULL, 12, 1, JSON_OBJECT('interval_min', 10, 'retry_max', 3), NOW(), NOW()),
('weather',            '气象信息采集',        '采集当地气象站数据（温度/湿度/风速/气压）', NULL,  7, 1, JSON_OBJECT('city', '长沙', 'provider', 'open-meteo'), NOW(), NOW()),
('energy_meter',       '能源消耗采集',        '连接能源计量平台，采集电表/水表/能耗数据', NULL,  8, 1, JSON_OBJECT('interval_min', 30), NOW(), NOW()),
('items',              'U9 料品同步',         '从 U9 ERP 拉取料品主数据到 bas_material', NULL, 20, 1, JSON_OBJECT('batch_size', 500, 'incremental', true), NOW(), NOW()),
('customers',          'U9 客户同步',         '从 U9 ERP 拉取客户主数据到 bas_customer', NULL, 15, 1, JSON_OBJECT('batch_size', 500), NOW(), NOW()),
('production_orders',  'U9 生产订单同步',     '从 U9 ERP 拉取生产订单到 production_order', NULL, 18, 1, JSON_OBJECT('batch_size', 500, 'sync_status', 1), NOW(), NOW()),
('purchase_receipts',  'U9 采购入库同步',     '从 U9 ERP 拉取采购入库单',                 NULL, 14, 1, JSON_OBJECT('batch_size', 500), NOW(), NOW());

INSERT IGNORE INTO task_scheduled (schedule_biz_id, name, task_type, exec_mode, config, next_run_at, is_enabled, created_at, updated_at) VALUES
('SCH-ENV-001',     '环境监测 10 分钟采集', 'env_monitor',          'periodic', JSON_OBJECT('interval_seconds', 600),  DATE_ADD(NOW(), INTERVAL 600 SECOND),  1, NOW(), NOW()),
('SCH-WEATHER-001', '气象信息 30 分钟采集', 'weather',              'periodic', JSON_OBJECT('interval_seconds', 1800), DATE_ADD(NOW(), INTERVAL 1800 SECOND), 1, NOW(), NOW()),
('SCH-ENERGY-001',  '能源计量 30 分钟采集', 'energy_meter',         'periodic', JSON_OBJECT('interval_seconds', 1800), DATE_ADD(NOW(), INTERVAL 1800 SECOND), 1, NOW(), NOW()),
('SCH-ERP-001',     'U9 每日早间主数据同步', 'items',                'cron',     JSON_OBJECT('cron', '0 2 * * *'),          DATE_ADD(CURDATE(), INTERVAL 2 HOUR),   1, NOW(), NOW()),
('SCH-CUST-001',    'U9 每日客户同步',       'customers',            'cron',     JSON_OBJECT('cron', '10 2 * * *'),         DATE_ADD(CURDATE(), INTERVAL 2 HOUR),   1, NOW(), NOW()),
('SCH-PO-001',      'U9 每日生产订单同步',    'production_orders',    'cron',     JSON_OBJECT('cron', '20 2 * * *'),        DATE_ADD(CURDATE(), INTERVAL 2 HOUR),   1, NOW(), NOW());
