-- =========================================================================
-- Migration 019: 权限引擎 V2 底层建表
-- 新增 4 张表：业务对象字典 / 数据维度字典 / 数据权限规则 / 业务状态规则
-- 所有 DDL 带 IF NOT EXISTS / IF NOT NULL DEFAULT，幂等可重复执行
-- =========================================================================

-- ===== 表 1: 业务对象字典 =====
-- 定义所有可被权限引擎保护的业务对象（对应 Controller / Mapper 入口）
-- 需求文档中的 businessObj 常量从此表读取，避免魔法字符串
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sys_business_object'),
  'SELECT ''sys_business_object already exists, skip''',
  'CREATE TABLE sys_business_object (
    obj_id INT NOT NULL AUTO_INCREMENT COMMENT ''业务对象ID'',
    obj_code VARCHAR(50) NOT NULL COMMENT ''业务对象编码 (唯一，对应后端 @DataScope(businessObj="xxx") 的值，如 production_order / device_fault)'',
    obj_name VARCHAR(100) NOT NULL COMMENT ''业务对象名称 (中文，如 生产订单 / 设备故障)'',
    module VARCHAR(50) DEFAULT NULL COMMENT ''所属业务模块 (production / quality / device / basic ...)'',
    description VARCHAR(500) DEFAULT NULL COMMENT ''说明 (描述该对象的权限边界)'',
    has_data_scope TINYINT NOT NULL DEFAULT 1 COMMENT ''是否启用数据权限: 1=启用(可被数据权限引擎过滤), 0=不启用'',
    has_biz_status TINYINT NOT NULL DEFAULT 1 COMMENT ''是否启用业务状态校验: 1=启用(写操作会做单据状态校验), 0=不启用'',
    default_status_value VARCHAR(50) DEFAULT NULL COMMENT ''新建时的默认业务状态值 (如 开立 / 正常)'',
    sort_order INT DEFAULT 0 COMMENT ''排序'',
    status TINYINT NOT NULL DEFAULT 1 COMMENT ''1=启用, 0=禁用'',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (obj_id),
    UNIQUE KEY uk_obj_code (obj_code),
    KEY idx_module (module)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''业务对象字典：权限引擎 V2 的 businessObj 常量池'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ===== 表 2: 数据维度字典 =====
-- 定义数据权限引擎可按哪些字段过滤（对应 SQL WHERE 中的 column）
-- 需求文档中的 dimension_code 从此表读取，禁止代码里写死车间/班组字段
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sys_data_dimension'),
  'SELECT ''sys_data_dimension already exists, skip''',
  'CREATE TABLE sys_data_dimension (
    dim_id INT NOT NULL AUTO_INCREMENT COMMENT ''维度ID'',
    dim_code VARCHAR(50) NOT NULL COMMENT ''维度编码 (唯一，如 workshop / production_line / employee / department)'',
    dim_name VARCHAR(100) NOT NULL COMMENT ''维度名称 (中文，如 车间 / 产线 / 人员 / 部门)'',
    -- 关键：Sequelize 拦截器拼接 WHERE 时要用到的字段名
    target_table VARCHAR(100) NOT NULL COMMENT ''目标数据表名 (该维度在哪些业务表上生效，逗号分隔，如 production_order,production_process_record)'',
    target_column VARCHAR(100) NOT NULL COMMENT ''目标字段名 (SQL 中用来过滤的列名，如 workshop / line_id / created_by)'',
    data_type VARCHAR(20) NOT NULL DEFAULT ''string'' COMMENT ''字段类型: string / number / date / enum，生成 SQL 时决定是否加引号'',
    description VARCHAR(500) DEFAULT NULL COMMENT ''说明'' ,
    sort_order INT DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1 COMMENT ''1=启用, 0=禁用'',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (dim_id),
    UNIQUE KEY uk_dim_code (dim_code),
    KEY idx_target_table (target_table)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''数据维度字典：定义权限引擎可过滤的字段，禁止代码写死车间/班组等'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ===== 表 3: 数据权限规则 =====
