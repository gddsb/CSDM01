-- 报工单主表新增：生产批号 + 两张合格证图片
-- 2026-10-21 by deploy-bot
-- 幂等：列已存在就跳过

-- production_batch
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_report_order'
    AND COLUMN_NAME = 'production_batch'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE production_report_order ADD COLUMN production_batch VARCHAR(100) NULL COMMENT '生产批号（完工必填）' AFTER remarks",
  "SELECT 'production_batch already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- image_first
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_report_order'
    AND COLUMN_NAME = 'image_first'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE production_report_order ADD COLUMN image_first VARCHAR(500) NULL COMMENT '首张合格证 URL（同步 production_report_image）' AFTER production_batch",
  "SELECT 'image_first already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- image_last
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_report_order'
    AND COLUMN_NAME = 'image_last'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE production_report_order ADD COLUMN image_last VARCHAR(500) NULL COMMENT '末张合格证 URL（同步 production_report_image）' AFTER image_first",
  "SELECT 'image_last already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
