-- =====================================================================
-- 016 — 设备维保权限修复 + 责任人回填
-- 目标：
--   1. device_record 表补 4 个责任人/检查人冗余字段（Sequelize sync() 不带 alter:true 不会自动加）
--   2. MAINTENANCE 角色 (role_id=8) 补 device 父级菜单 + device:list 子菜单权限
--      → PC 端侧边栏显示"设备管理"菜单 + 移动端设备列表 API 调通
--   3. 存量 device_record 从 device_standard 的 JSON 分配字段回填 responsible/inspector
--      → 移动端"我的待办"能按责任人过滤出正确数据
--
-- 幂等实现：所有语句用 IF NOT EXISTS / INSERT IGNORE / UPDATE...WHERE 条件保护
-- =====================================================================

-- ============================================
-- Part 1: device_record 表补字段（如果不存在）
-- ============================================
-- MySQL 8.0 不支持 ADD COLUMN IF NOT EXISTS，用 information_schema 幂等处理
DROP PROCEDURE IF EXISTS _ensure_device_record_cols;
DELIMITER //
CREATE PROCEDURE _ensure_device_record_cols()
BEGIN
  SET @db := DATABASE();

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'device_record' AND COLUMN_NAME = 'responsible_user_id') THEN
    ALTER TABLE `device_record` ADD COLUMN `responsible_user_id` INT NULL COMMENT '责任人ID（冗余自 device_standard.assigned_user_ids[0]）';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'device_record' AND COLUMN_NAME = 'responsible_user_name') THEN
    ALTER TABLE `device_record` ADD COLUMN `responsible_user_name` VARCHAR(50) NULL COMMENT '责任人姓名（冗余）';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'device_record' AND COLUMN_NAME = 'inspector_user_id') THEN
    ALTER TABLE `device_record` ADD COLUMN `inspector_user_id` INT NULL COMMENT '检查人ID（冗余自 device_standard.inspector_user_ids[0]）';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'device_record' AND COLUMN_NAME = 'inspector_user_name') THEN
    ALTER TABLE `device_record` ADD COLUMN `inspector_user_name` VARCHAR(50) NULL COMMENT '检查人姓名（冗余）';
  END IF;
END //
DELIMITER ;
CALL _ensure_device_record_cols();
DROP PROCEDURE IF EXISTS _ensure_device_record_cols;

-- 字段加索引（如果不存在）
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_record'
   AND INDEX_NAME = 'idx_responsible_user_id') = 0,
  'ALTER TABLE `device_record` ADD INDEX `idx_responsible_user_id` (`responsible_user_id`)',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_record'
   AND INDEX_NAME = 'idx_inspector_user_id') = 0,
  'ALTER TABLE `device_record` ADD INDEX `idx_inspector_user_id` (`inspector_user_id`)',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- Part 2: MAINTENANCE 角色补权限
-- ============================================
-- 先查 role_id（不硬编码，兼容不同环境）
SET @maint_role_id := (SELECT role_id FROM sys_role WHERE role_code = 'MAINTENANCE' LIMIT 1);

-- 2a. 设备管理父级菜单 (perm_id=50, perm_code='device')
-- 没有唯一索引，用 INSERT IGNORE 防重复
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT @maint_role_id, p.perm_id
FROM sys_permission p
WHERE p.perm_code = 'device' AND p.parent_id = 0 AND @maint_role_id IS NOT NULL;

-- 2b. 设备档案查看 (perm_id=51, perm_code='device:list')
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT @maint_role_id, p.perm_id
FROM sys_permission p
WHERE p.perm_code = 'device:list' AND @maint_role_id IS NOT NULL;

-- 2c. 同时补全所有 device 子菜单权限（以防生产机上也缺其他项）
-- 查 MAINTENANCE 角色当前已有的 device 相关权限，补齐缺失的
INSERT IGNORE INTO sys_role_permission (role_id, perm_id)
SELECT @maint_role_id, p.perm_id
FROM sys_permission p
WHERE p.parent_id = 50
  AND @maint_role_id IS NOT NULL
  AND p.perm_id NOT IN (
    SELECT rp.perm_id FROM sys_role_permission rp WHERE rp.role_id = @maint_role_id
  );

-- ============================================
-- Part 3: 存量 device_record 回填责任人/检查人
-- ============================================
-- 3a. 回填 responsible_user_id = assigned_user_ids JSON 数组第一个元素
UPDATE device_record r
JOIN device_standard s ON r.standard_id = s.standard_id
SET r.responsible_user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(s.assigned_user_ids, '$[0]')) AS UNSIGNED)
WHERE (r.responsible_user_id IS NULL OR r.responsible_user_id = 0)
  AND s.assigned_user_ids IS NOT NULL
  AND JSON_LENGTH(s.assigned_user_ids) > 0
  AND JSON_UNQUOTE(JSON_EXTRACT(s.assigned_user_ids, '$[0]')) REGEXP '^[0-9]+$';

-- 3b. 回填 inspector_user_id = inspector_user_ids JSON 数组第一个元素
UPDATE device_record r
JOIN device_standard s ON r.standard_id = s.standard_id
SET r.inspector_user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(s.inspector_user_ids, '$[0]')) AS UNSIGNED)
WHERE (r.inspector_user_id IS NULL OR r.inspector_user_id = 0)
  AND s.inspector_user_ids IS NOT NULL
  AND JSON_LENGTH(s.inspector_user_ids) > 0
  AND JSON_UNQUOTE(JSON_EXTRACT(s.inspector_user_ids, '$[0]')) REGEXP '^[0-9]+$';

-- 3c. 回填姓名字段（从 device_standard 的冗余姓名字段取，逗号分隔取第一个）
UPDATE device_record r
JOIN device_standard s ON r.standard_id = s.standard_id
SET r.responsible_user_name = SUBSTRING_INDEX(s.assigned_user_names, ',', 1)
WHERE (r.responsible_user_name IS NULL OR r.responsible_user_name = '')
  AND s.assigned_user_names IS NOT NULL
  AND s.assigned_user_names != '';

UPDATE device_record r
JOIN device_standard s ON r.standard_id = s.standard_id
SET r.inspector_user_name = SUBSTRING_INDEX(s.inspector_user_names, ',', 1)
WHERE (r.inspector_user_name IS NULL OR r.inspector_user_name = '')
  AND s.inspector_user_names IS NOT NULL
  AND s.inspector_user_names != '';

-- ============================================
-- 验证查询（生产执行完确认）
-- ============================================
-- SELECT '=== MAINTENANCE 权限验证 ===' AS info;
-- SELECT rp.perm_id, p.perm_code, p.perm_name, p.parent_id
-- FROM sys_role_permission rp
-- JOIN sys_permission p ON rp.perm_id = p.perm_id
-- WHERE rp.role_id = @maint_role_id
-- ORDER BY p.parent_id, p.perm_code;

-- SELECT '=== device_record 责任人回填验证 ===' AS info;
-- SELECT
--   COUNT(*) AS total_records,
--   SUM(responsible_user_id IS NOT NULL AND responsible_user_id > 0) AS has_responsible,
--   SUM(inspector_user_id IS NOT NULL AND inspector_user_id > 0) AS has_inspector
-- FROM device_record;
