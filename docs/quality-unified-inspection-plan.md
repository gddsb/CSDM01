# 检验数据统一存储改造任务计划（主表独立方案）

> 决策日期：2026-08-19
> 方案类型：主表独立 + 子表合并 + sample_value 统一表
> 数据迁移：全量迁移 + 旧表保留只读
> 前端策略：三页面共用统一录入组件

## 一、改造目标

### 现状
- 3 张检验主表独立：[quality_incoming_inspection](../server/src/models/IncomingInspection.ts)、[quality_product_inspection](../server/src/models/ProductInspection.ts)、[quality_microbe_inspection](../server/src/models/MicrobeInspection.ts)
- 3 张检验子表独立：quality_incoming_inspection_item、quality_product_inspection_item、quality_microbe_inspection_item
- 子表 `actual_value` 为单字段 VARCHAR(500)，无法支撑多样板/多维度测量值结构化记录
- 检验标准子表 [quality_inspection_standard_item](../server/src/models/InspectionStandardItem.ts) 已统一，但缺少定量/定性区分和数值上下限

### 目标终态
- **主表保持独立不动**（3 张主表业务关联字段差异大，不合并）
- **子表合并为 1 张统一表** qc_inspection_item，用 `source_type + inspection_id` 多态外键关联三主表
- **新建样品测量值表** qc_inspection_sample_value，统一定性/定量，支撑 SPC 聚合
- **扩展检验标准子表** 加 5 字段（item_type/need_sample_count/nominal_value/upper_limit/lower_limit）
- 历史数据全量迁移，旧表保留只读

## 二、表结构设计

### 2.1 扩展 quality_inspection_standard_item（配置层，加 5 字段）

```sql
ALTER TABLE quality_inspection_standard_item
  ADD COLUMN item_type VARCHAR(20) COMMENT '项目类型：qualitative定性/quantitative定量',
  ADD COLUMN need_sample_count INT DEFAULT 0 COMMENT '默认抽样数，0=不限制由实际抽样决定',
  ADD COLUMN nominal_value DECIMAL(15,4) NULL COMMENT '标称值（定量用）',
  ADD COLUMN upper_limit DECIMAL(15,4) NULL COMMENT '上限（定量用）',
  ADD COLUMN lower_limit DECIMAL(15,4) NULL COMMENT '下限（定量用）';
```

回填规则：standard_value 含「±」「~」「-」数值模式标 quantitative + 解析上下限；含「无」「光亮」等定性描述标 qualitative。

### 2.2 新建 qc_inspection_item（统一子表，多态外键）

