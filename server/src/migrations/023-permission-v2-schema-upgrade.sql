-- =========================================================================
-- Migration 023: sys_permission 表结构升级（对齐规范文档 3.5 节）
-- 新增字段 + 数据回填，幂等可重复执行
-- 依赖：022-auto-task-seed.sql（所有 IAM 菜单已存在）
-- 关联规范：《MES双端权限+数据权限引擎+业务状态控制完整开发方案.md》3.5 节
-- =========================================================================

-- ---------------------------------------------------------------------------
-- Part 1: 新增字段（全部 IF NOT EXISTS 检查）
-- ---------------------------------------------------------------------------

-- 1.1 perm_type TINYINT — 权限类型枚举（规范：1=页面查看/view, 2=页面按钮/button, 3=表单控件/form, 4=上传控件/upload）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'perm_type'),
  'SELECT ''perm_type already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN perm_type TINYINT NOT NULL DEFAULT 1 COMMENT ''权限类型: 1=页面查看(view), 2=页面按钮(button), 3=表单控件(form), 4=上传控件(upload)'' AFTER type'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.2 group_name VARCHAR(64) — 归属页面分组名称（规范 3.5，分组容器按此字段归集生成）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'group_name'),
  'SELECT ''group_name already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN group_name VARCHAR(64) DEFAULT NULL COMMENT ''归属页面分组名称（按此字段归集权限分组，对应父级菜单 perm_code）'' AFTER perm_type'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.3 group_sort INT — 分组排序（规范 3.5，同级分组间排序）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'group_sort'),
  'SELECT ''group_sort already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN group_sort INT DEFAULT 0 COMMENT ''分组排序（同级分组间排序，数值小排前）'' AFTER group_name'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.4 route_path VARCHAR(255) — 页面路由（规范 3.5，替代旧 path 字段）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'route_path'),
  'SELECT ''route_path already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN route_path VARCHAR(255) DEFAULT NULL COMMENT ''页面路由路径（如 /system/users，仅 perm_type=1(view) 填写）'' AFTER group_sort'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.5 sort INT — 分组内排序（规范 3.5，替代旧 sort_order；view 固定置顶）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'sort'),
  'SELECT ''sort already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN sort INT DEFAULT 0 COMMENT ''分组内排序（数值小排前，perm_type=1(view) 固定置顶）'' AFTER route_path'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.6 is_abandon TINYINT — 废弃标记（规范 3.5，权限审查未检出的废弃标记）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'is_abandon'),
  'SELECT ''is_abandon already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN is_abandon TINYINT NOT NULL DEFAULT 0 COMMENT ''废弃标记: 0=正常（权限审查检出）, 1=废弃（审查未检出，禁止新增勾选）'' AFTER status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.7 last_sync_time DATETIME — 最近一次声明注册上报时间（规范 3.5）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'last_sync_time'),
  'SELECT ''last_sync_time already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN last_sync_time DATETIME DEFAULT NULL COMMENT ''最近一次前端 meta 声明注册上报时间'' AFTER is_abandon'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.8 last_scan_time DATETIME — 最近一次审查命中时间（规范 3.5）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'last_scan_time'),
  'SELECT ''last_scan_time already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN last_scan_time DATETIME DEFAULT NULL COMMENT ''最近一次权限审查扫描命中时间'' AFTER last_sync_time'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.9 remark VARCHAR(255) — 备注（规范 3.5）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'remark'),
  'SELECT ''remark already exists, skip''',
  'ALTER TABLE sys_permission ADD COLUMN remark VARCHAR(255) DEFAULT NULL COMMENT ''备注'' AFTER last_scan_time'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ---------------------------------------------------------------------------
-- Part 2: 字段类型对齐（规范 3.5 约束的长度调整）
-- 幂等：用 information_schema 判断目标类型是否已匹配
-- ---------------------------------------------------------------------------

