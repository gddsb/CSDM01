# 报工模块完整字段清单

> **v1.2.0 build408 · 2026-11-14**
> 含 PC 端 ProcessReporting、移动端 MobileProcessReporting 共用的主表、子表、计算字段。
> 公式口径已在后端持久化，前端 list/detail 接口直接返回，消除双端不一致。

---

## 一、主表 `production_report_order` 字段清单

### 基础信息

| # | 字段 | 类型 | 必填 | 说明 |
|---|------|------|------|------|
| 1 | report_order_id | INT PK | — | 报工单 ID（自增） |
| 2 | order_id | INT | ✅ | 关联生产订单 ID |
| 3 | order_no | VARCHAR(50) | — | 订单号（从订单冗余） |
| 4 | report_no | VARCHAR(50) | ✅ | 报工单号（如 BG20261114001） |
| 5 | line_id | INT | — | 产线 ID |
| 6 | line_name | VARCHAR(100) | — | 产线名称（冗余） |
| 7 | material_id | UUID | — | 料品 ID |
| 8 | material_code | VARCHAR(50) | — | 料号（冗余） |
| 9 | material_name | VARCHAR(200) | — | 料品名称（冗余） |
| 10 | specification | VARCHAR(200) | — | 规格（冗余） |
| 11 | report_qty | DECIMAL(12,2) | — | **产出数量**（手动填，完工必填） |
| 12 | report_time | DATETIME | ✅ | 开工时间 |
| 13 | finish_time | DATETIME | — | 完工时间 |
| 14 | close_time | DATETIME | — | 关闭时间 |
| 15 | status | TINYINT | ✅ | 状态机：0=已创建 / 1=进行中 / 2=已完工 / 3=已关闭 / 4=已取消 |
| 16 | break_minutes | INT | — | 休息总分钟数（后端自动从 production_break_time 汇总） |
| 17 | production_batch | VARCHAR(100) | — | 生产批号（完工必填） |
| 18 | remarks | VARCHAR(500) | — | 备注 |
| 19 | image_first | VARCHAR(500) | — | 首张合格证 URL |
| 20 | image_last | VARCHAR(500) | — | 末张合格证 URL |

### 人员信息（冗余字段）

| # | 字段 | 类型 | 说明 |
|---|------|------|------|
| 21 | report_user_id | INT | 创建人 ID |
| 22 | report_user_name | VARCHAR(50) | 创建人姓名 |
| 23 | finish_user_id | INT | 完工操作人 ID |
| 24 | finish_user_name | VARCHAR(50) | 完工操作人姓名 |
| 25 | close_user_id | INT | 关闭操作人 ID |
| 26 | close_user_name | VARCHAR(50) | 关闭操作人姓名 |

### ⭐ 统计持久化字段（v1.2.0 新增，自动计算）

| # | 字段 | 类型 | 说明 | 计算公式 | 写入时机 |
|---|------|------|------|----------|----------|
| 27 | **total_input_qty** | DECIMAL(12,2) | 投入数量 | `首工序 SUM(material WHERE type='投入') − SUM(type='退回')` | 子表 CRUD 后 recalc |
| 28 | **total_defect_material** | DECIMAL(12,2) | 来料不良 | `SUM(process_defect WHERE defect_type='来料不良')` | 子表 CRUD 后 recalc |
| 29 | **total_defect_process** | DECIMAL(12,2) | 制程不良 | `SUM(process_defect WHERE defect_type='制程不良')` | 子表 CRUD 后 recalc |
| 30 | **total_defect_scrap** | DECIMAL(12,2) | 检验报废 | `SUM(process_defect WHERE defect_type='检验报废')` | 子表 CRUD 后 recalc |
| 31 | **total_exception_hours** | DECIMAL(10,2) | 异常工时（h） | `SUM(COALESCE(process_exception.net_duration, duration))` | 子表 CRUD 后 recalc |
| 32 | **total_manpower_hours** | DECIMAL(10,2) | 总工时（h） | `SUM(COALESCE(manpower_record.net_hours, 0))` | 子表 CRUD 后 recalc |
| 33 | **expected_output** | DECIMAL(12,2) | 理论产出 | `total_input_qty − total_defect_material − total_defect_process − total_defect_scrap` | 子表 CRUD 后 recalc |

**Recalc 钩子挂点**：

| 子表 | Service | 挂点 |
|------|---------|------|
| process_defect | ProcessDefectService | create / update / remove / batchSave |
| process_exception | ProcessExceptionService | create / update / remove |
| process_material | ProcessMaterialService | create / update / remove |
| manpower_record | ManpowerRecordService | update（create/remove 禁止） |

**存量回填**：后端启动时 migrate.ts 自动执行 `UPDATE production_report_order SET col = (SELECT ...)`，幂等，重复运行无副作用。

---

