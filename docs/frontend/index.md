# docs/frontend/index.md — 前端开发规则

> **前端任务默认必读**：改 React/TSX/样式/路由/状态管理时必读。移动端和大屏另有补充文件。

## 强约束

| # | 约束 | 原因 |
|---|------|------|
| F1 | **API 调用统一走 `src/utils/api.ts`** | 封装了 baseURL `/api`、token 注入、中文参数 encode、状态码转换。直接 `axios(...)` 会丢这些。 |
| F2 | **所有函数参数必类型注解 + 标点半角** | `pnpm build` 先跑 `tsc --noEmit`，零错误才能继续。 |
| F3 | **报工页 ProcessReporting.tsx 禁止直接膨胀** | 明细状态在 `hooks/useReportDetailRecords.ts`，列定义独立文件，弹窗/统计条/图片抽屉在 `sections/`。新增功能优先在对应子文件扩展。 |
| F4 | **系统配置页 SystemConfig.tsx 禁止直接膨胀** | 各 Tab 在 `pages/system/config-tabs/`，新增 Tab 在该目录新组件 + 主文件挂载。 |
| F5 | **antd-mobile-icons 是必须依赖** | package.json 里声明，移动端报工页面用到。 |

## 主题系统
- `src/themes/index.ts` 六套主题配色（CSS Variables）
- 切换由 `AppContext` 管理

## 权限控制
- `user.perm_codes` 权限码列表（如 `basic:material`），超级管理员/系统管理员含 `*`
- 菜单/按钮据此显隐，不要在组件里硬编码角色判断

## CSR 无 SSR hydration 问题
纯 Vite SPA，不用考虑 SSR。

## 报表导出
- `xlsx` 做表格
- `docx` / `html-docx-js-typescript` 做文档

## 子文件索引
| 要做什么 | 读哪份 |
|---------|--------|
| 改 ant-mobile 页面 | mobile.md |
| 改 ECharts 大屏 | bigscreen.md |
