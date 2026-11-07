-- =========================================================================
-- Migration 024: sys_role_permission 加 terminal 终端维度
-- 对齐规范文档 3.6 节 —— 支撑双端（PC / APP）差异化权限
-- 幂等：IF NOT EXISTS 检查，安全重复执行
-- =========================================================================

-- 1. ADD terminal 列（规范 3.6 要求）
-- 1=PC 端, 2=移动端 APP；现有全部记录视为 PC 端
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role_permission' AND column_name = 'terminal'),
  'SELECT ''terminal already exists, skip''',
  'ALTER TABLE sys_role_permission ADD COLUMN terminal TINYINT NOT NULL DEFAULT 1 COMMENT ''终端: 1=PC端, 2=移动端APP — 规范 3.6'' AFTER perm_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. ADD create_time 列（规范 3.6 要求）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role_permission' AND column_name = 'create_time'),
  'SELECT ''create_time already exists, skip''',
  'ALTER TABLE sys_role_permission ADD COLUMN create_time DATETIME NULL COMMENT ''授权时间'' AFTER terminal'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. 数据回填：terminal=1（PC 端默认）、create_time=NOW()
-- 幂等：只填 IS NULL 的行，避免覆盖已手动调整的记录
UPDATE sys_role_permission SET terminal = 1 WHERE terminal IS NULL;
UPDATE sys_role_permission SET create_time = NOW() WHERE create_time IS NULL;

-- 4. 唯一约束升级（规范 3.6 要求的 (role_id, perm_id, terminal) 联合唯一）
-- 先检查约束是否已存在
SET @constraint_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE() AND table_name = 'sys_role_permission' AND index_name = 'uk_role_perm_terminal'
);
SET @sql = IF(@constraint_exists > 0,
  'SELECT ''uk_role_perm_terminal already exists, skip''',
  'ALTER TABLE sys_role_permission ADD UNIQUE INDEX uk_role_perm_terminal (role_id, perm_id, terminal)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
