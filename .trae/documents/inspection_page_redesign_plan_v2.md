# 检验页面改造方案（修订版）

## 需求理解（修订）

1. **料品信息/到货数量** 独立在 Drawer 顶部展示，不内联到项目表格
2. **动态样本列**：根据抽样方式（sample_rule）+ 到货数量（quantity）自动计算样本量，动态生成对应数量的样本列
3. **定性项目**：样本列显示 OK/NG 单选
4. **定量项目**：样本列显示数值录入框
5. **保持右侧弹窗** 方式不变

### 核心改造逻辑

**样本量自动计算规则：**

检验标准子表 `quality_inspection_standard_item` 已有 `need_sample_count` 字段（默认抽样数）。需新增"抽样模式"字段以支持自动计算：

| 模式 | 计算方式 | 示例 |
|------|---------|------|
| `fixed`（固定值） | need_sample_count 直接作为样本量 | 抽样方案=固定抽5件，need_sample_count=5 → 5列 |
| `percent`（百分比） | ceil(到货数量 × need_sample_count / 100) | 抽样方案=10%，到货100件 → 10列 |
| `auto`（自动，默认） | 已有逻辑不变，need_sample_count 为 0 时按默认1件 | 兼容旧数据 |

## 当前架构

```
检验标准子表 (quality_inspection_standard_item)
  → sample_rule（抽样方式文本）
  → need_sample_count（默认抽样数）
  → item_type（定性/定量）
  → 尚无"抽样模式"字段

qc_inspection_item (统一子表)
  → need_sample_count（已同步）
  → item_type（已同步）
  → 尚无 sample_rule、尚无计算后的实际样本量

qc_inspection_sample_value (样品值表)
  → 存储每个样品的测量值
```

## 改造方案

### 阶段 1：后端 - 模型扩展

#### 1.1 InspectionStandardItem 加 sample_count_mode
- 文件：`server/src/models/InspectionStandardItem.ts`
- 添加：`sample_count_mode VARCHAR(20) COMMENT '抽样模式：fixed固定值/percent百分比/auto自动'`

#### 1.2 QcInspectionItem 加 sample_rule
- 文件：`server/src/models/QcInspectionItem.ts`
- 添加：`sample_rule VARCHAR(200) COMMENT '抽样方案，来自检验标准'`

#### 1.3 迁移回填
- 文件：`server/src/migrate.ts`
- 添加 `sample_rule` 的回填逻辑（通过 item_cfg_id 或 standard_id+item_name 匹配）
- 添加 `sample_count_mode` 回填（默认 'auto'）

#### 1.4 样品量计算服务
- 文件：`server/src/services/SampleCountCalcService.ts`（新建）
- 职责：根据抽样模式 + need_sample_count + 到货数量 计算实际样本量
- 导出 `calcSampleCount(mode, need_sample_count, quantity)` 函数
- 在 controller 详情接口中调用，将计算结果写入 `qc_inspection_item.need_sample_count`

#### 1.5 QcItemCompatHelper 更新
- 文件：`server/src/services/QcItemCompatHelper.ts`
- `buildQcItemData()`: 添加 `sample_rule`、`sample_count_mode` 字段写入
- `mapQcItemsToFrontend()`: 添加 `sample_rule`、`sample_count_mode` 字段暴露

#### 1.6 Controller 更新
- 文件：三 Controller（Incoming/Product/Microbe）
- 详情接口兜底拉取时附带 `sample_rule`、`sample_count_mode`
- 在 `openInspect` 时调用 `calcSampleCount` 重算 need_sample_count

### 阶段 2：前端 - InspectionItemEditor 重构

#### 2.1 Props 扩展
```typescript
interface Props {
  items: InspectionItemRow[]
  disabled?: boolean
  onChange?: (next: InspectionItemRow[]) => void
  // 新增：物料信息（顶部展示，不入表格）
  materialInfo?: {
    material_code?: string | null
    material_name?: string | null
    specification?: string | null
    quantity?: number | null | string
    supplier_name?: string | null
    supplier_batch_no?: string | null
  }
}
```

#### 2.2 InspectionItemRow 扩展
```typescript
interface InspectionItemRow {
  // ...现有字段
  sample_rule?: string | null        // 抽样方案
  sample_count_mode?: string | null  // 抽样模式：fixed/percent/auto
}
```

