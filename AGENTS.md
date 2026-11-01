# AGENTS.md — 奶粉罐生产管理系统 (Milk Can MES)

## 项目概览

东莞市大满包装实业有限公司长沙分公司的**奶粉罐生产制造执行系统（MES）**，覆盖基础数据、生产订单、报工、质量检验、设备管理、数据大屏、报表中心、移动端报工等完整业务链条。PC 端管理 + 移动端现场执行双端协同。

- **架构**：前后端分离，Vite 开发服务器代理 `/api` 到 Express 后端
- **前端**：React 18 + TypeScript 5 + Vite 5 + Ant Design 5 + Ant Design Mobile 5 + ECharts 6 + React Router 6
- **后端**：Node.js + Express 4 + TypeScript（tsx 直接运行）+ Sequelize 6 + JWT + bcryptjs
- **数据库**：MySQL 8.0（沙箱已预装 `milk_can_mes` 库）；ORM 为 Sequelize，也兼容 SQLite
- **包管理器**：**pnpm**（前后端各自独立 package.json）

> **沙箱 MySQL 启动**：容器无 systemd，若 MySQL 未运行，需手动启动：
> ```bash
> mkdir -p /var/run/mysqld && chown mysql:mysql /var/run/mysqld
> nohup mysqld --user=mysql --datadir=/var/lib/mysql \
>   --socket=/var/run/mysqld/mysqld.sock --port=3306 --bind-address=0.0.0.0 \
>   > /app/work/logs/bypass/mysql.log 2>&1 &
> ```
> 连接：`mysql -uroot -p123456`，数据库 `milk_can_mes`。

## 目录结构