## 二、子表字段清单

### 2.1 工序产出 `production_report_process`

| # | 字段 | 类型 | 说明 |
|---|------|------|------|
| 1 | process_id | INT PK | 工序产出 ID |
| 2 | report_order_id | INT | 关联报工单 |
| 3 | process_code | VARCHAR(50) | 工序编码 |
| 4 | process_name | VARCHAR(100) | 工序名称 |
| 5 | sort_order | INT | 工序顺序（首工序 sort_order 最小） |
| 6 | output_qty | DECIMAL(12,2) | 本工序产出数量 |

### 2.2 工序不良 `production_process_defect`

| # | 字段 | 类型 | 说明 |
|---|------|------|------|
| 1 | defect_id | INT PK | 不良记录 ID |
| 2 | report_order_id | INT | 关联报工单 |
| 3 | defect_type | VARCHAR(20) | **不良类型枚举**：`来料不良` / `制程不良` / `检验报废` |
| 4 | defect_code | VARCHAR(50) | 不良代码 |
| 5 | defect_name | VARCHAR(100) | 不良名称 |
| 6 | quantity | DECIMAL(12,2) | 不良数量 |
| 7 | unit | VARCHAR(20) | 单位 |
| 8 | defect_images | TEXT | 不良图片 URL JSON 数组 |
| 9 | remark | VARCHAR(200) | 备注 |

### 2.3 工序异常 `production_process_exception`

| # | 字段 | 类型 | 说明 |
|---|------|------|------|
| 1 | exception_id | INT PK | 异常记录 ID |
| 2 | report_order_id | INT | 关联报工单 |
| 3 | exception_type | VARCHAR(30) | 异常类型：`设备故障` / `物料问题` / `工艺调整` / `其他` |
| 4 | exception_code | VARCHAR(50) | 异常代码 |
| 5 | exception_name | VARCHAR(100) | 异常名称 |
| 6 | device_id | INT | 关联设备 |
| 7 | duration | DECIMAL(10,2) | 异常时长（h，含休息） |
| 8 | **net_duration** | DECIMAL(10,2) | **净异常时长（h，自动扣休息时段）** |
| 9 | remark | VARCHAR(200) | 备注 |

> **net_duration 计算**：由后端 `ProcessExceptionService` 在 create/update 时，用 `calcOverlapMinutes(startTime, endTime, breakTimes)` 扣掉重叠的休息时段。

### 2.4 工序物料 `production_process_material`

| # | 字段 | 类型 | 说明 |
|---|------|------|------|
| 1 | material_id | INT PK | 物料记录 ID |
| 2 | report_order_id | INT | 关联报工单 |
| 3 | material_type | VARCHAR(20) | **物料类型枚举**：`投入` / `产出` / `退回` / `消耗品` |
| 4 | material_code | VARCHAR(50) | 料号 |
| 5 | material_name | VARCHAR(200) | 料品名称 |
| 6 | quantity | DECIMAL(12,2) | 数量 |
| 7 | unit | VARCHAR(20) | 单位 |
| 8 | label_images | TEXT | 标签图片 JSON |

### 2.5 人力记录 `production_manpower_record`

| # | 字段 | 类型 | 说明 | 计算 |
|---|------|------|------|------|
| 1 | record_id | INT PK | 人力记录 ID | — |
| 2 | report_order_id | INT | 关联报工单 | — |
| 3 | start_time | DATETIME | 开始时间 | — |
| 4 | end_time | DATETIME | 结束时间 | — |
| 5 | skilled_people | INT | 熟练工人数 | — |
| 6 | regular_people | INT | 普工人数 | — |
| 7 | labor_people | INT | 劳务人数 | — |
| 8 | other_people | INT | 其他人数 | — |
| 9 | **total_people** | INT | **总人数** | 四类合计（后端自动） |
| 10 | **hours** | DECIMAL(10,2) | **时长（h）** | `(end − start)`（DB STORED 生成列） |
| 11 | **man_hours** | DECIMAL(12,2) | **工时×人数** | `hours × total_people`（DB STORED 生成列） |
| 12 | **net_hours** | DECIMAL(12,2) | **净工时** | `man_hours − 休息重叠`（后端 create/update 自动） |

---

## 三、页面计算数据对照

### PC 端 ProcessReporting 顶部统计栏

