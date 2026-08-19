# 检验项目抽样方式改造任务计划

## 需求理解

### 核心变更
将检验项目的"抽样方式"从自由文本改为结构化配置：

**抽样方案**（4种可选）：
| 方案 | 配置项 | 说明 |
|------|--------|------|
| AQL抽样 | AQL值（如 0.65、1.0、2.5） | 根据AQL值查表确定抽样数 |
| 按数量抽样 | 最多5个分段数量（如 ≤100→5, ≤500→10, ≤1000→20） | 按到货数量区间分段抽样 |
| 固定数量抽样 | 一个固定数量值 | 每次抽取固定数量 |
| 全检 | 无 | 100%全检 |

**抽样比例**：百分比输入（如 10%、5%）

### 页面改造
1. **检验标准详情页** (InspectionStandard.tsx) 列表列调整：项目大类、检验项目、缺陷等级、检验标准、抽样方案、抽样比例、操作
2. **检验标准表单页** (InspectionStandardForm.tsx) 项目编辑弹窗重写抽样配置区域
3. **检验页面** (IncomingInspection/ProductInspection/MicrobeInspection) 的 InspectionItemEditor 根据新抽样结构动态渲染

## 数据模型设计

### InspectionStandardItem 改造
移除 `sample_rule`（自由文本），新增结构化字段：

```typescript
// 抽样方案
sampling_plan: 'AQL' | '按数量' | '固定数量' | '全检'  // VARCHAR(20)
// 抽样比例（百分比，如 10 表示 10%）
sampling_ratio: number | null  // INT
// 抽样方案详情（JSON，按方案类型不同结构不同）
sampling_detail: string | null  // TEXT，存储JSON
```

**sampling_detail JSON 结构**：
- AQL抽样：`{ "aql_value": 0.65 }`
- 按数量抽样：`{ "segments": [{ "max_qty": 100, "sample_count": 5 }, { "max_qty": 500, "sample_count": 10 }] }`
- 固定数量抽样：`{ "fixed_count": 10 }`
- 全检：`{}`

### QcInspectionItem 同步
同样新增 `sampling_plan`、`sampling_ratio`、`sampling_detail` 字段用于持久化。

## 后端改造

### 1. 模型层
| 文件 | 变更 |
|------|------|
| `InspectionStandardItem.ts` | 移除 `sample_rule`，新增 `sampling_plan`、`sampling_ratio`、`sampling_detail` |
| `QcInspectionItem.ts` | 移除 `sample_rule`，新增 `sampling_plan`、`sampling_ratio`、`sampling_detail` |
| `migrate.ts` | 添加新列迁移 + 删除旧列 |

### 2. 服务层
| 文件 | 变更 |
|------|------|
| `SampleCountCalcService.ts` | 重写为基于新抽样结构的样本量计算：AQL查表、分段匹配、固定值、全检 |
| `QcItemCompatHelper.ts` | `buildQcItemData` / `mapQcItemsToFrontend` 适配新字段 |

### 3. Controller 层
| 文件 | 变更 |
|------|------|
| 三 Controller | 兜底拉取适配新字段 |

### 4. 抽样数量计算逻辑
- **AQL抽样**：根据 AQL 值查 GB/T 2828.1 表，得样本量
- **按数量抽样**：根据到货数量匹配分段，返回对应 sample_count
- **固定数量抽样**：返回 fixed_count
- **全检**：返回到货数量（100%全检）

## 前端改造

### 1. InspectionStandardForm.tsx（标准表单页）
**项目编辑弹窗改造**：
- 移除"抽样方式"自由文本输入
- 新增"抽样方案"下拉选择（AQL抽样/按数量抽样/固定数量抽样/全检）
- 根据选择动态渲染配置区：
  - AQL抽样：AQL值输入 + 提示文字
  - 按数量抽样：分段数量表格（最多5段，可增删）
  - 固定数量抽样：固定数量输入框
  - 全检：提示文字，无需输入
- "抽样比例"输入框（百分比，可选）

**项目列表列改造**：
- 移除：抽样数、单位、检验方法
- 新增：缺陷等级、检验标准、抽样方案、抽样比例
- 保留：项目大类、检验项目、操作

**目标列**：项目大类 | 检验项目 | 缺陷等级 | 检验标准 | 抽样方案 | 抽样比例 | 操作

### 2. InspectionStandard.tsx（标准列表/详情页）
**详情 Drawer 项目列表列改造**：
- 与表单页保持一致

### 3. InspectionItemEditor.tsx（检验编辑器）
- 物料信息卡片保留
- 根据 `sampling_plan` 和 `sampling_ratio` 动态生成样本列
- AQL抽样：显示 AQL 值
- 按数量抽样：显示分段信息
- 固定数量：显示固定数量
- 全检：显示"全检"
- 样本量计算通过 `SampleCountCalcService`

### 4. 三检验页面
- 适配新字段传递
- 列表列调整：移除"抽样方式"，改为"抽样方案"+"抽样比例"

## 实施步骤

### Step 1：后端数据模型
1. 修改 `InspectionStandardItem.ts` 和 `QcInspectionItem.ts` 模型
2. 修改 `migrate.ts` 添加新列迁移
3. 部署服务器，数据库执行 ALTER TABLE

### Step 2：后端服务层
1. 重写 `SampleCountCalcService.ts`
2. 修改 `QcItemCompatHelper.ts`
3. 修改三 Controller

### Step 3：前端 InspectionStandardForm.tsx
1. 项目编辑弹窗：抽样方案选择 + 动态配置区
2. 项目列表列改造
3. 数据序列化/反序列化适配

### Step 4：前端 InspectionStandard.tsx
1. 详情 Drawer 项目列表列改造

### Step 5：前端 InspectionItemEditor.tsx
1. 适配新字段显示
2. 样本量动态计算

### Step 6：前端三检验页面
1. 适配新字段
2. 列表列调整

### Step 7：部署验证

## AQL 抽样数查表（GB/T 2828.1 简化）

| 到货数量 | AQL 0.65 | AQL 1.0 | AQL 2.5 | AQL 4.0 |
|---------|----------|---------|---------|---------|
| ≤150 | 13 | 8 | 5 | 3 |
| 151~280 | 20 | 13 | 8 | 5 |
| 281~500 | 32 | 20 | 13 | 8 |
| 501~1200 | 50 | 32 | 20 | 13 |
| 1201~3200 | 80 | 50 | 32 | 20 |
| 3201~10000 | 125 | 80 | 50 | 32 |
| >10000 | 200 | 125 | 80 | 50 |

## 风险与考虑

1. **不考虑旧数据兼容**：直接删除 `sample_rule` 字段，旧数据可能丢失
2. **AQL 查表简化**：使用固定表，不引入完整 GB/T 2828.1 标准
3. **分段抽样边界**：按到货数量匹配分段时使用 ≤ 上限的逻辑
4. **全检模式**：需要确认是否允许（可能导致大量样本列）
5. **JSON 存储**：sampling_detail 使用 TEXT 存储 JSON，查询时需解析
