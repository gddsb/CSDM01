/**
 * 权限引擎 V2 — 数据权限规则引擎
 *
 * Phase 4.1 关键修复：
 *   - buildDataScopeWhere 接收 roleCode 参数，避免重复查 DB
 *   - 完整 try-catch 容错，任何异常都返回 {}（全量），不阻断业务
 *   - translateRule 防御性检查：self_column_map 不存在、dim 为 null、scope_type 未知
 *   - 详细 DEBUG 日志，生产排障友好
 */

import type { ScopeType, DataScopeRule, DataDimension, BusinessObjCode } from '../types.js'
import { getCache, setCache, TTL } from '../cache/permissionCache.js'
import { DataScope, DataDimension as DataDimModel } from '../../../models/index.js'
import { Op } from 'sequelize'
import logger from '../../../utils/logger.js'

// ============================================================================
// 0. 类型定义（dataScopeMiddleware 传入的参数包）
// ============================================================================

export interface BuildDataScopeWhereInput {
  userId: number
  roleId: number | null
  /** auth middleware 注入的 role_code — 直接传，避免 ruleEngine 重复查 DB */
  roleCode: string | null
  businessObj: BusinessObjCode
  username: string
  /** 精确匹配 scope 规则里的 perm_code（可选） */
  requestPermCode?: string
}

// ============================================================================
// 1. 超级管理员短路角色
// ============================================================================

/** role_code 在此列表里的角色 → 不做任何数据过滤 */
const SHORT_CIRCUIT_ROLES = ['super_admin', 'admin', 'system_admin']

// ============================================================================
// 2. 加载维度字典（带缓存）— 用来把 dim_code 翻译成 SQL column
// ============================================================================

const CACHE_KEY_DIMS = 'dimDict'

