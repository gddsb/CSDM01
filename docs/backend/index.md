# docs/backend/index.md — 后端开发规则

> **后端任务默认必读**：改 Node/Express/Sequelize/service/controller 时必读。

## 强约束

| # | 约束 | 原因 |
|---|------|------|
| B1 | **分层** — Controller 只处理 HTTP（参数解析/响应/状态码），业务逻辑必须下沉 `services/` | 控制器保持轻量，业务可复用可测 |
| B2 | **跨控制器复用的业务必须走 `ProductionWorkflowService`** | 订单/报工单状态流转（下发/开工/完工/关闭/校验/事务联动）不要在 controller 里直接操作多张表 |
| B3 | **巨型控制器拆分阈值 ~1000 行** | 按领域拆到 `server/src/modules/<domain>/`，主控制器只保留路由编排；模块共享工具放 `server/src/utils/controller.ts` |
| B4 | **分页 pageSize 上限 200** | 必须经 `parsePagination` |
| B5 | **写操作必字段白名单** | Sequelize create/update 时明确列名，防 Mass Assignment |
| B6 | **业务代码里不要再判断角色名** | 超级管理员/系统管理员由中间件自动放行，权限校验让中间件处理 |

## 时间统一
所有系统时间走 `utils/date.ts`（`nowBeijingDate` / `formatDateTime`），禁止直接 `new Date()` 或 `toISOString()` 落库。
⚠️ 详见 database/timezone.md。

## 自动初始化
启动时 sequelize.sync() + runMigrations() 自动补齐表结构（只增不删）。

## 子文件索引
| 要做什么 | 读哪份 |
|---------|--------|
| 写接口/调接口格式 | api-contract.md |
| 写鉴权/限流/上传 | security.md |
| 加字段/改表 | ../database/index.md |
| 碰时间/时区 | ../database/timezone.md |
