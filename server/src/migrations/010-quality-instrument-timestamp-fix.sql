-- 010-quality-instrument-timestamp-fix.sql
-- 统一 DATETIME 列类型：消除 TIMESTAMP 自动时区转换隐患
-- TIMESTAMP 列会随 MySQL session timezone 变化，
-- DATETIME 列是纯字符串，配合 Sequelize timezone '+08:00' 完全稳定

ALTER TABLE quality_instrument
  MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';