-- 核心表：角色/用户 对某个 businessObj 有什么数据范围
-- 支持两级：角色级（role_id）+ 用户级（user_id，覆盖角色级）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sys_data_scope'),
  'SELECT ''sys_data_scope already exists, skip''',
  'CREATE TABLE sys_data_scope (
    scope_id INT NOT NULL AUTO_INCREMENT COMMENT ''规则ID'',
    -- 规则归属：要么绑角色，要么绑用户（user_id 优先于 role_id）
    role_id INT DEFAULT NULL COMMENT ''角色ID (关联 sys_role.role_id) — 角色级规则'',
    user_id INT DEFAULT NULL COMMENT ''用户ID (关联 sys_user.user_id) — 用户级独立规则，覆盖角色级'',
    -- 业务对象
    obj_code VARCHAR(50) NOT NULL COMMENT ''业务对象编码 (关联 sys_business_object.obj_code)'',
    -- 规则类型（两种互斥选一种，scope_type 优先级高于 dimension 细粒度）
    scope_type VARCHAR(20) NOT NULL DEFAULT ''custom'' COMMENT ''范围类型: all=全部数据 / self=仅本人 / dept=本部门及下级 / workshop=本车间 / custom=自定义维度过滤'',
    -- 当 scope_type=custom 时，按 dimension + operator + value 三元组过滤
    -- 可有多条（AND 组合）
    dim_code VARCHAR(50) DEFAULT NULL COMMENT ''维度编码 (关联 sys_data_dimension.dim_code，仅 scope_type=custom 有值)'',
    operator VARCHAR(10) NOT NULL DEFAULT ''IN'' COMMENT ''操作符: IN / NOT_IN / EQ / NEQ / LIKE / GT / LT / BETWEEN'',
    -- value 用 JSON 数组存，如 ["车间A","车间B"] 或 [1,2,3]，单值也存数组
    dim_value VARCHAR(2000) DEFAULT NULL COMMENT ''过滤值 (JSON 数组字符串，如 [""冲压车间"",""印刷车间""])'',
    -- 操作键（可选绑定，精细控制到哪个按钮/动作需要这条规则）
    perm_code VARCHAR(100) DEFAULT NULL COMMENT ''关联权限码 (关联 sys_permission.perm_code，如 device:fault:view — 只在该按钮/接口触发时生效；NULL 表示对象全量生效)'',
    description VARCHAR(500) DEFAULT NULL,
    sort_order INT DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (scope_id),
    KEY idx_role_obj (role_id, obj_code),
    KEY idx_user_obj (user_id, obj_code),
    KEY idx_obj (obj_code),
    KEY idx_dim (dim_code),
    KEY idx_perm (perm_code),
    CONSTRAINT fk_scope_role FOREIGN KEY (role_id) REFERENCES sys_role(role_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_scope_user FOREIGN KEY (user_id) REFERENCES sys_user(user_id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''数据权限规则：角色/用户 × 业务对象 × 维度三元组，Express 中间件读取后拼 WHERE'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ===== 表 4: 业务状态规则 =====
-- 定义"做什么操作需要单据在什么状态"（对应 @BizStatusCheck 拦截器）
-- 例：businessObj=production_order, operateKey=start → 要求 state IN ('开立','下发')
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sys_biz_status_rule'),
  'SELECT ''sys_biz_status_rule already exists, skip''',
  'CREATE TABLE sys_biz_status_rule (
    rule_id INT NOT NULL AUTO_INCREMENT COMMENT ''规则ID'',
    obj_code VARCHAR(50) NOT NULL COMMENT ''业务对象编码 (关联 sys_business_object.obj_code)'',
    operate_key VARCHAR(50) NOT NULL COMMENT ''操作键 (对应 @BizStatusCheck(operateKey="xxx") 的值，如 start / finish / close / submit_repair)'',
    operate_name VARCHAR(100) NOT NULL COMMENT ''操作名称 (中文，如 开工 / 完工 / 关闭 / 提交维修)'',
    -- 要求单据处于哪些状态才能执行该操作（JSON 数组）
    allowed_states VARCHAR(2000) NOT NULL COMMENT ''允许的单据状态值 (JSON 数组字符串，如 [""开立"",""下发""] 或 [0,1])'',
    -- 可选：操作后单据会变成什么状态（用于前端按钮启用/禁用判断）
    next_state VARCHAR(50) DEFAULT NULL COMMENT ''操作后目标状态 (如 开工 → 开工)'',
    -- 可选：绑定 perm_code 来精细控制 — 只有在有权执行某个 perm_code 时才做这条状态校验
    perm_code VARCHAR(100) DEFAULT NULL COMMENT ''关联权限码 (如 production:order:start)，NULL 表示该对象的所有 operateKey=xxx 都做校验'',
    error_message VARCHAR(500) DEFAULT NULL COMMENT ''校验失败时返回给前端的提示文案，NULL 用默认值'',
    sort_order INT DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (rule_id),
    UNIQUE KEY uk_obj_operate (obj_code, operate_key),
    KEY idx_obj (obj_code),
    KEY idx_perm (perm_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''业务状态规则：@BizStatusCheck 拦截器读取，判断单据当前状态是否允许执行某操作'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ===== sys_user 表追加：独立数据权限相关字段 =====
-- （现有 role_id 保留不变，新增 user 级独立 scope 字段让 user 可以覆盖角色级 scope_type）
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'scope_type_override'),
  'SELECT ''sys_user.scope_type_override already exists, skip''',
  'ALTER TABLE sys_user ADD COLUMN scope_type_override VARCHAR(20) DEFAULT NULL COMMENT ''用户级 scope_type 覆盖角色级: all / self / dept / workshop / custom — NULL 表示跟随角色'' AFTER role_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'data_dimensions_json'),
  'SELECT ''sys_user.data_dimensions_json already exists, skip''',
  'ALTER TABLE sys_user ADD COLUMN data_dimensions_json VARCHAR(2000) DEFAULT NULL COMMENT ''用户级自定义维度值 (JSON 对象，如 {workshop:["冲压车间"],line_id:[1,2]})，覆盖角色 scope 时生效'' AFTER scope_type_override'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'has_independent_scope'),
  'SELECT ''sys_user.has_independent_scope already exists, skip''',
  'ALTER TABLE sys_user ADD COLUMN has_independent_scope TINYINT NOT NULL DEFAULT 0 COMMENT ''0=跟随角色数据权限, 1=用户有独立数据权限 (scope_type_override 或 sys_data_scope.user_id 规则)'' AFTER data_dimensions_json'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ===== sys_role.scope 扩充：允许存储 JSON 而不仅是简单枚举 =====
-- 现有 scope VARCHAR(50) 字段保持不变（向后兼容），新增 scope_config 存完整配置
SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'scope_config'),
  'SELECT ''sys_role.scope_config already exists, skip''',
  'ALTER TABLE sys_role ADD COLUMN scope_config VARCHAR(2000) DEFAULT NULL COMMENT ''角色级完整数据权限配置 (JSON 对象，如 {default_scope:"dept", overrides:[{obj_code:"production_order",scope_type:"workshop"}]})'' AFTER scope'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
