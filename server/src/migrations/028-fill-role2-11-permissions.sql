-- Migration 028: role_id=2~11 全角色权限批量分配
-- 背景：role_id=3~11 除了 role_id=2 有 6 条 auto 菜单外，其余全部 0 条权限
--       导致对应业务角色登录后所有菜单/按钮都不显示
-- 修复：按业务职责为 9 个角色分配菜单节点 + 按钮级权限
-- terminal=1（PC端），INSERT IGNORE 幂等

-- role_id=2 PLANNER 计划员: 补齐 production 完整 + basic 只读 + report
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 2, p.perm_id, 1, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'basic','basic:material','basic:line','basic:process',
  'production','production:order','production:order:create','production:order:update',
    'production:order:delete','production:order:release','production:order:finish',
    'production:order:close','production:settings',
  'production:reporting','production:reporting:create','production:reporting:update',
    'production:reporting:delete','production:reporting:finish','production:reporting:close',
  'report','report:production','report:daily','report:efficiency','report:exception',
  'bigscreen','bigscreen:production','bigscreen:quality','quality'
);

-- role_id=3 QC_MANAGER 质量管理员: quality 完整 CRUD + basic 只读 + report:quality
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 3, p.perm_id, 1, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'quality','quality:incoming','quality:incoming:create','quality:incoming:update','quality:incoming:delete',
  'quality:product','quality:product:create','quality:product:update','quality:product:delete',
  'quality:process','quality:process:create','quality:process:update','quality:process:delete',
  'quality:microbe','quality:microbe:create','quality:microbe:update','quality:microbe:delete',
  'quality:environment','quality:environment:create','quality:environment:update','quality:environment:delete',
  'quality:standard','quality:standard:create','quality:standard:update','quality:standard:delete',
    'quality:standard:copy','quality:standard:revise',
  'quality:instrument','quality:instrument:create','quality:instrument:update','quality:instrument:delete',
  'quality:complaint','quality:complaint:customer','quality:complaint:supplier',
    'quality:complaint:create','quality:complaint:update','quality:complaint:delete',
  'basic','basic:material','basic:supplier','basic:customer',
  'report','report:quality','report:monthly',
  'bigscreen','bigscreen:quality'
);

-- role_id=4 QC_INSPECTOR 质量检验员: quality create/update only (不能 delete)
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 4, p.perm_id, 1, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'quality','quality:incoming','quality:incoming:create','quality:incoming:update',
  'quality:product','quality:product:create','quality:product:update',
  'quality:process','quality:process:create','quality:process:update',
  'quality:microbe','quality:microbe:create','quality:microbe:update',
  'quality:environment','quality:environment:create','quality:environment:update',
  'quality:standard','quality:instrument',
  'basic','basic:material','bigscreen','bigscreen:quality'
);

-- role_id=5 PROD_MANAGER 生产管理员: production 完整 + basic 完整 CRUD
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 5, p.perm_id, 1, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'basic','basic:material','basic:material:create','basic:material:update','basic:material:delete',
  'basic:line','basic:line:create','basic:line:update','basic:line:delete',
  'basic:process','basic:process:create','basic:process:update','basic:process:delete',
  'basic:number-rule','basic:number-rule:create','basic:number-rule:update','basic:number-rule:delete',
    'basic:number-rule:audit',
  'production','production:order','production:order:create','production:order:update',
    'production:order:delete','production:order:release','production:order:finish',
    'production:order:close','production:settings',
  'production:reporting','production:reporting:create','production:reporting:update',
    'production:reporting:delete','production:reporting:finish','production:reporting:close',
  'report','report:production','report:daily','report:efficiency','report:exception',
  'bigscreen','bigscreen:production','bigscreen:management'
);

-- role_id=6 OPERATOR 工序操作人: production reporting create/update/finish/close
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 6, p.perm_id, 1, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'basic','basic:material',
  'production','production:order',
  'production:reporting','production:reporting:create','production:reporting:update',
    'production:reporting:finish','production:reporting:close',
  'bigscreen','bigscreen:production'
);

-- role_id=8 MAINTENANCE 设备管理员: device 完整 CRUD + pc 高级按钮
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 8, p.perm_id, 1, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'device',
  'device:list','device:list:create','device:list:update','device:list:delete',
  'device:maintenance','device:maintenance:create','device:maintenance:update','device:maintenance:delete',
  'device:maintenance-standard','device:maintenance-matrix','device:maintenance-history',
  'device:fault','device:fault:create','device:fault:update','device:fault:delete',
  'device:calibration','device:calibration:create','device:calibration:update','device:calibration:delete',
  'device:document','device:document:create','device:document:update','device:document:delete',
  'device:spare-part','device:spare-part:create','device:spare-part:update','device:spare-part:delete',
  'device:oee','device:dashboard',
  'pc:device:list:create','pc:device:list:update','pc:device:list:delete',
  'pc:device:maintenance:create','pc:device:maintenance:update','pc:device:maintenance:delete',
    'pc:device:maintenance:assign','pc:device:maintenance:start','pc:device:maintenance:submit',
    'pc:device:maintenance:skip','pc:device:maintenance:cleanup',
  'pc:device:fault:create','pc:device:fault:update','pc:device:fault:delete',
    'pc:device:fault:assign','pc:device:fault:approve','pc:device:fault:close',
  'pc:device:calibration:create_plan','pc:device:calibration:update_plan',
    'pc:device:calibration:delete_plan','pc:device:calibration:submit',
  'pc:device:spare-part:create','pc:device:spare-part:update','pc:device:spare-part:delete',
    'pc:device:spare-part:stock_in','pc:device:spare-part:stock_out','pc:device:spare-part:stock_adjust',
  'basic','basic:line','report','report:exception','report:efficiency'
);

-- role_id=9 DASHBOARD_VIEWER 看板查看者: bigscreen 全部 + 各模块只读菜单
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 9, p.perm_id, 1, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'bigscreen','bigscreen:production','bigscreen:quality','bigscreen:management',
    'bigscreen:energy','bigscreen:environment',
  'report','report:production','report:quality','report:daily',
    'report:monthly','report:efficiency','report:exception',
  'basic','basic:material','basic:line','basic:process',
  'production','production:order','production:reporting',
  'quality','quality:product','quality:incoming',
  'device','device:list','device:fault',
  'all:device:list:view','all:device:fault:view','all:device:maintenance:view',
  'all:device:calibration:view','all:device:document:view','all:device:spare-part:view'
);

-- role_id=11 WarehouseClerk 仓库管理员: basic material/supplier/customer 完整 + production 只读
INSERT IGNORE INTO sys_role_permission (role_id, perm_id, terminal, create_time)
SELECT 11, p.perm_id, 1, NOW() FROM sys_permission p
WHERE p.status=1 AND p.is_abandon=0 AND p.perm_code IN (
  'basic',
  'basic:material','basic:material:create','basic:material:update','basic:material:delete',
  'basic:supplier','basic:supplier:create','basic:supplier:update','basic:supplier:delete',
  'basic:customer','basic:customer:create','basic:customer:update','basic:customer:delete',
  'basic:defect','basic:defect:create','basic:defect:update','basic:defect:delete',
  'production','production:order',
  'report','report:production',
  'bigscreen','bigscreen:production'
);
