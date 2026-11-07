/**
 * 权限引擎 V2 — 业务状态规则引擎
 *
 * 职责：
 *   根据 obj_code + operate_key 查询 sys_biz_status_rule 表
 *   返回该操作允许的状态值列表 allowed_states（JSON 数组）
 *   供 @BizStatusCheck 中间件或业务 Service 使用
 *
 * 数据模型：
 *   一条规则 = { obj_code, operate_key } → { allowed_states: [...] }
 *   示例：production_order + start → allowed_states = ['开立', '下发']
 *
 * 缓存策略：
 *   bizRule:{obj_code}:{operateKey} TTL=2min
 */

import type { BizStatusRule, OperateKey, BusinessObjCode } from '../types.js'
import { getCache, setCache, TTL } from '../cache/permissionCache.js'
import { BizStatusRule as RuleModel } from '../../../models/index.js'
import logger from '../../../utils/logger.js'

function cacheKey(obj: string, op: string) {
  return `bizRule:${obj}:${op}`
}

/**
 * 查询某业务对象的某操作允许的状态值列表
 *
 * @param objCode      业务对象编码
 * @param operateKey   操作键（如 start/finish/close/submit_repair）
 * @returns allowed_states 数组（可能是 string[] 或 number[]），无规则返回 null 表示"不限制"
 */
export async function getAllowedStates(
  objCode: BusinessObjCode,
  operateKey: OperateKey
): Promise<any[] | null> {
  const cached = getCache<BizStatusRule>(cacheKey(objCode, operateKey))
  if (cached) {
    return parseAllowed(cached.allowed_states)
  }

  const rule = await RuleModel.findOne({
    where: { obj_code: objCode, operate_key: operateKey, status: 1 },
  })

  if (!rule) {
    // 没配规则 — 返回 null 表示不限制（让业务自由判断）
    return null
  }

  const raw = rule.toJSON() as any
  const bizRule: BizStatusRule = {
    rule_id: raw.rule_id,
    obj_code: raw.obj_code,
    operate_key: raw.operate_key,
    operate_name: raw.operate_name,
    allowed_states: raw.allowed_states,
    next_state: raw.next_state,
    perm_code: raw.perm_code,
    error_message: raw.error_message,
  }

  setCache(cacheKey(objCode, operateKey), bizRule, TTL.bizRule)
  return parseAllowed(bizRule.allowed_states)
}

/** 取完整规则（含 error_message / next_state / perm_code 等） */
export async function getBizStatusRule(
  objCode: BusinessObjCode,
  operateKey: OperateKey
): Promise<BizStatusRule | null> {
  const cached = getCache<BizStatusRule>(cacheKey(objCode, operateKey))
  if (cached) return cached

  const rule = await RuleModel.findOne({
    where: { obj_code: objCode, operate_key: operateKey, status: 1 },
  })

  if (!rule) return null

  const raw = rule.toJSON() as any
  const bizRule: BizStatusRule = {
    rule_id: raw.rule_id,
    obj_code: raw.obj_code,
    operate_key: raw.operate_key,
    operate_name: raw.operate_name,
    allowed_states: raw.allowed_states,
    next_state: raw.next_state,
    perm_code: raw.perm_code,
    error_message: raw.error_message,
  }
  setCache(cacheKey(objCode, operateKey), bizRule, TTL.bizRule)
  return bizRule
}

function parseAllowed(jsonStr: string): any[] | null {
  if (!jsonStr) return null
  try {
    const arr = JSON.parse(jsonStr)
    return Array.isArray(arr) ? arr : null
  } catch {
    logger.warn(`[BizStatus] allowed_states JSON 解析失败: ${jsonStr}`)
    return null
  }
}