-- 2.1 perm_name VARCHAR(50) → VARCHAR(64)（规范 3.5 要求）
SET @current_type = (SELECT CONCAT(DATA_TYPE, '(', CHARACTER_MAXIMUM_LENGTH, ')') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'perm_name');
SET @sql = IF(@current_type = 'varchar(64)',
  'SELECT ''perm_name already VARCHAR(64), skip''',
  'ALTER TABLE sys_permission MODIFY COLUMN perm_name VARCHAR(64) NOT NULL COMMENT ''权限名称（权限树展示用）'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.2 icon VARCHAR(100) → VARCHAR(64)（规范 3.5 要求）
SET @current_type = (SELECT CONCAT(DATA_TYPE, '(', CHARACTER_MAXIMUM_LENGTH, ')') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_permission' AND column_name = 'icon');
SET @sql = IF(@current_type = 'varchar(64)',
  'SELECT ''icon already VARCHAR(64), skip''',
  'ALTER TABLE sys_permission MODIFY COLUMN icon VARCHAR(64) DEFAULT NULL COMMENT ''菜单图标（Ant Design 图标名，仅 perm_type=1(view) 填写）'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ---------------------------------------------------------------------------
-- Part 3: 数据回填（幂等：只填新字段中 IS NULL 或有默认值未填的）
-- ---------------------------------------------------------------------------

-- 3.1 perm_type: 从旧 type 字符串映射（生产库只有 menu/button，但兼容 page/api）
-- 规范映射: 1=view(页面查看), 2=button(页面按钮), 3=form(表单控件), 4=upload(上传控件)
UPDATE sys_permission
SET perm_type = CASE type
  WHEN 'menu' THEN 1
  WHEN 'page' THEN 1
  WHEN 'button' THEN 2
  WHEN 'api' THEN 2
  WHEN 'form' THEN 3
  WHEN 'upload' THEN 4
  ELSE 2
END
WHERE perm_type IS NULL OR perm_type = 1;  -- 只回填默认值，避免覆盖已手动调整的
-- 注意: DEFAULT 1 是 view，但 button 类型默认被误设为 1，这行 WHERE 里的 "perm_type = 1" 会把 button 的默认 1 修正为 2
-- 保险起见，重新完整跑一次（不受已填值影响）：
UPDATE sys_permission
SET perm_type = CASE type
  WHEN 'menu' THEN 1
  WHEN 'page' THEN 1
  WHEN 'button' THEN 2
  WHEN 'api' THEN 2
  WHEN 'form' THEN 3
  WHEN 'upload' THEN 4
  ELSE 2
END;


-- 3.2 route_path: 从旧 path 直接复制（path 有值的 77 条）
UPDATE sys_permission
SET route_path = path
WHERE (route_path IS NULL OR route_path = '') AND path IS NOT NULL AND path != '';

-- 3.3 sort: 从旧 sort_order 直接复制
UPDATE sys_permission
SET sort = sort_order
WHERE (sort IS NULL OR sort = 0) AND sort_order IS NOT NULL;

-- 3.4 group_name 回填 — 核心逻辑
--
-- 层级 1: 顶级节点 (parent_id = 0)
--   → group_name = 自身 perm_code （顶级节点本身就是分组容器）
--
-- 层级 2+: 有 path 的 menu 节点
--   → group_name = path 去掉首位 / 后取第一段 （如 /system/users → 'system'）
--
-- 层级 2+: button / 无 path 的 menu 节点
--   → group_name = parent menu 的 group_name（通过自关联继承）

-- Step A: 顶级节点 (parent_id = 0) → group_name = 自身 perm_code
UPDATE sys_permission
SET group_name = perm_code
WHERE (group_name IS NULL OR group_name = '') AND parent_id = 0;

-- Step B: 有 path 的二级/三级 menu → group_name = path 第一段
-- MySQL SUBSTRING_INDEX('/system/users', '/', 2) → 'system'
UPDATE sys_permission
SET group_name = SUBSTRING_INDEX(SUBSTRING_INDEX(path, '/', 2), '/', -1)
WHERE (group_name IS NULL OR group_name = '')
  AND parent_id != 0
  AND path IS NOT NULL
  AND path != ''
  AND type = 'menu';

-- Step C: 剩余节点（button / 无 path 的 menu / 子子级）→ 继承 parent 的 group_name
-- 可能需要多轮（子→父→祖父 逐级传导），这里做 3 轮覆盖（足够 3 层嵌套）
UPDATE sys_permission child
JOIN sys_permission parent ON child.parent_id = parent.perm_id
SET child.group_name = parent.group_name
WHERE (child.group_name IS NULL OR child.group_name = '')
  AND parent.group_name IS NOT NULL AND parent.group_name != '';

UPDATE sys_permission child
JOIN sys_permission parent ON child.parent_id = parent.perm_id
SET child.group_name = parent.group_name
WHERE (child.group_name IS NULL OR child.group_name = '')
  AND parent.group_name IS NOT NULL AND parent.group_name != '';

UPDATE sys_permission child
JOIN sys_permission parent ON child.parent_id = parent.perm_id
SET child.group_name = parent.group_name
WHERE (child.group_name IS NULL OR child.group_name = '')
  AND parent.group_name IS NOT NULL AND parent.group_name != '';

-- Step D: group_sort — 顶级节点从 sort_order 继承（作为分组排序初始值）
UPDATE sys_permission
SET group_sort = sort_order
WHERE group_sort = 0 OR group_sort IS NULL;


-- ---------------------------------------------------------------------------
-- Part 4: 验证检查（SELECT 输出，不阻塞执行，供人工核查）
-- ---------------------------------------------------------------------------
-- SELECT '=== perm_type 分布 ===' AS info;
-- SELECT perm_type, CASE perm_type WHEN 1 THEN 'view' WHEN 2 THEN 'button' WHEN 3 THEN 'form' WHEN 4 THEN 'upload' ELSE 'unknown' END AS perm_type_desc, COUNT(*) cnt FROM sys_permission GROUP BY perm_type;
-- SELECT '=== group_name 分布（TOP 20）===' AS info;
-- SELECT group_name, COUNT(*) cnt FROM sys_permission WHERE group_name IS NOT NULL GROUP BY group_name ORDER BY cnt DESC LIMIT 20;
-- SELECT '=== group_name 为 NULL 检查 ===' AS info;
-- SELECT COUNT(*) AS null_group_name FROM sys_permission WHERE group_name IS NULL OR group_name = '';
-- SELECT '=== route_path 回填检查 ===' AS info;
-- SELECT COUNT(*) AS has_route_path FROM sys_permission WHERE route_path IS NOT NULL AND route_path != '';
