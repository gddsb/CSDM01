-- ============================================================================
-- Phase 4 — 数据权限引擎 DDL
-- 1. sys_business_object 业务对象字典（数据权限/状态规则的分类载体）
-- 2. sys_data_dimension 扩展 column_map JSON 字段（按业务对象的列名映射）
-- ============================================================================

-- 1. 业务对象字典
CREATE TABLE IF NOT EXISTS sys_business_object (
  id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  business_obj VARCHAR(64)  NOT NULL COMMENT '业务对象编码，对应 sys_data_scope.obj_code',
  obj_name     VARCHAR(128) NOT NULL COMMENT '业务对象中文名',
  table_name   VARCHAR(64)  NULL COMMENT '主数据表名',
  remark       VARCHAR(255) NULL,
  sort_order   INT          DEFAULT 0,
  status       TINYINT      NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at   DATETIME     NULL,
  updated_at   DATETIME     NULL,
  UNIQUE KEY uk_business_obj (business_obj)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务对象字典（数据权限/状态规则的分类载体）';

-- 2. DataDimension 扩展 column_map — 不同业务对象同一维度可能列名不同
--    示例：employee 维度 → production_order.created_by
--                        → production_report_order.report_user_name
--                        → quality_incoming_inspection.inspector_name
SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_data_dimension' AND COLUMN_NAME='column_map'),
  'SELECT "column_map already exists"',
  'ALTER TABLE sys_data_dimension ADD COLUMN column_map TEXT NULL COMMENT "按业务对象的列名映射 JSON，如 {\"production_order\":\"created_by\",\"production_report_order\":\"report_user_name\"}" AFTER target_column'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 同时扩展 self_column_map（scope_type=self 时不同业务对象拼不同列）
SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_data_dimension' AND COLUMN_NAME='self_column_map'),
  'SELECT "self_column_map already exists"',
  'ALTER TABLE sys_data_dimension ADD COLUMN self_column_map TEXT NULL COMMENT "scope_type=self 时按业务对象的列名映射 JSON，如 {\"production_report_order\":\"report_user_name\",\"quality_incoming_inspection\":\"inspector_name\"}" AFTER column_map'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
