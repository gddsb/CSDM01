/**
 * 权限引擎 V2 — 数据权限 Express 中间件
 *
 * 挂载方式：
 *   router.get('/report-orders', permissionRequired('production:reporting'),
 *              dataScope({ businessObj: 'production_report_order' }),
 *              controller.list)
 *
 * 在 Controller 里读：
 *   const scopeWhere = (req as any).permV2?.scopeWhere
 *   const result = await Service.list(req.query, scopeWhere)
 *
 * 关键修复（Phase 4.1）：
 *   - 从 req.user（auth middleware 注入）读用户信息，不是 req.permV2
 *   - 把 roleCode 传给 ruleEngine，避免重复查 DB
 *   - 完整异常日志，吞错不阻断业务
 */

import type { Request, Response, NextFunction } from 'express'
import { buildDataScopeWhere } from './ruleEngine.js'
import { logger } from '../../../utils/logger.js'
import type { DataScopeOptions } from '../types.js'

export function dataScope(options: DataScopeOptions): RequestHandler {
  const { businessObj } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    // 从 req.user 读 auth middleware 注入的用户信息（req.user = { userId, username, roleId, roleCode, permCodes, terminal }）
    const user = (req as any).user
    const permV2: any = (req as any).permV2 ?? {}

    logger.info(
      `[DataScope] CALLED path=${req.path} businessObj=${businessObj} ` +
      `user=${!!user} username=${user?.username} roleId=${user?.roleId} roleCode=${user?.roleCode}`
    )

    // 没经过 auth middleware（理论上不会，因为路由前挂了 authRequired）
    if (!user) {
      logger.warn('[DataScope] req.user 不存在（跳过，全量可见）')
      permV2.scopeWhere = {}
      ;(req as any).permV2 = permV2
      return next()
    }

    try {
      // 超级管理员通配符 → 不过滤
      if (user.permCodes?.has('*')) {
        logger.info(`[DataScope] WILDCARD (*) → empty where (all data)`)
        permV2.scopeWhere = {}
        ;(req as any).permV2 = permV2
        return next()
      }

      // 调用规则引擎构建 where 条件
      const where = await buildDataScopeWhere({
        userId: user.userId,
        roleId: user.roleId ?? null,
        roleCode: user.roleCode ?? null,  // ← 直接传，避免 ruleEngine 重复查 DB
        businessObj,
        username: user.username ?? '',
        requestPermCode: (req as any)._permCodeForScope,
      })

      permV2.scopeWhere = where
      ;(req as any).permV2 = permV2

      const kw = Object.keys(where).length > 0 ? JSON.stringify(where) : '{} (full access)'
      logger.info(`[DataScope] obj=${businessObj} where=${kw}`)
      next()
    } catch (err: any) {
      // 数据权限异常不阻断业务，scopeWhere=undefined → Service.list 收到 undefined → 不 merge → 全量
      // 这里把 scopeWhere 显式设为 {} 更安全（Sequelize 空 where = 全量）
      logger.error(`[DataScope] ERROR obj=${businessObj} path=${req.path}: ${err?.message || err}`, err?.stack ? { stack: err.stack } : undefined)
      permV2.scopeWhere = {}
      ;(req as any).permV2 = permV2
      next()
    }
  }
}

type RequestHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>