| # | 显示项 | 数据源（v1.2.0 起） | 公式 | 备注 |
|---|--------|---------------------|------|------|
| 1 | 计划数量 | Order.planned_qty | 直接取 | 后端返回 |
| 2 | 投入 | **total_input_qty** | 主表字段（持久化） | recalc 自动算 |
| 3 | 来料不良 | **total_defect_material** | 主表字段 | recalc 自动算 |
| 4 | 制程不良 | **total_defect_process** | 主表字段 | recalc 自动算 |
| 5 | 检验报废 | **total_defect_scrap** | 主表字段 | recalc 自动算 |
| 6 | 异常工时 | **total_exception_hours** | 主表字段 | recalc 自动算（扣休息） |
| 7 | 总工时 | **total_manpower_hours** | 主表字段 | recalc 自动算（扣休息） |
| 8 | 合格 / 投入 | **expected_output / total_input_qty** | `expected_output = input − material − process − scrap` | recalc 自动算 |
| 9 | 产出 | ReportOrder.report_qty | 主表手动填 | 后端返回 |

### 移动端 MobileProcessReporting StatsBar

| # | 显示项 | 数据源 | 公式 | 备注 |
|---|--------|--------|------|------|
| 1 | 合格 / 投入 | 同 PC 端 | 同 PC 端 | 双端一致 ✅ |
| 2 | 来料不良 | 同 PC 端 | 同 PC 端 | ✅ |
| 3 | 制程不良 | 同 PC 端 | 同 PC 端 | ✅ |
| 4 | 检验报废 | 同 PC 端 | 同 PC 端 | ✅ |
| 5 | 异常工时 / 总工时 | 同 PC 端 | 同 PC 端（扣休息） | ✅ |

> 移动端当前仍用 `calcReportStats` 前端聚合（公式与持久化完全一致），后续可切到后端持久化字段进一步减负。

---

## 四、外部报表中的报工派生字段

### 4.1 日报 / 大屏（后端聚合）

| # | 指标 | 公式 | 数据源 |
|---|------|------|--------|
| 1 | 良率（大屏） | `(产出 − 不良) / 投入 × 100` | ReportOrder 聚合 |
| 2 | 投入产出比 | `产出 / 投入 × 100` | ReportOrder 聚合 |
| 3 | 总不良率 | `(来料 + 制程 + 报废) / 投入 × 100` | ReportOrder 聚合 |

### 4.2 设备 OEE（不属报工，但用了报工数据）

| # | 指标 | 公式 | 备注 |
|---|------|------|------|
| 1 | 可用率 | `runtime_hours / planned_hours × 100` | 无 runtime 时默认 85% |
| 2 | 性能率 | `min(100, output / (runtime × 100)) × 100` | **硬编码 ×100**（待配置化） |
| 3 | 质量率 | `100 − defect / (output + defect) × 100` | 无数据时默认 95% |
| 4 | OEE 综合 | `availability × performance × quality / 10000` | 保留 1 位小数 |

---

## 五、接口返回字段说明

### `GET /api/production/report-orders?page=&pageSize=`

返回 rows 数组，每个元素包含：
- 主表全部字段（含 7 个持久化统计字段）
- `input_qty`（sequelize.literal 即时计算，同 total_input_qty）
- 关联子表（processes / defects / exceptions / materials / manpowers / scraps 可选）

### `GET /api/production/report-orders/:id`

返回单对象：
- 主表全部字段
- `input_qty`（同上）
- 完整子表列表

---

## 六、数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│  用户填报子表（不良/异常/物料/人力）                               │
│  ProcessDefectService.create() / update() / remove() / batchSave()│
│  ProcessExceptionService.create() / update() / remove()         │
│  ProcessMaterialService.create() / update() / remove()          │
│  ManpowerRecordService.update()                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ 写完子表
                            ▼
              ┌────────────────────────┐
              │  recalcReportStats()    │  ← server/src/utils/reportOrderStats.ts
              │  一次 SQL UPDATE SET    │     失败静默（try/catch）
              │  7 个统计列            │     不阻塞主流程
              └────────────┬───────────┘
                           │
                           ▼
     ┌────────────────────────────────────────────┐
     │  production_report_order 主表更新          │
     │  total_input_qty = 投入 − 退回             │
     │  total_defect_material = SUM(来料不良)      │
     │  total_defect_process = SUM(制程不良)       │
     │  total_defect_scrap = SUM(检验报废)         │
     │  total_exception_hours = SUM(net_duration)  │
     │  total_manpower_hours = SUM(net_hours)      │
     │  expected_output = 投入 − 不良 − 报废        │
     └────────────────────┬───────────────────────┘
                          │
            ┌─────────────┴───────────────┐
            ▼                             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │  PC 端 直接读    │          │  移动端 直接读    │
    │  持久化字段      │          │  持久化字段      │
    └─────────────────┘          └─────────────────┘
         ✅ 双端公式一致 ✅
```

---

## 七、版本历史

| 版本 | 日期 | 改动 |
|------|------|------|
| v1.2.0 build408 | 2026-11-14 | 新增 7 个持久化统计字段 + 4 个子表 CRUD recalc 钩子 + 存量 backfill |
| 之前 | —— | 无持久化，PC/移动端各自前端聚合，公式曾有差异（PC 未用 net_hours/net_duration） |