```
.
├── index.html                 # Vite 入口 HTML
├── vite.config.ts             # Vite 配置（端口、/api 代理到 3001）
├── package.json               # 前端依赖与脚本
├── src/                       # 前端源码
│   ├── main.tsx               # 前端入口（路由、主题、Provider）
│   ├── layouts/MainLayout.tsx # PC 端主布局（侧边菜单/顶栏）
│   ├── contexts/AppContext.tsx# 全局状态（用户、主题、菜单权限）
│   ├── utils/api.ts           # axios 封装（统一前缀 /api、鉴权、参数处理）
│   ├── themes/index.ts        # 六套主题配色（CSS Variables）
│   ├── styles/                # global.css、bigscreen.css
│   ├── pages/                 # PC 端页面
│   │   ├── Login.tsx, Dashboard.tsx
│   │   ├── basic/             # 基础数据：料品/客户/供应商/产线/工序/设备/不良/编号规则
│   │   ├── production/        # 生产：订单管理、工序报工（已拆分，见下）
│   │   │   ├── ProcessReporting.tsx    # 报工主页（页面编排）
│   │   │   ├── OrderManagement.tsx
│   │   │   ├── sections/      # 展示组件：ProcessTabContent/ReportStatsBar/CreateReportModal/ImageDrawer
│   │   │   ├── hooks/useReportDetailRecords.ts # 5 类明细（不良/报废/物料/异常/人员）的状态与 CRUD
│   │   │   ├── processColumns.tsx / exceptionColumns.tsx / manpowerColumns.tsx
│   │   │   ├── order/columns.tsx
│   │   │   └── reportStats.ts / types.ts / constants.ts
│   │   ├── quality/           # 质量：来料/成品/微生物/过程检验、检验标准、投诉
│   │   ├── device/            # 设备：点检、维修、OEE
│   │   ├── report/            # 报表：生产/质量/异常/效率/日报/月报
│   │   ├── bigscreen/         # 数据大屏：生产/质量/管理/环境/展示
│   │   │   └── shared/        # 大屏共享层：useECharts hook（init/resize/dispose）、constants、工具
│   │   ├── auto/              # 自动化任务（ERP/IoT 同步）
│   │   └── system/            # 系统管理：用户/角色/菜单/字典/配置/日志
│   │       ├── SystemConfig.tsx
│   │       └── config-tabs/   # ParamsTab/EnvTab/DbTab/BackupTab/FilesTab + types/format/configTransform/fileColumns
│   ├── mobile/                # 移动端（独立布局与路由）
│   │   ├── MobileLayout.tsx, MobileRoutes.tsx
│   │   └── pages/             # 移动首页、登录、报工、订单、个人中心、移动大屏
│   │       └── production/components/  # DefectTab/ScrapTab/MaterialTab/ExceptionTab/ManpowerTab/ImageManagerModal/DefectSelect/shared
│   └── mock/data.ts           # 前端 Mock 数据（大屏等）
└── server/                    # 后端源码
    ├── .env                   # 后端环境变量（端口、数据库、JWT）
    ├── package.json           # 后端依赖与脚本
    └── src/
        ├── app.ts             # Express 入口（中间件、初始化、静态服务、代理）
        ├── config/database.ts # Sequelize 配置（sqlite/mysql 切换）
        ├── models/            # Sequelize 模型
        ├── controllers/       # HTTP 控制器（保持轻量，业务逻辑下沉到 services/modules）
        ├── modules/           # 按领域拆分的子控制器（从巨型控制器抽离）
        │   ├── system-config/ # EnvironmentController、DatabaseController
        │   └── auto/          # DashboardController（看板/环境聚合）、SyncTaskController（主数据/订单同步）
        ├── routes/            # 路由：auth/system/basic/production/auto
        ├── middleware/        # auth.ts（JWT+权限+操作日志，超级管理员通配放行）、security.ts（Helmet/CORS/限流）
        ├── services/          # 业务服务层
        │   ├── ProductionWorkflowService.ts # 订单/报工单状态机（下发/开工/完工/关闭/校验/事务联动）
        │   ├── AuthService.ts # 认证服务（含 *.test.ts 单元测试）
        │   ├── taskScheduler.ts / taskExecutor.ts
        │   └── 采集相关：envCollector / weatherCollector / energyMeterCollector / u9Login / u9Exporter
        ├── migrations/        # SQL 迁移（002 料品 FK、003 性能索引、004 核心外键），由 migration_version 表记录版本
        ├── utils/             # jwt/response/sequence/statusMap/crypto/date/controller（模块共享工具）
        ├── seed.ts            # 种子数据脚本（pnpm seed）
        ├── seed-mock.ts       # Mock 数据脚本
        ├── seed-data/         # 种子数据 JSON（料品/订单/检验等）
        ├── migrate.ts         # 迁移入口（启动时自动跑 SQL 迁移 + ensurePerformanceIndexes 幂等建索引）
        └── uploads/           # 上传文件（avatars/defects/reports 等）
```

## 构建与运行

### 沙箱启动（.coze 已配置，自动完成）
- 后端：`cd server && pnpm start`（tsx 直接运行 src/app.ts，监听 3001）
- 前端：`node_modules/.bin/vite --host 0.0.0.0 --port ${DEPLOY_RUN_PORT}`（主仓 5000）
- Vite 代理 `/api` 与 `/uploads` 到 `http://localhost:3001`

### 常用命令
```bash
# 前端
pnpm install              # 安装前端依赖
pnpm run dev              # 前端开发（默认 5173，沙箱用 --port 覆盖）
pnpm run build            # 前端生产构建（先 pnpm typecheck 再 vite build，类型错误必须清零）
pnpm run typecheck        # tsc --noEmit 类型检查

# 后端（在 server/ 目录）
pnpm install              # 安装后端依赖
pnpm start                # 启动后端（tsx src/app.ts）
pnpm run dev              # 后端热重载（tsx watch）
pnpm seed                 # 初始化种子数据（用户/角色/料品/订单等演示数据）
pnpm run typecheck        # 后端类型检查
```

