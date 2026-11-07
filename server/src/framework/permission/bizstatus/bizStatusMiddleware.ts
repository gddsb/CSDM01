/**
 * 权限引擎 V2 — 业务状态校验 Express 中间件
 *
 * 替代 @BizStatusCheck(businessObj="xxx", operateKey="xxx") 注解
 *
 * 用法：
 *   router.post('/orders/:id/start',
 *     requirePerm('production:order:start'),
 *     bizStatusCheck({ businessObj: 'production_order', operateKey: 'start', idField: 'id' }),
 *     controller.start
 *   )
 *
 * 校验逻辑：
 *   1. 从 URL param / body / query 取单据 ID（默认 params.id）
 *   2. 根据 businessObj 找对应的 Model 查当前单据的 status 字段
 *   3. 查 sys_biz_status_rule 拿 operateKey 对应的 allowed_states
 *   4. 当前 status 不在 allowed_states → 返回 400
 *
 * 当前 Model 映射（简化实现，后续可扩展）：
 *   production_order → ProductionOrder
 *   process_report   → ProcessReport / production_process_record
 *   device_fault     → DeviceFault
 *   device_maintenance → DeviceMaintenanceProfile
 *   quality_inspection → QualityInspectionRecord
 */

import type { Request, Response, NextFunction } from 'express'
import { fail, ErrorCode } from '../../../utils/response.js'
import { getAllowedStates, getBizStatusRule } from './ruleEngine.js'
import { logger } from '../../../utils/logger.js'
import * as Models from '../../../models/index.js'
import type { BizStatusCheckOptions } from '../types.js'

/** obj_code → Sequelize Model 映射 */
const OBJ_MODEL_MAP: Record<string, any> = {
  production_order: Models.U9ProductionOrder ?? Models.Order,
  process_report: Models.ReportOrder,
  device_fault: Models.DeviceFault,
  device_maintenance: Models.DeviceMaintenanceProfile,
  device_inspection: null,
  device_calibration: null,
  device_spare_part: null,
  quality_inspection: null,
  quality_complaint: null,
}

/** 状态字段名（大多数业务表是 status，少数可能是 state） */
const STATUS_FIELD_BY_OBJ: Record<string, string> = {
  production_order: 'status',
  process_report: 'status',
  device_fault: 'status',
  device_maintenance: 'status',
}

export function bizStatusCheck(options: BizStatusCheckOptions): RequestHandler {
  const { businessObj, operateKey, idField = 'id', idSource = 'params' } = options

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. 取单据 ID
      const rawId = idSource === 'params'
        ? (req.params as any)[idField]
        : idSource === 'body'
          ? (req.body as any)[idField]
          : (req.query as any)[idField]

      if (!rawId) {
        logger.warn(`[BizStatusCheck] 未找到单据 ID (obj=${businessObj}, op=${operateKey})`)
        fail(res, '缺少单据 ID', ErrorCode.PARAM_INVALID)
        return
      }

      const docId = Number(rawId) || rawId

      // 2. 查规则
      const rule = await getBizStatusRule(businessObj, operateKey)
      if (!rule) {
        // 没配规则 → 跳过校验
        next()
        return
      }

      // 3. 查单据当前状态
      const Model = OBJ_MODEL_MAP[businessObj]
      if (!Model) {
        // 没映射的 Model — 跳过（后续接入时补映射）
        logger.debug(`[BizStatusCheck] obj_code=${businessObj} 未映射 Model，跳过`)
        next()
        return
      }

      const statusField = STATUS_FIELD_BY_OBJ[businessObj] || 'status'
      const doc = await Model.findByPk(docId, { attributes: [statusField] })

      if (!doc) {
        fail(res, '单据不存在', ErrorCode.RECORD_NOT_FOUND)
        return
      }

      const currentStatus = (doc as any)[statusField]
      const allowed = await getAllowedStates(businessObj, operateKey)

      if (!allowed || allowed.length === 0) {
        // 没配 allowed_states → 不限制
        next()
        return
      }

      // 兼容：状态可能是 number（数据库存的），allowed_states 可能是 string
      const currentStr = String(currentStatus)
      const allowedMatch = allowed.some(a => String(a) === currentStr)

      if (!allowedMatch) {
        const msg = rule.error_message
          || `当前状态「${currentStatus}」不允许执行「${rule.operate_name || operateKey}」操作，允许状态: ${allowed.join('/')}`
        logger.warn(`[BizStatusCheck] 拦截: obj=${businessObj} docId=${docId} current=${currentStatus} op=${operateKey} allowed=${allowed.join(',')}`)
        fail(res, msg, ErrorCode.PARAM_INVALID)
        return
      }

      // 校验通过
      logger.debug(`[BizStatusCheck] 通过: obj=${businessObj} docId=${docId} current=${currentStatus} op=${operateKey}`)
      next()
    } catch (err) {
      logger.error('[BizStatusCheck] 执行异常:', err)
      next() // 校验异常不阻断（让业务自己处理）
    }
  }
}

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>
