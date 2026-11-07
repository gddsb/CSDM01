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
    // 从 req.user 读 auth 中间件注入的用户信息
    const user = (req as any).user
    const permV2: any = (req as any).permV2 ?? {}
    logger.info(`[DataScope] CALLED path=${req.path} user=${!!user} username=${user?.username}`)

    if (!user) {
      logger.warn('[DataScope] req.user 不存在')
      return next()
    }

    try {
      // 有 '*' 通配符 → 不过滤
      if (user.permCodes?.has('*')) {
        permV2.scopeWhere = {}
        ;(req as any).permV2 = permV2
        return next()
      }

      const where = await buildDataScopeWhere(
        user.userId,
        user.roleId ?? null,
        businessObj,
        user.username ?? ''
      )

      permV2.scopeWhere = where
      ;(req as any).permV2 = permV2
      logger.info(`[DataScope] obj=${businessObj} where=${JSON.stringify(where).slice(0, 200)}`)
      next()
    } catch (err) {
      logger.error('[DataScope] error:', err)
      next()
    }
  }
}

type RequestHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>
