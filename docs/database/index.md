# docs/database/index.md — 数据库 & 迁移

> 加字段、改表结构、写 SQL、加外键时读这份。

## 强约束

| # | 约束 | 原因 |
|---|------|------|
| D1 | **关联料品的外键必须 `CHAR(36) COLLATE utf8mb4_bin`** | 关联 `bas_material.material_id` 的所有外键（如 `production_process_material.bas_material_id`），**不要用 INT** |
| D2 | **迁移文件命名 `NNN-description.sql`** | 按顺序编号，由 `migration_version` 表记录已执行版本，启动时 `migrate.ts` 按需执行（只增不删） |
| D3 | **新增外键前必须核查无孤儿数据** | 004-add-core-foreign-keys.sql 已踩过坑 |
| D4 | **`ensurePerformanceIndexes` 幂等** | 可按需追加性能索引，不会重复建 |

## 已有迁移
- 002: 料品外键
- 003: 性能索引
- 004: 核心外键

## 模型清单（78 个，关键字段类型）

常用模型关键列类型参考（加新表时照抄）：
- 主外键：全用 `CHAR(36) COLLATE utf8mb4_bin`（UUID）
- 时间：全用 `DATETIME`（不是 TIMESTAMP，TIMESTAMP MySQL 会自动做时区转换）
- 状态数字：`INTEGER`

## SQLite 切换
```
server/.env:
  DB_DIALECT=sqlite
  DB_STORAGE=./data/milk_can_mes.sqlite
然后 pnpm seed 初始化数据
```

## 子文件
| 要做什么 | 读哪份 |
|---------|--------|
| 碰时间字段/时区 | timezone.md |
