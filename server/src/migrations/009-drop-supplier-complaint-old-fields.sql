-- ============================================================
-- 供应商投诉模块：删除旧关联字段 related_inspection_id / related_inspection_no
-- 前置：已确认后端 Controller、前端 TSX、Model 均已清理旧字段引用
--       无新旧数据兼容需求（旧数据可丢弃）
-- 影响表：quality_supplier_complaint
-- 新字段：related_doc_type / related_doc_id / related_doc_no（已上线）
-- ============================================================

-- 1. 删除 related_inspection_id 上的索引（先查再删，避免索引名不确定导致报错）
SET @idx_name = (
  SELECT INDEX_NAME
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'quality_supplier_complaint'
    AND COLUMN_NAME = 'related_inspection_id'
    AND NON_UNIQUE = 1
  LIMIT 1
);
SET @sql = IF(@idx_name IS NOT NULL AND @idx_name <> '',
  CONCAT('ALTER TABLE quality_supplier_complaint DROP INDEX `', @idx_name, '`'),
  'SELECT ''skip: no related_inspection_id index found'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. 删除旧字段
ALTER TABLE quality_supplier_complaint
  DROP COLUMN related_inspection_id,
  DROP COLUMN related_inspection_no;

-- 3. 验证
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'quality_supplier_complaint'
  AND COLUMN_NAME IN ('related_doc_type', 'related_doc_id', 'related_doc_no')
ORDER BY ORDINAL_POSITION;

-- ============================================================
-- 回滚脚本（如需恢复旧字段）
-- ALTER TABLE quality_supplier_complaint
--   ADD COLUMN related_inspection_id INT NULL COMMENT '关联来料检验单ID（已废弃）',
--   ADD COLUMN related_inspection_no VARCHAR(50) NULL COMMENT '关联来料检验单号（已废弃）';
-- ALTER TABLE quality_supplier_complaint ADD INDEX idx_related_inspection_id (related_inspection_id);
-- ============================================================
