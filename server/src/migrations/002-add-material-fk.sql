-- 迁移: 为 production_process_material.bas_material_id 添加外键约束
-- 背景: bas_material.material_id 为 VARCHAR(36) UUID，process_material.material_id 为 INT，
-- 两者类型不一致，实际关联通过 bas_material_id (UUID) 进行。
-- 此前外键约束被禁用 (constraints: false)，无法由数据库保证引用完整性。
-- 已验证无孤儿数据 (orphan_count=0)。

-- 1. 为 bas_material_id 添加索引(若不存在)
SET @idx_exists = (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_process_material'
    AND COLUMN_NAME = 'bas_material_id'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE production_process_material ADD INDEX idx_ppm_bas_material (bas_material_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 添加外键约束(若不存在)
SET @fk_exists = (
  SELECT COUNT(1) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_process_material'
    AND CONSTRAINT_NAME = 'fk_ppm_bas_material'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE production_process_material ADD CONSTRAINT fk_ppm_bas_material FOREIGN KEY (bas_material_id) REFERENCES bas_material(material_id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
