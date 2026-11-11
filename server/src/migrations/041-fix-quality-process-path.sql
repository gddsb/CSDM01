-- Migration 041: 修正 quality:process 的 path 拼写
-- 背景：DB 里 quality:process（制程检验）path = /quality/process-inspections
--       main.tsx 实际注册的路由是 /quality/process
--       path 后缀不一致导致菜单点击后 URL 对不上，浏览器地址栏和侧边菜单高亮不同步
--       quality 分组其他 5 个子菜单 path 全部正确（incoming/product/microbe/environment/standards）
-- 修复：UPDATE path = '/quality/process' 对齐实际路由
UPDATE sys_permission
SET path = '/quality/process'
WHERE perm_code = 'quality:process'
  AND path = '/quality/process-inspections';
