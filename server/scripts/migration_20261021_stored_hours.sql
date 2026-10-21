-- duration / hours / man_hours 改为 MySQL STORED 生成列
-- 前端只提交 start_time / end_time，DB 自动算
-- 幂等：列已是 GENERATED ALWAYS 则跳过

-- ===== production_process_exception.duration =====
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_process_exception' AND COLUMN_NAME = 'duration'
    AND EXTRA LIKE '%generated%'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE production_process_exception
    MODIFY COLUMN duration DECIMAL(10,2) GENERATED ALWAYS AS (
      CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL
           THEN ROUND(TIMESTAMPDIFF(MINUTE, start_time, end_time) / 60, 2)
           ELSE 0.00
      END
    ) STORED COMMENT '异常持续时长(小时-自动计算)'",
  "SELECT 'process_exception.duration already STORED'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== production_manpower_record.hours =====
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_manpower_record' AND COLUMN_NAME = 'hours'
    AND EXTRA LIKE '%generated%'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE production_manpower_record
    MODIFY COLUMN hours DECIMAL(10,2) GENERATED ALWAYS AS (
      CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL
           THEN ROUND(TIMESTAMPDIFF(MINUTE, start_time, end_time) / 60, 2)
           ELSE 0.00
      END
    ) STORED COMMENT '单人工时(小时-自动计算)'",
  "SELECT 'manpower_record.hours already STORED'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== production_manpower_record.man_hours =====
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_manpower_record' AND COLUMN_NAME = 'man_hours'
    AND EXTRA LIKE '%generated%'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE production_manpower_record
    MODIFY COLUMN man_hours DECIMAL(10,2) GENERATED ALWAYS AS (
      CASE WHEN end_time IS NOT NULL AND start_time IS NOT NULL
           THEN ROUND(
              TIMESTAMPDIFF(MINUTE, start_time, end_time) / 60 *
              (COALESCE(NULLIF(total_people, 0), skilled_count + general_count + labor_count + other_count))
           , 2)
           ELSE 0.00
      END
    ) STORED COMMENT '总工时(hours×人数-自动计算)'",
  "SELECT 'manpower_record.man_hours already STORED'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'STORED column migration done' AS result;