### 数据库
- 沙箱使用本地 **MySQL 8.0**：`server/.env` 中 `DB_DIALECT=mysql`，`DB_HOST=127.0.0.1`，`DB_PORT=3306`，`DB_NAME=milk_can_mes`，`DB_USER=root`，`DB_PASSWORD=123456`
- 沙箱 MySQL 已预装 `milk_can_mes` 库（49 张表，含用户/角色/544 料品/200 订单等演示数据），**无需再执行 seed**；新环境可通过 `server/src/seed.ts` 初始化
- 后端启动自动 `sequelize.sync()` + `runMigrations()` 补齐表结构（只增不删）
- SQL 迁移位于 `server/src/migrations/`，由 `migration_version` 表记录已执行版本；`004-add-core-foreign-keys.sql` 已补齐核心外键
- 生产订单/报工单状态流转统一走 `server/src/services/ProductionWorkflowService.ts`（下发、关闭、完工、报工单完工校验与订单联动）
- 切换为 SQLite：将 `DB_DIALECT` 改为 `sqlite` 并设 `DB_STORAGE=./data/milk_can_mes.sqlite`，再 `pnpm seed` 初始化数据

## 默认登录账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 超级管理员 | admin | 123456 |
| 系统管理员 | sysadmin | 123456 |
| 计划员 | planner | 123456 |
| 质量管理员 | qm | 123456 |
| 质量检验员 | qc | 123456 |
| 生产管理 | pm | 123456 |
| 工序操作人 | op | 123456 |
| 设备维护员 | maint | 123456 |
| 看板查看者 | viewer | 123456 |

## 后端接口约定

- 统一前缀 `/api`，路由分组：
  - `/api/auth/*`：登录(login)、当前用户(profile)、登出(logout)
  - `/api/basic/*`：基础数据（料品/客户/供应商/产线/工序/设备/不良类型/编号规则/人力/线体关系）
  - `/api/production/*`：生产订单、报工单、工序不良/物料/异常
  - `/api/system/*`：用户/角色/权限/菜单/字典/配置/日志
  - `/api/auto/*`：自动化任务设置、调度日志、看板聚合（dashboard）、同步任务（sync）
- 统一响应格式：`{ success: boolean, code: number, message: string, data?, total? }`
- **鉴权**：除 `/api/auth/login` 外所有接口需请求头 `Authorization: Bearer <token>`，JWT 有效期 2h，刷新令牌 7d；超级管理员/系统管理员在 `perm_codes` 中自动写入 `*`，权限校验中间件对 `*` 直接放行
- 分页参数：`page` / `pageSize`（pageSize 上限 200），响应在 `total` 字段返回总数
- 状态字段：后端多存数字，前端 `utils/api.ts` 做中文状态名到数字的转换（开立/下发/开工/完工/关闭等）
- **限流**：`middleware/security.ts` 中配置 express-rate-limit，全局限流 1000 req/min、登录 30 req/min；按用户名（已登录）或真实 IP 生成 key，避免正常页面切换触发 429

## 前端开发要点

