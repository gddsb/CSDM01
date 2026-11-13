# docs/frontend/mobile.md — 移动端规则

> 改 ant-mobile 页面、移动端报工组件时读这份。

## 路由 & 布局
- 独立于 PC 端：`src/mobile/MobileLayout.tsx` + `MobileRoutes.tsx`
- UI 库：antd-mobile + antd-mobile-icons（package.json 里已声明）

## 报工组件拆分
移动端报工详情拆到 `src/mobile/pages/production/components/`：
```
DefectTab / ScrapTab / MaterialTab / ExceptionTab / ManpowerTab
ImageManagerModal / DefectSelect / shared
```

## 时间字段（关键）
移动端时间字段统一用 `new Date(str).getHours()` / dayjs 解析。**禁止用正则抠时间字符串**（已踩过 UTC ISO 偏 -8h 的坑）。
详细见 database/timezone.md。

## Sequelize createdAt 映射陷阱
| 模型 | createdAt 映射 | DB 列 | JS 属性名 |
|------|---------------|-------|----------|
| ProcessDefect | `createdAt: 'record_time'` | record_time | **record_time** |
| ProcessMaterial | `createdAt: 'record_time'` | record_time | **record_time** |
| ProcessException | 默认 | created_at | **created_at** |
| ManpowerRecord | 默认 | created_at | **created_at** |
| ProductionBreakTime | 默认 | created_at | **created_at** |

前端统一读取：
```ts
function getTime(row: any): string | undefined {
  return row.createdAt || row.record_time || row.created_at
}
```

## 移动端布局问题（状态栏覆盖/滚不动/顶栏不固定）
调用 `mes-mobile-framework` skill。
