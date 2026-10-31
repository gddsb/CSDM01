-- ============================================================
-- 012-db-stored-columns.sql
-- 将 duration / hours / man_hours 改为 MySQL STORED GENERATED ALWAYS AS
-- 让 DB 自动计算，Sequelize Model 的 set() 阻塞可保持不变
--
-- 幂等策略：先检查列是否已是 GENERATED，是则跳过
-- 重建方式：两次 ALTER（先 DROP 再 ADD 单独执行）
--   - MySQL 8.0 不支持在同一 ALTER 里 DROP + ADD GENERATED 列
--   - GENERATED 列自动非空，不能加 NOT NULL
--   - STORED GENERATED 列不能带 COMMENT
-- ============================================================

-- ===== 1. production_process_exception.duration =====
SET @is_stored := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_process_exception'
    AND COLUMN_NAME = 'duration'
    AND EXTRA LIKE '%generated%'
);
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_process_exception'
    AND COLUMN_NAME = 'duration'
);
SET @sql := IF(@is_stored = 0 AND @has_col > 0,
  "ALTER TABLE production_process_exception DROP COLUMN duration",
  "SELECT 'skip drop: duration already STORED or not exists' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@is_stored = 0,
  "ALTER TABLE production_process_exception
     ADD COLUMN duration DECIMAL(10,2)
     GENERATED ALWAYS AS (
       CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL
            THEN ROUND(TIMESTAMPDIFF(MINUTE, start_time, end_time) / 60, 2)
            ELSE 0.00
       END
     ) STORED",
  "SELECT 'skip add: duration already STORED' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 2. production_manpower_record.hours =====
SET @is_stored := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_manpower_record'
    AND COLUMN_NAME = 'hours'
    AND EXTRA LIKE '%generated%'
);
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_manpower_record'
    AND COLUMN_NAME = 'hours'
);
SET @sql := IF(@is_stored = 0 AND @has_col > 0,
  "ALTER TABLE production_manpower_record DROP COLUMN hours",
  "SELECT 'skip drop: hours already STORED or not exists' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@is_stored = 0,
  "ALTER TABLE production_manpower_record
     ADD COLUMN hours DECIMAL(10,2)
     GENERATED ALWAYS AS (
       CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL
            THEN ROUND(TIMESTAMPDIFF(MINUTE, start_time, end_time) / 60, 2)
            ELSE 0.00
       END
     ) STORED",
  "SELECT 'skip add: hours already STORED' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 3. production_manpower_record.man_hours =====
SET @is_stored := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_manpower_record'
    AND COLUMN_NAME = 'man_hours'
    AND EXTRA LIKE '%generated%'
);
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_manpower_record'
    AND COLUMN_NAME = 'man_hours'
);
SET @sql := IF(@is_stored = 0 AND @has_col > 0,
  "ALTER TABLE production_manpower_record DROP COLUMN man_hours",
  "SELECT 'skip drop: man_hours already STORED or not exists' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@is_stored = 0,
  "ALTER TABLE production_manpower_record
     ADD COLUMN man_hours DECIMAL(10,2)
     GENERATED ALWAYS AS (
       CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL
            THEN ROUND(
                TIMESTAMPDIFF(MINUTE, start_time, end_time) / 60 *
                COALESCE(NULLIF(total_people, 0),
                  skilled_count + general_count + labor_count + other_count)
              , 2)
            ELSE 0.00
       END
     ) STORED",
  "SELECT 'skip add: man_hours already STORED' AS info");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '012-db-stored-columns done' AS result;