- API 调用统一走 `src/utils/api.ts`，已封装 baseURL `/api`、token 注入、中文参数 encode、状态码转换
- 主题系统基于 CSS Variables，见 `src/themes/index.ts`（六套主题）；切换主题由 AppContext 管理
- 权限控制：登录后 `user.perm_codes` 为权限码列表（如 `basic:material`），超级管理员/系统管理员包含 `*`；菜单与按钮据此显隐
- 移动端使用 `antd-mobile` + `antd-mobile-icons`，独立于 PC 端路由；报工详情已拆到 `mobile/pages/production/components/`（DefectTab/MaterialTab/ScrapTab/ExceptionTab/ManpowerTab/ImageManagerModal/DefectSelect）
- 大屏页面使用 ECharts，样式见 `src/styles/bigscreen.css`；`useBigScreenScale` hook 做等比缩放；**ECharts 实例统一通过 `src/pages/bigscreen/shared/useECharts.ts` 创建与销毁**（init/resize/dispose），配色常量从 `shared/constants.ts` 引入
- 报工页面（`pages/production/ProcessReporting.tsx`）已完成拆分：明细状态与 CRUD 在 `hooks/useReportDetailRecords.ts`，列定义在独立文件，弹窗/统计条/图片抽屉在 `sections/`；新增功能优先在对应子文件扩展，避免主文件再次膨胀
- 系统配置页（`pages/system/SystemConfig.tsx`）各 Tab 已拆到 `config-tabs/`，新增 Tab 在此目录新增组件并在主文件挂载
- 报表导出使用 `xlsx`；文档生成使用 `docx` / `html-docx-js-typescript`
- **类型与构建**：本项目是纯 CSR（Vite SPA），无 SSR hydration 问题；所有函数参数需标注类型，标点用半角；`pnpm build` 会先执行 `tsc --noEmit`，提交前务必保证类型零错误

## 后端开发要点

- **分层约定**：Controller 只处理 HTTP（参数解析、响应、状态码），业务逻辑放到 `services/`；可复用的跨控制器业务（如订单/报工状态流转）必须走 `ProductionWorkflowService`，不要在控制器里直接操作多张表
- **巨型控制器拆分**：单文件超过 ~1000 行时，按领域拆到 `server/src/modules/<domain>/`，主控制器只保留路由编排；模块内共享工具放 `server/src/utils/controller.ts`
- **数据库迁移**：
  - 表结构变更通过 `server/src/migrations/` 下的 SQL 文件管理，命名 `NNN-description.sql`，由 `migration_version` 表记录已执行版本，启动时 `migrate.ts` 按需执行（只增不删）
  - 已有 002（料品外键）、003（性能索引）、004（核心外键）；新增外键前必须先核查无孤儿数据
  - `ensurePerformanceIndexes` 用于幂等创建性能索引，可按需追加
- **字段类型一致**：关联到 `bas_material.material_id` 的外键必须使用 `CHAR(36) COLLATE utf8mb4_bin`（如 `production_process_material.bas_material_id`），不要使用 INT
- **时间统一**：所有系统时间使用 `utils/date.ts` 的北京时间工具（`nowBeijingDate` / `formatDateTime` 等），禁止直接 `new Date()` 或 `toISOString()` 落库
- **认证与权限**：新增接口默认走 `authRequired`；需要细粒度权限时追加 `permissionRequired('xxx:yyy')`；超级管理员/系统管理员由中间件自动放行，不要在业务里再判断角色名
- **安全**：所有写操作使用 Sequelize 参数化查询/字段白名单，避免 SQL 注入与 Mass Assignment；分页 `pageSize` 必须经过 `parsePagination`（上限 200）

## 注意事项

- 前端 `package.json` 的 `dev` 脚本硬编码了 `--port 5173`；沙箱需通过 `.coze` 直接调用 `node_modules/.bin/vite --port ${DEPLOY_RUN_PORT}`，**不要**用 `pnpm run dev` 再叠加 `--port`（会被脚本内默认值抢占）
- 前端 `build` 脚本为 `tsc --noEmit && vite build`，任何类型错误都会导致构建失败，不要为了绕过而删除该前置步骤
- `.coze` 使用标准 TOML 数组语法（`["bash", "-c", "..."]`），修改时谨防引号嵌套造成 `Unclosed array` 解析错误
- `antd-mobile-icons` 是实际使用的依赖（报工等移动端页面），需在 `package.json` 中声明
- 上传文件目录 `server/uploads/` 不入 git；数据库 `*.sqlite` 不入 git
- 生产环境若用 MySQL，需在 `server/.env` 配置 DB_HOST/PORT/NAME/USER/PASSWORD
- 全局限流默认 1000 req/min，若做批量接口压测触发 429，在 `middleware/security.ts` 内按需调整，不要直接关闭限流
