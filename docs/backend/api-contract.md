# docs/backend/api-contract.md — 后端接口约定

> 写 controller/service、前端调接口时读这份。

## 路由分组

| 前缀 | 说明 |
|------|------|
| `/api/auth/*` | 登录 login / 当前用户 profile / 登出 |
| `/api/basic/*` | 基础数据（料品/客户/供应商/产线/工序/设备/不良类型/编号规则/人力/线体关系） |
| `/api/production/*` | 生产订单/报工单/工序不良/物料/异常 |
| `/api/system/*` | 用户/角色/权限/菜单/字典/配置/日志 |
| `/api/auto/*` | 自动化任务设置/调度日志/看板聚合（dashboard）/同步任务（sync） |

## 统一响应格式
```json
{ "success": true, "code": 200, "message": "OK", "data": {}, "total": 100 }
```

## 鉴权
- 除 `/api/auth/login` 外全部需要请求头 `Authorization: Bearer <token>`
- JWT 有效期 2h，刷新令牌 7d
- 超级管理员/系统管理员的 `perm_codes` 自动写入 `*`，中间件对 `*` 直接放行

## 分页
- 参数：`page` / `pageSize`（**上限 200**）
- 响应：`total` 字段返回总数

## 状态字段
- 后端多存数字，前端 `utils/api.ts` 做中文 ↔ 数字转换（开立/下发/开工/完工/关闭等）

## 写操作必字段白名单
Sequelize create/update 时明确列名，不要用 `{ ...req.body }` 全量透传。
