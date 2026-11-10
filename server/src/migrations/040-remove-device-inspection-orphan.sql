-- Migration 040: 删除 device:inspection 孤儿菜单节点
-- 背景：
--   后端 DeviceMaintenanceRecord / DeviceMaintenanceStandard 早已合并点检和保养（用 trigger_mode 区分 daily/weekly/monthly）
--   PC 端 DeviceMaintenanceUnified 一个页面 daily=点检 + weekly/monthly=保养
--   移动端 routes.tsx 已把 /m/device-inspection 重定向到 /m/device-maintenance
--   但 DB sys_permission 里还挂着 device:inspection 菜单节点 + 2 个子按钮：
--     perm_id=908  device:inspection (menu)
--     perm_id=995  device:inspection:view (button)
--     perm_id=900  mobile:device:inspection:submit (button)
--   这三个节点无人消费，role_permission 零引用
--
-- 幂等策略：按 perm_code 删除 + 级联 role_permission 清理

-- 先清 sys_role_permission 残留引用（安全，当前为 0 条）
DELETE FROM sys_role_permission WHERE perm_id IN (
  SELECT perm_id FROM sys_permission WHERE perm_code IN (
    'device:inspection',
    'device:inspection:view',
    'mobile:device:inspection:submit'
  )
);

-- 再删 sys_permission 自身
DELETE FROM sys_permission WHERE perm_code IN (
  'device:inspection',
  'device:inspection:view',
  'mobile:device:inspection:submit'
);
