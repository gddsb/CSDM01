# docs/frontend/bigscreen.md — 数据大屏规则

> 改 ECharts 大屏页面时读这份。

## 强约束
- **ECharts 实例统一走 `src/pages/bigscreen/shared/useECharts.ts`**（init/resize/dispose 全封装）
- **配色常量从 `shared/constants.ts` 引入**，不要在各大屏页面里硬编码颜色
- 等比缩放用 `useBigScreenScale` hook
- 样式统一用 `src/styles/bigscreen.css`
