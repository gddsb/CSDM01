-- 015: 将 生产日报 / 生产报表 从报表中心移到生产管理下
-- 目标: 生产管理 (parent_id=20) 二级菜单增加两项，排在最后

-- 1. 生产日报 (perm_id=71, report:daily) → 生产管理，sort_order=4
UPDATE sys_permission
SET parent_id = 20, sort_order = 4
WHERE perm_id = 71 AND perm_code = 'report:daily';

-- 2. 生产报表 (perm_id=74, report:production) → 生产管理，sort_order=5
UPDATE sys_permission
SET parent_id = 20, sort_order = 5
WHERE perm_id = 74 AND perm_code = 'report:production';

-- 3. 报表中心 (parent_id=70) 剩余 4 项 sort_order 重排消除跳号
-- 剩余: 质量月报、效率分析、质量报表、异常分析 → 1/2/3/4
SET @rn := 0;
UPDATE sys_permission sp
JOIN (
  SELECT perm_id, @rn := @rn + 1 AS new_so
  FROM sys_permission
  WHERE parent_id = 70
  ORDER BY sort_order
) t ON sp.perm_id = t.perm_id
SET sp.sort_order = t.new_so;
