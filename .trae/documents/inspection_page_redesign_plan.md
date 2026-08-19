# 检验页面改造方案

## 需求理解

用户提供的截图展示了一个扁平化的检验数据表结构，每行包含：

| 列 | 说明 | 当前状态 |
|----|------|---------|
| 序号 | 行号 | ✅ 已有 |
| 检验项目 | item_name | ✅ 已有 |
| **抽样方案** | sample_rule | ❌ 仅存在于检验标准子表，未同步到统一子表 |
| **样本量** | need_sample_count | ✅ 已有 |
| **料品名称** | material_name | ❌ 在主表单，不在项目表 |
| **规格** | specification | ❌ 在主表单，不在项目表 |
| 标准要求-下限 | lower_limit | ✅ 已有 |
| 标准要求-上限 | upper_limit | ✅ 已有 |
| **检测数据-样本1~N** | sample_values | ⚠️ 已存在但采用折叠展开方式，需改为内联列 |
| 判定结论 | result | ✅ 已有 |
| **到货数量** | quantity | ❌ 在主表单，不在项目表 |

核心改造点：
1. **抽样方案**字段同步到 `qc_inspection_item`（新增字段 + 回填）
2. **料品名称/规格/到货数量** 从主表移入项目表内联显示（通过 props 传入组件）
3. **检测数据** 从折叠展开改为内联列显示（样本1-N 作为独立列）
4. 统一改造 InspectionItemEditor 组件，三页面共用

## 当前架构

### 数据流
```
检验标准子表 (quality_inspection_standard_item)
  → 含 sample_rule(抽样方案)、item_type、need_sample_count、nominal/upper/lower
  
qc_inspection_item (统一子表)
  → 已同步 item_type、need_sample_count、nominal/upper/lower
  → ❌ 未同步 sample_rule
  
qc_inspection_sample_value (样品值表)
  → 存储每个样品的测量值
```

### 前端组件
```
InspectionItemEditor (统一组件)
  → 当前：主表行 = 检验项目，样品值在 expandable 区域
  → 目标：主表行 = 检验项目 + 样品值内联列
```

## 改造方案

### 阶段 1：后端 - 同步抽样方案字段

#### 1.1 QcInspectionItem 模型添加 sample_rule
- 文件：`server/src/models/QcInspectionItem.ts`
- 添加字段 `sample_rule VARCHAR(200) COMMENT '抽样方案，来自检验标准'`

#### 1.2 迁移回填
- 文件：`server/src/migrate.ts`
- 在 `backfillQcItemConfig()` 中追加 sample_rule 的回填逻辑
- 通过 item_cfg_id 直接关联 → 无则通过 standard_id + item_name 匹配

#### 1.3 QcItemCompatHelper 更新
- 文件：`server/src/services/QcItemCompatHelper.ts`
- `buildQcItemData()`: 添加 `sample_rule` 字段写入
- `mapQcItemsToFrontend()`: 添加 `sample_rule` 字段暴露

#### 1.4 Controller 更新
- 文件：`server/src/controllers/IncomingInspectionController.ts`
- 文件：`server/src/controllers/ProductInspectionController.ts`
- 文件：`server/src/controllers/MicrobeInspectionController.ts`
- 详情接口兜底拉取时附带 `sample_rule` 字段

### 阶段 2：前端 - InspectionItemEditor 重构

#### 2.1 Props 扩展
```typescript
interface Props {
  items: InspectionItemRow[]
  disabled?: boolean
  onChange?: (next: InspectionItemRow[]) => void
  // 新增：主表物料信息，内联显示在每行
  materialInfo?: {
    material_name?: string | null
    specification?: string | null
    quantity?: number | null | string
  }
  // 新增：最大展示样本数列数（默认5）
  maxSampleCols?: number
}
```

#### 2.2 InspectionItemRow 扩展
```typescript
interface InspectionItemRow {
  // ...现有字段
  sample_rule?: string | null  // 新增：抽样方案
}
```

#### 2.3 表格布局改造
**目标列结构：**
| 序号 | 检验项目 | 抽样方案 | 样本量 | 料品名称 | 规格 | 下限 | 上限 | 样本1 | 样本2 | ... | 样本N | 判定结论 | 到货数量 |

**改造要点：**
- 去掉 expandable 展开行
- 样品值改为内联列：根据 `need_sample_count` 或实际 `sample_values.length` 动态生成 N 个样本列
- 样本列支持定性（OK/NG 单选）和定量（InputNumber）两种渲染
- 料品名称/规格/到货数量作为"贯穿列"，每行都显示（内容相同）
- 判定结论基于样品值自动计算

#### 2.4 样本列动态生成
- 取 `max(need_sample_count, sample_values.length, 1)` 作为样本列数
- 默认上限 10 列（防止过多），可通过 `maxSampleCols` 调整
- 不足列数自动补空，多余列数截断显示

### 阶段 3：前端 - 三页面接入

#### 3.1 IncomingInspection.tsx
- `openInspect()` 时传入 materialInfo
- `InspectionItemEditor` 接入新 props

#### 3.2 ProductInspection.tsx
- 同上

#### 3.3 MicrobeInspection.tsx
- 同上

### 阶段 4：部署验证

## 文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/src/models/QcInspectionItem.ts` | 修改 | 添加 sample_rule 字段 |
| `server/src/migrate.ts` | 修改 | 添加 sample_rule 回填逻辑 |
| `server/src/services/QcItemCompatHelper.ts` | 修改 | buildQcItemData / mapQcItemsToFrontend 添加 sample_rule |
| `server/src/controllers/IncomingInspectionController.ts` | 修改 | 兜底拉取附带 sample_rule |
| `server/src/controllers/ProductInspectionController.ts` | 修改 | 同上 |
| `server/src/controllers/MicrobeInspectionController.ts` | 修改 | 同上 |
| `src/components/InspectionItemEditor.tsx` | 重构 | 扁平化布局，样品值内联，物料信息内联 |
| `src/pages/quality/IncomingInspection.tsx` | 修改 | 传入 materialInfo |
| `src/pages/quality/ProductInspection.tsx` | 修改 | 同上 |
| `src/pages/quality/MicrobeInspection.tsx` | 修改 | 同上 |

## 实施步骤

1. 后端：模型加字段 + 迁移回填 + helper 更新 + controller 更新
2. 前端：InspectionItemEditor 重构（核心改造）
3. 前端：三页面接入
4. 部署测试服务器验证
5. 部署生产服务器

## 风险与考虑

1. **宽表格横向滚动**：样本列可能很多，需设置横向滚动
2. **样本列数动态变化**：不同检验项的 need_sample_count 不同，需统一取最大值或按项分组
3. **定性 vs 定量混合**：同一行定性项目样本列显示 OK/NG，定量项目显示 InputNumber
4. **历史数据兼容**：旧检验单无 sample_rule 时显示 '-'
5. **回填幂等性**：sample_rule 回填使用 IFNULL，可重复执行
6. **性能**：内联列比展开行更紧凑，渲染更快

## 验证

1. 服务启动无报错，迁移回填 sample_rule 成功
2. 来料检验页面：检测 → 检验项表格扁平化，样品值内联
3. 产品检验页面：同上
4. 微生物检验页面：同上
5. 保存后数据正确回写后端
6. 详情页面只读模式正确渲染