function parseJSONMap(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

let _dimDictLoadErrorLogged = false

async function loadDimDict(): Promise<Map<string, DataDimension>> {
  const cached = getCache<Map<string, DataDimension>>(CACHE_KEY_DIMS)
  if (cached) return cached

  try {
    const rows = await DataDimModel.findAll({
      attributes: ['dim_id', 'dim_code', 'dim_name', 'target_table', 'target_column', 'column_map', 'self_column_map', 'data_type', 'description'],
      where: { status: 1 },
    })

    const map = new Map<string, DataDimension>()
    for (const row of rows) {
      const r = row.toJSON() as any
      map.set(r.dim_code, {
        dim_id: r.dim_id,
        dim_code: r.dim_code,
        dim_name: r.dim_name,
        target_table: r.target_table,
        target_column: r.target_column,
        column_map: parseJSONMap(r.column_map),
        self_column_map: parseJSONMap(r.self_column_map),
        data_type: r.data_type,
        description: r.description,
      })
    }

    setCache(CACHE_KEY_DIMS, map, TTL.dimDict)
    _dimDictLoadErrorLogged = false
    return map
  } catch (err: any) {
    if (!_dimDictLoadErrorLogged) {
      logger.error(`[DataScope] loadDimDict FAIL: ${err?.message || err}`, err?.stack ? { stack: err.stack } : undefined)
      _dimDictLoadErrorLogged = true
    }
    // 出错时返回空 Map，translateRule 会回退到默认列名
    return new Map()
  }
}

// ============================================================================
// 3. 加载用户 scope 规则（带缓存）
//    user_id 规则覆盖 role_id 规则（同一 obj_code）
// ============================================================================

let _scopeRulesLoadErrorLogged = false

async function loadUserScopeRules(userId: number, roleId: number | null): Promise<DataScopeRule[]> {
  const CACHE_KEY = `userScope:${userId}`
  const cached = getCache<DataScopeRule[]>(CACHE_KEY)
  if (cached) return cached

  try {
    const rules = await DataScope.findAll({
      where: {
        status: 1,
        [Op.or]: [
          { user_id: userId },
          roleId ? { role_id: roleId, user_id: null } : { role_id: null },
        ],
      },
      order: [['scope_id', 'ASC']],
    })

    const list: DataScopeRule[] = rules.map(r => {
      const raw = r.toJSON() as any
      return {
        scope_id: raw.scope_id,
        role_id: raw.role_id,
        user_id: raw.user_id,
        obj_code: raw.obj_code,
        scope_type: raw.scope_type as ScopeType,
        dim_code: raw.dim_code,
        operator: raw.operator,
        dim_value: raw.dim_value,
        perm_code: raw.perm_code,
      }
    })

    setCache(CACHE_KEY, list, TTL.userScope)
    _scopeRulesLoadErrorLogged = false
    return list
  } catch (err: any) {
    if (!_scopeRulesLoadErrorLogged) {
      logger.error(`[DataScope] loadUserScopeRules FAIL: ${err?.message || err}`, err?.stack ? { stack: err.stack } : undefined)
      _scopeRulesLoadErrorLogged = true
    }
    // 出错时返回空数组 → 会走到 NO RULES 分支 → return {}（全量）
    return []
  }
}

// ============================================================================
// 4. 主入口：构建业务对象的 Sequelize where 条件
// ============================================================================

export async function buildDataScopeWhere(input: BuildDataScopeWhereInput): Promise<Record<string, any>> {
  const { userId, roleId, roleCode, businessObj, username, requestPermCode } = input

  console.log(`[DataScope DEBUG] buildDataScopeWhere userId=${userId} roleId=${roleId} roleCode=${roleCode} obj=${businessObj} username=${username}`)

  // 4a. 超级管理员短路（从 auth middleware 直接传过来的 roleCode，避免重复查 DB）
  if (roleCode && SHORT_CIRCUIT_ROLES.includes(roleCode.toLowerCase())) {
    console.log(`[DataScope DEBUG] SHORT CIRCUIT for role_code=${roleCode}`)
    return {}
  }

  // 4b. 加载规则 + 维度字典（各自带 try-catch 容错）
  const [rules, dimDict] = await Promise.all([loadUserScopeRules(userId, roleId), loadDimDict()])
  console.log(`[DataScope DEBUG] rules loaded=${rules.length}, dimDict keys=${Array.from(dimDict.keys())}`)

  // 4c. user_id 独立规则覆盖 role_id（同一 obj_code）
  const userRules = rules.filter(r => r.user_id === userId && r.obj_code === businessObj)
  const roleRules  = rules.filter(r => r.role_id === roleId && r.user_id === null && r.obj_code === businessObj)
  console.log(`[DataScope DEBUG] obj=${businessObj}: userRules=${userRules.length}, roleRules=${roleRules.length}`)

  let objRules = userRules.length > 0 ? userRules : roleRules

  if (objRules.length === 0) {
    console.log(`[DataScope DEBUG] NO RULES for obj=${businessObj} → empty where (default all)`)
    return {}
  }

  // 4d. scope_type=all 直接跳过（全量）
  if (objRules.some(r => r.scope_type === 'all')) {
    console.log(`[DataScope DEBUG] scope_type=all → empty where`)
    return {}
  }

  // 4e. 如果有 perm_code 精确匹配，优先用
  if (requestPermCode) {
    const precise = objRules.filter(r => r.perm_code === requestPermCode)
    if (precise.length > 0) {
      objRules = precise
      console.log(`[DataScope DEBUG] filtered by requestPermCode=${requestPermCode} → ${objRules.length} rules`)
    }
  }

  // 4f. 翻译每条规则 → Sequelize where 片段
  const whereFragments: Record<string, any>[] = []
  for (const rule of objRules) {
    try {
      const frag = translateRule(rule, dimDict, businessObj, username)
      console.log(`[DataScope DEBUG] rule=${JSON.stringify(rule).slice(0, 120)} → frag=${JSON.stringify(frag)}`)
      if (frag) whereFragments.push(frag)
    } catch (err: any) {
      console.error(`[DataScope DEBUG] translateRule FAIL: ${err?.message || err}`)
      logger.error(`[DataScope] translateRule FAIL obj=${businessObj}: ${err?.message || err}`)
    }
  }

  if (whereFragments.length === 0) {
    console.log(`[DataScope DEBUG] ALL FRAGMENTS NULL → empty where`)
    return {}
  }
  if (whereFragments.length === 1) {
    console.log(`[DataScope DEBUG] SINGLE FRAGMENT → ${JSON.stringify(whereFragments[0])}`)
    return whereFragments[0]
  }

  // 多规则 AND 组合
  const result = { [Op.and]: whereFragments }
  console.log(`[DataScope DEBUG] AND COMBINED → ${JSON.stringify(result).slice(0, 200)}`)
  return result
}

// ============================================================================
// 5. 单条规则翻译（Phase 4.1 增强 — 完整容错）
// ============================================================================

function translateRule(
  rule: DataScopeRule,
  dimDict: Map<string, DataDimension>,
  businessObj: BusinessObjCode,
  username: string
): Record<string, any> | null {
  // 防御：scope_type 为空或未知
  if (!rule.scope_type) {
    console.log(`[DataScope DEBUG] rule has empty scope_type, skip`)
    return null
  }

  switch (rule.scope_type) {
    case 'all':
      return null // 全部数据 = 不加条件

    case 'self': {
      // scope_type=self → 查 self_column_map 里的列名，回退 target_column，最后回退 'created_by'
      // 注：self 通常配 employee 维度，但也可能是其他维度
      const dim = rule.dim_code ? dimDict.get(rule.dim_code) : null
      let col = 'created_by'
      if (dim) {
        if (dim.self_column_map && businessObj in dim.self_column_map) {
          const mapped = dim.self_column_map[businessObj]
          if (mapped) col = mapped
        } else if (dim.target_column) {
          col = dim.target_column
        }
      }
      console.log(`[DataScope DEBUG] self → col=${col}, username=${username}`)
      return { [col]: username }
    }

    case 'dept':
    case 'workshop':
      // TODO: 需要 sys_user 有 dept/workshop 字段 + 自动拉取当前用户所属值
      logger.debug(`[DataScope] ${rule.scope_type} scope 暂未实现，跳过`)
      return null

    case 'custom': {
      if (!rule.dim_code) return null
      const dim = dimDict.get(rule.dim_code)
      if (!dim) {
        logger.warn(`[DataScope] 维度字典未找到 dim_code=${rule.dim_code}，跳过`)
        return null
      }
      if (!rule.dim_value) {
        logger.warn(`[DataScope] custom scope dim_value 为空，跳过`)
        return null
      }
      // 先查 column_map 里 businessObj 覆盖的列名，回退 target_column
      const col = (dim.column_map && dim.column_map[businessObj]) || dim.target_column
      if (!col) {
        logger.warn(`[DataScope] target_column 为空 dim=${rule.dim_code}，跳过`)
        return null
      }
      return buildCustomCondition(col, rule.operator || 'IN', rule.dim_value)
    }

    default:
      console.log(`[DataScope DEBUG] unknown scope_type=${rule.scope_type}, skip`)
      return null
  }
}

// ============================================================================
// 6. 自定义条件组装（Sequelize Op 形式）
// ============================================================================

function buildCustomCondition(targetColumn: string, operator: string, dimValue: string | null): Record<string, any> | null {
  if (!targetColumn || !dimValue) return null

  let values: any[]
  try {
    values = JSON.parse(dimValue)
    if (!Array.isArray(values)) values = [values]
  } catch {
    values = [dimValue]
  }

  const numericValues = values.map(v => {
    const n = Number(v)
    return Number.isFinite(n) && String(n) === String(v) ? n : v
  })

  switch (operator.toUpperCase()) {
    case 'IN':
      return { [targetColumn]: { [Op.in]: numericValues } }
    case 'NOT_IN':
      return { [targetColumn]: { [Op.notIn]: numericValues } }
    case 'EQ':
      return { [targetColumn]: numericValues[0] }
    case 'NEQ':
      return { [targetColumn]: { [Op.ne]: numericValues[0] } }
    case 'LIKE':
      return { [targetColumn]: { [Op.like]: `%${values[0]}%` } }
    case 'GT':
      return { [targetColumn]: { [Op.gt]: numericValues[0] } }
    case 'LT':
      return { [targetColumn]: { [Op.lt]: numericValues[0] } }
    case 'BETWEEN':
      if (numericValues.length >= 2) {
        return { [targetColumn]: { [Op.between]: [numericValues[0], numericValues[1]] } }
      }
      return null
    default:
      return null
  }
}

// 导出（给外部直接调用需要的函数）
export { loadDimDict, loadUserScopeRules }
