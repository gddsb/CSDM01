-- ============================================================
-- 014-break-time-and-holiday.sql
-- 休息时间系统 + 休息日字典 + 维保跳过休息日
-- 幂等：所有操作用 IF NOT EXISTS / Duplicate 跳过
-- ============================================================

-- ===== 1. 报工单休息时间段关联表 =====
-- 多条休息记录，每条有开始/结束时间（含日期）
SET @has := (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_break_time');
SET @sql := IF(@has = 0,
  "CREATE TABLE production_break_time (
    break_time_id    CHAR(36) PRIMARY KEY COMMENT '休息记录ID',
    report_order_id  INT NOT NULL COMMENT '关联报工单',
    start_time       DATETIME NOT NULL COMMENT '休息开始时间',
    end_time         DATETIME NOT NULL COMMENT '休息结束时间',
    duration_minutes INT GENERATED ALWAYS AS (
      TIMESTAMPDIFF(MINUTE, start_time, end_time)
    ) STORED COMMENT '休息时长（分钟，自动计算）',
    remark           VARCHAR(200) COMMENT '备注',
    created_at       DATETIME,
    updated_at       DATETIME,
    INDEX idx_report_order (report_order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报工单休息时间段'",
  "SELECT 'skip: production_break_time already exists' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 2. report_order 加休息总分钟数 =====
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_report_order'
    AND COLUMN_NAME = 'break_minutes');
SET @sql := IF(@has_col = 0,
  "ALTER TABLE production_report_order ADD COLUMN break_minutes INT DEFAULT 0 COMMENT '休息总分钟数（后端汇总写入）'",
  "SELECT 'skip: report_order.break_minutes exists' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 3. manpower_record 加净工时列 =====
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_manpower_record'
    AND COLUMN_NAME = 'net_hours');
SET @sql := IF(@has_col = 0,
  "ALTER TABLE production_manpower_record ADD COLUMN net_hours DECIMAL(10,2) DEFAULT 0 COMMENT '净工时（小时，扣除休息时间）'",
  "SELECT 'skip: manpower.net_hours exists' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 4. process_exception 加净时长列 =====
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_process_exception'
    AND COLUMN_NAME = 'net_duration');
SET @sql := IF(@has_col = 0,
  "ALTER TABLE production_process_exception ADD COLUMN net_duration DECIMAL(10,2) DEFAULT 0 COMMENT '净停机时长（小时，扣除休息时间）'",
  "SELECT 'skip: exception.net_duration exists' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 5. dic_holiday 休息日字典表 =====
SET @has := (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dic_holiday');
SET @sql := IF(@has = 0,
  "CREATE TABLE dic_holiday (
    holiday_date DATE PRIMARY KEY COMMENT '休息日日期',
    holiday_name VARCHAR(100) COMMENT '休息日名称（如厂休/春节）',
    is_workday   TINYINT(1) DEFAULT 0 COMMENT '是否调休上班（1=虽然是休息日但要上班做维保）',
    created_at   DATETIME,
    updated_at   DATETIME,
    INDEX idx_year_month (holiday_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='休息日/节假日字典'",
  "SELECT 'skip: dic_holiday already exists' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 6. sys_permission 插入"生产设置"菜单 =====
SET @prod_id := (SELECT perm_id FROM sys_permission WHERE perm_code = 'production' LIMIT 1);
SET @menu_exists := (SELECT COUNT(*) FROM sys_permission WHERE perm_code = 'production:settings');
SET @sql := IF(@prod_id IS NOT NULL AND @menu_exists = 0,
  CONCAT("INSERT INTO sys_permission (parent_id, perm_name, perm_code, type, icon, path, sort_order, visible, status, created_at)
          VALUES (", @prod_id, ", '生产设置', 'production:settings', 'menu', 'SettingOutlined', '/production/settings', 3, 1, 1, NOW())"),
  "SELECT 'skip: production:settings menu exists or production missing' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 7. 给超级管理员/系统管理员/生产管理员/计划员 角色授权 production:settings =====
SET @perm_id := (SELECT perm_id FROM sys_permission WHERE perm_code = 'production:settings' LIMIT 1);
SET @roles_csv := "'SUPER_ADMIN','ADMIN','PROD_MANAGER','PLANNER'";
SET @sql := IF(@perm_id IS NOT NULL,
  CONCAT("INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
          SELECT r.role_id, ", @perm_id, "
          FROM sys_role r WHERE r.role_code IN (", @roles_csv, ")"),
  "SELECT 'skip: role_permission auth' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '014-break-time-and-holiday done' AS result;