```sql
CREATE TABLE qc_inspection_item (
  item_id            INT PRIMARY KEY AUTO_INCREMENT,
  source_type        VARCHAR(20) NOT NULL COMMENT '来源类型：来料/产品/微生物',
  inspection_id      INT NOT NULL COMMENT '多态外键，关联三主表inspection_id（无FK约束，应用层保证）',
  item_cfg_id        INT COMMENT '关联quality_inspection_standard_item.item_id（可空，旧数据无）',
  item_name          VARCHAR(200) NOT NULL COMMENT '检验项目名称',
  category           VARCHAR(50) COMMENT '项目大类',
  standard_value     VARCHAR(500) COMMENT '标准值（定性描述保留）',
  actual_value_text  VARCHAR(500) COMMENT '兼容旧数据/单值场景/定性值汇总',
  sample_count       INT COMMENT '实际抽样数',
  summary            VARCHAR(200) COMMENT '汇总如8件全合格',
  result             TINYINT COMMENT '0不合格/1合格（综合判定）',
  inspector_id       INT COMMENT '项目检验人ID',
  inspector_name     VARCHAR(50) COMMENT '冗余',
  inspection_time    DATETIME,
  unit               VARCHAR(20),
  sort_order         INT DEFAULT 0,
  remarks            VARCHAR(500),
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_source_inspection (source_type, inspection_id),
  INDEX idx_item_cfg (item_cfg_id),
  INDEX idx_result (result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.3 新建 qc_inspection_sample_value（样品测量值明细）

```sql
CREATE TABLE qc_inspection_sample_value (
  value_id           INT PRIMARY KEY AUTO_INCREMENT,
  item_id            INT NOT NULL COMMENT '关联qc_inspection_item.item_id',
  sample_no          INT NOT NULL COMMENT '样板序号1..N',
  dimension_code     VARCHAR(30) COMMENT '测量维度编码如D/d/b/H',
  dimension_name     VARCHAR(100) COMMENT '维度名称',
  measure_value_num  DECIMAL(15,4) COMMENT '定量值（可聚合，SPC用）',
  measure_value_text VARCHAR(50) COMMENT '定性值OK/NG/无缺口',
  is_qualified       TINYINT COMMENT '0/1',
  defect_desc        VARCHAR(500) COMMENT '缺陷描述',
  measured_at        DATETIME,
  inspector_id       INT,
  UNIQUE KEY uk_item_sample_dim (item_id, sample_no, dimension_code),
  INDEX idx_item (item_id),
  INDEX idx_sample (sample_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.4 主表不动（3 张保持现状）

三主表及其业务关联字段（supplier/batch/receipt/report_order/incoming/order）全部保留不动。

## 三、分段开发任务（5 阶段）

### 阶段 1：配置层扩展 + 新表建设（零风险）

**目标**：扩展配置层、新建两张新表、关联定义、增量数据双写，不动现有任何代码逻辑

**任务清单**：

| 编号 | 任务 | 文件 | 验收 |
|------|------|------|------|
| 1.1 | 扩展 InspectionStandardItem 模型加 5 字段 | [InspectionStandardItem.ts](../server/src/models/InspectionStandardItem.ts) | tsc 通过 |
| 1.2 | 新建 QcInspectionItem 模型 | server/src/models/QcInspectionItem.ts | 模型可实例化 |
| 1.3 | 新建 QcInspectionSampleValue 模型 | server/src/models/QcInspectionSampleValue.ts | 模型可实例化 |
| 1.4 | 编写迁移 SQL 005 | server/src/migrations/005-quality-unified-inspection.sql | ALTER + CREATE 两表 |
| 1.5 | 在 models/index.ts 注册新模型 + 关联定义 | [models/index.ts](../server/src/models/index.ts) | 三主表 hasMany QcInspectionItem（as: 'qc_items'），QcInspectionItem hasMany QcInspectionSampleValue（as: 'sample_values'） |
| 1.6 | 回填 standard_item.item_type 脚本 | server/src/scripts/backfill-item-type.ts | 全部 standard_item 有 item_type 值 |
| 1.7 | 双写逻辑：三 controller 的 create/update 同步写新子表 | [IncomingInspectionController](../server/src/controllers/IncomingInspectionController.ts).ts、ProductInspectionController.ts、MicrobeInspectionController.ts | 新建检验单时旧子表 + 新子表都写入，保证增量数据同步 |

**风险**：低。双写不影响读，旧逻辑完全保留。

**依赖**：无

### 阶段 2：数据迁移（中风险，需备份窗口）

**目标**：将历史三旧子表数据全量迁移到新统一子表

**前置条件**：阶段 1 完成 + 数据库全量备份

**任务清单**：

| 编号 | 任务 | 文件 | 验收 |
|------|------|------|------|
| 2.1 | 编写备份脚本 | server/src/scripts/backup-before-migration.sh | mysqldump 全量备份到 /opt/milk-can-mes/backups/ |
| 2.2 | 迁移脚本：来料子表 → qc_inspection_item | server/src/scripts/migrate-incoming-items.ts | source_type='来料'，count 一致 |
| 2.3 | 迁移脚本：产品子表 → qc_inspection_item | server/src/scripts/migrate-product-items.ts | source_type='产品'，count 一致 |
| 2.4 | 迁移脚本：微生物子表 → qc_inspection_item | server/src/scripts/migrate-microbe-items.ts | source_type='微生物'，count 一致 |
| 2.5 | 迁移脚本：actual_value 逗号串 → sample_value 行 | server/src/scripts/migrate-sample-values.ts | 含逗号/分号拆为多行 sample_no 递增 dimension_code='VALUE'，无法解析留 actual_value_text |
| 2.6 | 一致性校验脚本 | server/src/scripts/verify-migration.ts | 三旧子表 count vs 新子表按 source_type count，抽检 10 条字段比对 |
| 2.7 | 回滚脚本 | server/src/scripts/rollback-migration.sh | 校验失败时恢复备份 |

**数据解析规则**（任务 2.5）：
- `actual_value` 含逗号或分号 → 拆分为多行，sample_no 从 1 递增，dimension_code 统一 'VALUE'，measure_value_num 尝试 CAST 为 DECIMAL 成功则存 num 否则存 text
- `actual_value` 为单个值 → 不拆分，sample_no=1，dimension_code='VALUE'
- `actual_value` 为空或纯文本描述 → 不创建 sample_value 行，留 actual_value_text

**风险**：中。主要在 actual_value 格式不规范，缓解措施是不强制解析、留 actual_value_text。

**依赖**：阶段 1 完成

### 阶段 3：controller 切换查新子表（中风险）

**目标**：三套 controller 的 item CRUD 改查新统一子表，旧子表停写但保留只读兼容

**任务清单**：

| 编号 | 任务 | 文件 | 验收 |
|------|------|------|------|
| 3.1 | 新建 SampleValueController + 路由 | server/src/controllers/SampleValueController.ts、server/src/routes/sample-value.ts | /api/quality/inspection-items/:item_id/sample-values CRUD |
| 3.2 | 实现自动判定 service | server/src/services/SampleJudgeService.ts | measure_value_num 按 upper/lower 判 is_qualified，汇总 item.result 和 inspection.result |
| 3.3 | 修改 IncomingInspectionController 的 item 查询改走新子表 | [IncomingInspectionController.ts](../server/src/controllers/IncomingInspectionController.ts) | getDetail 用 QcInspectionItem（WHERE source_type='来料'）+ include sample_values |
| 3.4 | 修改 ProductInspectionController 的 item 查询改走新子表 | ProductInspectionController.ts | 同上 source_type='产品' |
| 3.5 | 修改 MicrobeInspectionController 的 item 查询改走新子表 | MicrobeInspectionController.ts | 同上 source_type='微生物' |
| 3.6 | 关闭双写，改为只写新子表 | 三 controller 的 create/update | 旧子表停止写入 |
| 3.7 | 主表 controller 的状态流转/审核逻辑不动 | — | start/submit/review/delete 保持原逻辑 |
| 3.8 | 单元测试 | server/src/controllers/__tests__/ | 覆盖三类型 item CRUD + 状态机 |

**关键改动点**（任务 3.3-3.5）：
```typescript
// 改造前（getDetail）
include: [{ model: IncomingInspectionItem, as: 'items', order: [...] }]

// 改造后
include: [{
  model: QcInspectionItem, as: 'qc_items',
  where: { source_type: '来料' }, required: false,
  order: [['sort_order', 'ASC']],
  include: [{ model: QcInspectionSampleValue, as: 'sample_values' }]
}]
```

**风险**：中。controller 查询逻辑改动，需保证字段映射兼容前端。

**依赖**：阶段 2 完成

### 阶段 4：前端录入组件统一（低风险）

**目标**：抽取统一检验录入组件，三页面共用，按 item_type 动态渲染

**任务清单**：

| 编号 | 任务 | 文件 | 验收 |
|------|------|------|------|
| 4.1 | 新建 InspectionItemEditor 组件 | src/components/InspectionItemEditor.tsx | 接收 item_cfg + sample_values，按 item_type 渲染 |
| 4.2 | qualitative 渲染逻辑 | 同上 | 单选 OK/NG × N 件（N=need_sample_count），写入 sample_value.measure_value_text |
| 4.3 | quantitative 单值渲染 | 同上 | N 个输入框，写入 sample_value.measure_value_num，dimension_code='VALUE' |
| 4.4 | quantitative 多维度渲染 | 同上 | 动态表格（行=sample_no，列=dimension），写入多行 sample_value |
| 4.5 | 自动判定实时展示 | 同上 | 录入值比对 upper/lower 显示红绿，is_qualified 自动计算 |
| 4.6 | IncomingInspection 引入组件 | [IncomingInspection.tsx](../src/pages/quality/IncomingInspection.tsx) | 录入走新组件 |
| 4.7 | ProductInspection 引入组件 | [ProductInspection.tsx](../src/pages/quality/ProductInspection.tsx) | 同上 |
| 4.8 | MicrobeInspection 引入组件 | [MicrobeInspection.tsx](../src/pages/quality/MicrobeInspection.tsx) | 同上 |
| 4.9 | 旧 actual_value 字段保留只读展示历史 | 三页面详情 | 兼容历史数据展示 |

**风险**：低。组件抽取独立开发，三页面渐进引入。

**依赖**：阶段 3 完成

### 阶段 5：旧子表下线与清理（收尾）

**目标**：稳定后下线旧子表，清理冗余代码

**前置条件**：阶段 4 灰度运行 1-2 周无异常

**任务清单**：

| 编号 | 任务 | 文件 | 验收 |
|------|------|------|------|
| 5.1 | 三旧子表重命名加 _deprecated 后缀 | SQL 脚本 | 不立即 DROP，保留 30 天观察 |
| 5.2 | 删除 controller 中残留旧子表查询代码 | 三 controller | 无 IncomingInspectionItem 等引用 |
| 5.3 | 删除旧子表模型文件 | IncomingInspectionItem.ts 等 3 文件 | 模型移除 |
| 5.4 | 更新 seed.ts 指向新表 | [seed.ts](../server/src/seed.ts) | 种子数据用新表 |
| 5.5 | 更新 README 文档 | [README.md](../README.md) | 表结构说明更新 |

**依赖**：阶段 4 灰度通过

## 四、阶段依赖关系

```
阶段1（配置层+新表+双写）──零风险──→ 阶段2（数据迁移）──中风险──→ 阶段3（controller切流量）──中风险──→ 阶段4（前端组件）──低风险──→ 灰度1-2周──→ 阶段5（旧表下线）
```

## 五、风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 多态外键无物理约束 | 中 | ORM 层封装，删除主表时应用层级联清理 sample_values + qc_inspection_item |
| actual_value 格式不规范无法解析 | 中 | 不强制解析，留 actual_value_text，新数据才走 sample_value |
| 迁移期间双写不一致 | 中 | 阶段1双写同步，阶段2迁移历史，阶段3切流量后才停旧表写 |
| controller 切换后字段映射不兼容前端 | 中 | 阶段3保证返回字段名与旧接口一致，前端无感切换 |
| sample_value 数据膨胀 | 低 | 判定型 N 件产生 N 行，可接受；定量多维度 N×M 行，MES 数据量可控 |

## 六、关键设计决策

1. **主表独立不合并**：三主表业务关联字段差异大，合并导致列爆炸，独立保留零迁移风险
2. **子表 source_type 多态外键**：一张表统一三类型，无物理 FK 约束，应用层保证一致性
3. **sample_value 拆 num/text 双字段**：定量走 num 可聚合做 SPC，定性走 text，按 item_type 决定写哪个
4. **配置层扩展现有 standard_item**：不新建 item_cfg 表，避免配置漂移
5. **全量迁移 + 旧表只读**：历史数据完整迁入新表，旧表保留做备份，可回滚
6. **双写过渡**：阶段1双写保证增量数据不丢，阶段3切流量后才停旧表写

## 七、验收标准

### 阶段1验收
- [ ] standard_item 5 字段已加，item_type 全部有值
- [ ] qc_inspection_item、qc_inspection_sample_value 表已建
- [ ] models/index.ts 关联定义完成
- [ ] 三 controller 双写逻辑生效，新建检验单新旧子表都有数据

### 阶段2验收
- [ ] 数据库全量备份完成
- [ ] 三旧子表 count = 新子表按 source_type count
- [ ] 抽检 10 条数据字段无丢失
- [ ] sample_value 行数 = 解析成功的 actual_value 数

### 阶段3验收
- [ ] 三 controller item 查询走新子表
- [ ] SampleValueController 接口可用
- [ ] 自动判定逻辑生效
- [ ] 旧子表停止写入
- [ ] 单元测试通过

### 阶段4验收
- [ ] InspectionItemEditor 组件三类型渲染正确
- [ ] 三页面录入走新组件
- [ ] 历史数据展示兼容
- [ ] 自动判定红绿提示正确

### 阶段5验收
- [ ] 旧子表已重命名 _deprecated
- [ ] controller 无旧子表引用
- [ ] 旧子表模型文件已删
- [ ] seed.ts 指向新表
- [ ] README 更新

## 八、估算

| 阶段 | 任务数 | 难度 | 是否阻塞生产 |
|------|--------|------|--------------|
| 阶段1 | 7 | 低 | 否（双写不影响读） |
| 阶段2 | 7 | 中 | 是（需停机窗口跑迁移） |
| 阶段3 | 8 | 中 | 否（切流量可灰度） |
| 阶段4 | 9 | 低 | 否（前端独立开发） |
| 阶段5 | 5 | 低 | 否（旧表保留30天） |

**总计**：36 个任务，5 个阶段，建议阶段1-2 连续做，阶段3 单独立项，阶段4-5 跟随。
