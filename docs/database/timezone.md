# docs/database/timezone.md — 时间 & 时区专题

> **碰任何时间字段、修时区问题、写日期解析代码时必读**。已踩多次坑，反复强调。

## 根因（已修复，但要理解为什么会错）

```
MySQL DATETIME 列
  → 存墙时间原文（不做时区转换，和 TIMESTAMP 不一样）
  → 例：START_TIME 存 "12:00" 就是 12:00，墙时间

Sequelize Model.toJSON() 默认行为
  → Date.prototype.toJSON() 吐 UTC ISO
  → MySQL DATETIME "12:00" 被 Sequelize timezone:'+08:00' 解析成 UTC
  → API JSON 变成 "T04:00:00Z"（= 12 - 8）
  → 前端拿到后直接用就偏了 -8h

前端旧代码
  → 正则抠字符串 "\d{1,2}):(\d{2})"
  → 把 "T04:00:00Z" 的 "04" 当小时
  → 双重偏移
```

## 当前修复（生产已生效）

### 后端：database.ts 全局 patch Model.prototype.toJSON()
所有 Sequelize 模型的 Date 字段序列化成墙时间字符串 `"YYYY-MM-DD HH:mm:ss"`，不再走 Date.prototype.toJSON() 吐 UTC ISO。

### 后端 timezone 配置必须是 `'+08:00'`
MySQL 不认 `timezone: 'local'`（会报 `ER_UNKNOWN_TIME_ZONE`）。必须显式 `'+08:00'`。

### 前端：统一用 Date 对象解析
```ts
// ✅ 正确：任何输入格式都能还原正确小时
new Date(apiReturned.start_time).getHours()
dayjs(apiReturned.start_time).format('HH:mm')

// ❌ 绝对禁止：正则抠字符串
const m = start_time.match(/(\d{1,2}):(\d{2})/)  // m[1] 可能是 04 不是 12
```

## Round-trip 应该是这样

```
用户选 "12:00" HH:mm wall-time
  → 前端拼 report.report_time 的日期 + "12:00"
  → POST "2026-09-16 12:00:00"
  → MySQL DATETIME 存 "12:00"
  → API JSON "2026-09-16 12:00:00"（墙时间字符串）
  → 前端 new Date("2026-09-16 12:00:00").getHours() → 12 ✅
```

## 沙箱时区（要设成北京时间）
```bash
ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
echo "Asia/Shanghai" > /etc/timezone
date  # 验证：应该显示 CST +0800
```
已在沙箱执行过，系统级正确。

## 🚨 新增时间相关代码的 Checklist
- [ ] 后端落库用 `utils/date.ts` 的函数（`nowBeijingDate` / `formatDateTime`）
- [ ] 前端解析统一走 `new Date()` / `dayjs()` —— **禁止正则抠时间字符串**
- [ ] 移动端 Panel 里读时间字段走 `getTime(row)` 三字段回退（`createdAt || record_time || created_at`）
- [ ] 测试 round-trip：写 "12:00" → 读回必须是 "12:00"
