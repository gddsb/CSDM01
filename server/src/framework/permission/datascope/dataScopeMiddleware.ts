/**
 * 权限引擎 V2 — 数据权限 Express 中间件 + Sequelize Hook 拦截器
 *
 * 用法：
 *
 *   // 方式 A：Express 中间件（推荐，在 Controller 手动传入 where）
 *   router.get('/orders', requirePerm('production:order:view'), dataScope({ businessObj: 'production_order' }), controller.list)
 *
 *   // 在 Controller 里：
 *   async list(req, res) {
 *     const where = req.permV2?.scopeWhere  // ← 中间件注入的 Sequelize where 对象
 *     const list = await ProductionOrder.findAll({ where: { ...查询条件, ...where } })
 *   }
 *
 *   // 方式 B：Sequelize Hook（全局拦截 Model 查询）
 *   import { installSequelizeHook } from './sequelizeInterceptor.js'
 *   installSequelizeHook(sequelize)  // 对特定 Model 自动注入 WHERE
 *
 * 推荐用方式 A — 显式、可调试、不侵入 Sequelize 全局行为
 */

import type { Request, Response, NextFunction } from 'express'
import { buildDataScopeWhere } from './ruleEngine.js'
import { logger } from '../../../utils/logger.js'
import type { DataScopeOptions } from '../types.js'

export function dataScope(options: DataScopeOptions): RequestHandler {
  const { businessObj } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    const ctx = req.permV2
    if (!ctx) {
      // 还没经过 auth 层 — 跳过
      logger.debug('[DataScope] req.permV2 不存在，跳过')
      return next()
    }

    try {
      // 有 '*' 通配符 → 不过滤
      if (ctx.permCodes.has('*')) {
        ctx.scopeWhere = {}
        return next()
      }

      const permCode = (req as any)._permCodeForScope || undefined
      const where = await buildDataScopeWhere(
        ctx.userId,
        ctx.roleId,
        businessObj,
        ctx.username,
        permCode
      )

      ctx.scopeWhere = where
      logger.debug(`[DataScope] obj=${businessObj} user=${ctx.userId} where=${JSON.stringify(where).slice(0, 200)}`)
      next()
    } catch (err) {
      logger.error('[DataScope] 执行异常:', err)
      next() // 数据权限异常不阻断业务
    }
  }
}

type RequestHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>
