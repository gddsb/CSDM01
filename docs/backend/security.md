# docs/backend/security.md — 安全规则

> 写鉴权、限流、上传文件、SQL 拼接时读这份。

## 强约束

| # | 约束 |
|---|------|
| S1 | **所有写操作必 Sequelize 参数化查询 / 字段白名单** —— 防 SQL 注入 + Mass Assignment |
| S2 | **限流配置在 `middleware/security.ts`** —— 全局 1000 req/min，登录 30 req/min，按用户名/IP 生成 key。批量压测触发 429 时，**按需调整数值，不要直接关闭限流** |
| S3 | **上传目录 `server/uploads/` 不入 git** |
| S4 | **数据库 `*.sqlite` 不入 git** |

## 认证与权限中间件
- 新增接口默认走 `authRequired`
- 细粒度权限追加 `permissionRequired('xxx:yyy')`
- 超级管理员/系统管理员由中间件自动放行，**业务代码里不要再判断角色名**