#### 2.3 表格布局改造
**目标列结构（扁平化，无展开行）：**

```
|序号|检验项目|抽样方案|样本量|下限|上限|样本1|样本2|...|样本N|判定结论|
```

- 去掉 expandable 展开行
- 样品值改为内联列：根据 `need_sample_count` 动态生成 N 列
- 定性项目 → 样本列显示 OK/NG 单选（Segmented）
- 定量项目 → 样本列显示 InputNumber + 单位 + 上下限红绿提示
- 判定结论基于样品值实时自动计算

#### 2.4 样本列动态生成
- 取 `need_sample_count || sample_values.length || 1` 作为列数
- 默认上限 10 列
- 不足补空列，多余截断

#### 2.5 Drawer 顶部展示
在 Drawer 内、InspectionItemEditor 上方展示物料信息卡片：
```
┌─────────────────────────────────────────────────┐
│ 料号: XXX  │  名称: XXX  │  规格: XXX  │  到货数: 500  │
│ 供应商: XXX  │  供应商批号: XXX                               │
└─────────────────────────────────────────────────┘
```

### 阶段 3：前端 - 三页面接入

#### 3.1 IncomingInspection.tsx
- Drawer 顶部添加物料信息卡片
- `InspectionItemEditor` 接入 materialInfo prop
- `openInspect` 时根据到货数量重算 need_sample_count

#### 3.2 ProductInspection.tsx
- 同上

#### 3.3 MicrobeInspection.tsx
- 同上

### 阶段 4：部署验证

## 文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/src/models/InspectionStandardItem.ts` | 修改 | 添加 sample_count_mode 字段 |
| `server/src/models/QcInspectionItem.ts` | 修改 | 添加 sample_rule 字段 |
| `server/src/migrate.ts` | 修改 | 回填 sample_rule + sample_count_mode |
| `server/src/services/SampleCountCalcService.ts` | 新建 | 样品量自动计算服务 |
| `server/src/services/QcItemCompatHelper.ts` | 修改 | buildQcItemData / mapQcItemsToFrontend 添加新字段 |
| `server/src/controllers/IncomingInspectionController.ts` | 修改 | 兜底拉取 + 调用 calcSampleCount |
| `server/src/controllers/ProductInspectionController.ts` | 修改 | 同上 |
| `server/src/controllers/MicrobeInspectionController.ts` | 修改 | 同上 |
| `src/components/InspectionItemEditor.tsx` | 重构 | 扁平化布局，样品值内联列，动态生成样本列 |
| `src/pages/quality/IncomingInspection.tsx` | 修改 | Drawer 顶部物料卡片 + materialInfo 传入 |
| `src/pages/quality/ProductInspection.tsx` | 修改 | 同上 |
| `src/pages/quality/MicrobeInspection.tsx` | 修改 | 同上 |

## 实施步骤

1. 后端模型加字段 + 迁移回填
2. 后端 SampleCountCalcService + helper + controller 更新
3. 前端 InspectionItemEditor 扁平化重构（核心）
4. 前端三页面接入 + Drawer 顶部物料卡片
5. 部署测试服务器验证
6. 部署生产服务器

## 风险与考虑

1. **样本列数动态变化**：不同检验项 need_sample_count 不同，同一表格内列数需统一取最大值
2. **宽表格横向滚动**：样本列多时需横向滚动，设置 `scroll={{ x: ... }}`
3. **历史数据兼容**：旧检验单无 sample_count_mode 时按 'auto' 处理
4. **回填幂等性**：sample_rule 回填用 IFNULL，可重复执行
5. **百分比计算边界**：need_sample_count=0 且 mode=percent 时默认 1 件
6. **样品量变化时 sample_values 同步**：如果减少样本量，多余的 sample_values 需裁剪

## 验证

1. 服务启动无报错，迁移回填成功
2. 来料检验：Drawer 顶部物料卡片展示正确
3. 来料检验：项目表格扁平化，样本列内联
4. 定量项目：InputNumber 录入，上下限红绿提示
5. 定性项目：OK/NG 单选
6. 判定结论自动计算
7. 产品/微生物检验：同上
8. 保存后数据正确回写
