# docs/index.md — 项目全景补充

> 入口在 AGENTS.md，本文件放目录结构、权限模型等"偶尔查一下"的内容。

## 目录结构（按业务域）

```
src/
├── main.tsx                     前端入口（路由/主题/Provider）
├── layouts/MainLayout.tsx       PC 主布局
├── contexts/AppContext.tsx      全局状态（用户/主题/菜单权限）
├── utils/api.ts                 ⚠️ axios 统一封装（所有前端 API 走这里）
├── themes/index.ts              六套主题配色
├── styles/                      global.css / bigscreen.css
├── mock/data.ts                 前端 Mock（大屏等）
├── pages/
│   ├── Login.tsx / Dashboard.tsx
│   ├── basic/                   基础数据：料品/客户/供应商/产线/工序/设备/不良/编号规则
│   ├── production/
│   │   ├── ProcessReporting.tsx    报工主页（页面编排）
│   │   ├── OrderManagement.tsx
│   │   ├── sections/               展示组件：ProcessTabContent/ReportStatsBar/CreateReportModal/ImageDrawer
│   │   ├── hooks/useReportDetailRecords.ts  ⚠️ 5 类明细（不良/报废/物料/异常/人员）的状态与 CRUD
│   │   ├── processColumns.tsx / exceptionColumns.tsx / manpowerColumns.tsx
│   │   ├── order/columns.tsx
│   │   └── reportStats.ts / types.ts / constants.ts
│   ├── quality/                 质量：来料/成品/微生物/过程检验、检验标准、投诉
│   ├── device/                  设备：点检、维修、OEE
│   ├── report/                  报表：生产/质量/异常/效率/日报/月报
│   ├── bigscreen/               数据大屏（含 shared/useECharts hook、constants）
│   ├── auto/                    自动化任务（ERP/IoT 同步）
│   └── system/
│       ├── SystemConfig.tsx
│       └── config-tabs/             ParamsTab/EnvTab/DbTab/BackupTab/FilesTab + types/format/...
└── mobile/
    ├── MobileLayout.tsx / MobileRoutes.tsx
    └── pages/
        └── production/components/   DefectTab/ScrapTab/MaterialTab/ExceptionTab/ManpowerTab/ImageManagerModal/DefectSelect/shared

server/src/
├── app.ts                       Express 入口（中间件/初始化/静态/代理）
├── config/database.ts           Sequelize 配置（含 timezone + Model.toJSON wall-time patch）
├── models/                      Sequelize 模型（78 个，见 database/index.md）
├── controllers/                 HTTP 控制器（保持轻量）
├── modules/
│   ├── system-config/           EnvironmentController / DatabaseController
│   └── auto/                    DashboardController / SyncTaskController
├── routes/                      auth / system / basic / production / auto
├── middleware/                   auth.ts（JWT+权限+操作日志）/ security.ts（Helmet/CORS/限流）
├── services/
│   ├── ProductionWorkflowService.ts  ⚠️ 订单/报工单状态机（下发/开工/完工/关闭/校验/事务联动）
│   ├── AuthService.ts
│   ├── taskScheduler.ts / taskExecutor.ts
│   └── 采集：envCollector / weatherCollector / energyMeterCollector / u9Login / u9Exporter
├── migrations/                  SQL 迁移 002/003/004，由 migration_version 表记录
├── utils/                       jwt/response/sequence/statusMap/crypto/date/controller
├── migrate.ts                   启动自动跑迁移 + ensurePerformanceIndexes 幂等建索引
└── uploads/                     上传文件（不入 git）
```

## 权限模型

| 用户 | perm_codes | 行为 |
|------|-----------|------|
| 超级管理员 / 系统管理员 | `*` | 中间件自动放行所有权限校验 |
| 其他角色 | 具体权限码（如 `basic:material`） | 按 `permissionRequired('xxx:yyy')` 校验 |

前端：`user.perm_codes` 驱动菜单/按钮显隐。后端：**业务代码里不要再判断角色名**，让中间件处理。

## 状态字段（前后端映射）

后端存数字，前端 `utils/api.ts` 做中文 ↔ 数字转换：
- 生产订单：开立 / 下发 / 开工 / 完工 / 关闭
- 报工单：同一套状态机，走 ProductionWorkflowService

## 种子数据（沙箱已装，一般不需要跑）
```bash
cd server && pnpm seed          # 初始化用户/角色/料品/订单等演示数据
# 沙箱已预装 49 张表 + 544 料品 + 200 订单，首次启动自动 sequelize.sync() + runMigrations()
```
