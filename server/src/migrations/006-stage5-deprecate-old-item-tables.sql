-- ============================================================
-- 检验数据统一存储改造（阶段5.1）
-- 三旧子表重命名加 _deprecated 后缀（保留 30 天观察，不立即 DROP）
--
-- 执行前置：
--   1. 阶段 1-4 全部完成，灰度运行稳定
--   2. 已做最新备份（mysqldump）
--   3. 已停写旧子表（阶段 3.6：controller 只写新子表）
--
-- 回滚：RENAME TABLE xxx_deprecated TO xxx;
-- ============================================================

-- 阶段5.1a：来料子表
RENAME TABLE quality_incoming_inspection_item TO quality_incoming_inspection_item_deprecated;

-- 阶段5.1b：产品子表
RENAME TABLE quality_product_inspection_item TO quality_product_inspection_item_deprecated;

-- 阶段5.1c：微生物子表
RENAME TABLE quality_microbe_inspection_item TO quality_microbe_inspection_item_deprecated;

-- 验证：三张 _deprecated 表存在 + 原表名已不存在
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = DATABASE()
--   AND table_name IN (
--     'quality_incoming_inspection_item_deprecated',
--     'quality_product_inspection_item_deprecated',
--     'quality_microbe_inspection_item_deprecated'
--   );
--
-- 30 天后可执行最终清理：
-- DROP TABLE IF EXISTS quality_incoming_inspection_item_deprecated;
-- DROP TABLE IF EXISTS quality_product_inspection_item_deprecated;
-- DROP TABLE IF EXISTS quality_microbe_inspection_item_deprecated;
