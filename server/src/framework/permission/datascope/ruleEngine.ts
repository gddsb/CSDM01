/**
 * 权限引擎 V2 — 数据权限规则引擎
 *
 * Phase 4 增强：
 *   - role_code=SUPER_ADMIN / ADMIN 直接返回空 where（全量）
 *   - scope_type=self 按业务对象拼不同列（column_map JSON）
 *   - scope_type=custom 按业务对象覆盖列名（self_column_map JSON）
 *   - user_id 独立规则覆盖 role_id 规则（同一 obj_code）
 *   - 多角色/多规则 AND 组合（scope_type=all 跳过）
 */

import type { ScopeType, DataScopeRule, DataDimension, BusinessObjCode } from '../types.js'
import { getCache, setCache, TTL } from '../cache/permissionCache.js'
import { DataScope, DataDimension as DataDimModel, Role } from '../../../models/index.js'
import { Op } from 'sequelize'
import logger from '../../../utils/logger.js'

// ============================================================================
// 1. 加载维度字典（带缓存）— 用来把 dim_code 翻译成 SQL column
// ============================================================================

const CACHE_KEY_DIMS = 'dimDict'

function parseJSONMap(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function loadDimDict(): Promise<Map<string, DataDimension>> {
  const cached = getCache<Map<string, DataDimension>>(CACHE_KEY_DIMS)
  if (cached) return cached

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
  return map
}

// ============================================================================
// 2. 加载用户 scope 规则（带缓存）
//    user_id 规则覆盖 role_id 规则（同一 obj_code）
// ============================================================================

async function loadUserScopeRules(userId: number, roleId: number | null): Promise<DataScopeRule[]> {
  const CACHE_KEY = `userScope:${userId}`
  const cached = getCache<DataScopeRule[]>(CACHE_KEY)
  if (cached) return cached

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
  return list
}

// ============================================================================
// 3. 超级管理员短路：role_code IN ('SUPER_ADMIN', 'ADMIN') 直接返回空 where
// ============================================================================

const SHORT_CIRCUIT_ROLES = ['SUPER_ADMIN', 'ADMIN']

async function isSuperAdminRole(roleId: number | null): Promise<boolean> {
  if (!roleId) return false
  const role = await Role.findByPk(roleId, { attributes: ['role_code'] })
  if (!role) return false
  return SHORT_CIRCUIT_ROLES.includes((role as any).role_code)
}

// ============================================================================
// 4. 主入口：构建业务对象的 Sequelize where 条件
// ============================================================================

export async function buildDataScopeWhere(
  userId: number,
  roleId: number | null,
  businessObj: BusinessObjCode,
  username: string,
  requestPermCode?: string
): Promise<Record<string, any>> {
  console.log(`[DataScope DEBUG] buildDataScopeWhere userId=${userId} roleId=${roleId} obj=${businessObj} username=${username}`)

  // 4a. 超级管理员短路
  const roleCode = await (async () => {
    if (!roleId) return null
    const { Role } = await import('../../../models/index.js')
    const role = await Role.findByPk(roleId, { attributes: ['role_code'] })
    return role ? (role as any).role_code : null
  })()
  console.log(`[DataScope DEBUG] roleCode=${roleCode}`)
  if (roleCode && SHORT_CIRCUIT_ROLES.includes(roleCode)) {
    console.log(`[DataScope DEBUG] SHORT CIRCUIT for role_code=${roleCode}`)
    return {}
  }

  // 4b. 加载规则 + 维度字典
  const [rules, dimDict] = await Promise.all([loadUserScopeRules(userId, roleId), loadDimDict()])
  console.log(`[DataScope DEBUG] rules loaded=${rules.length}, dimDict keys=${Array.from(dimDict.keys())}`)

  // 4c. user_id 独立规则覆盖 role_id（同一 obj_code）
  const userRules = rules.filter(r => r.user_id === userId && r.obj_code === businessObj)
  const roleRules  = rules.filter(r => r.role_id === roleId && r.user_id === null && r.obj_code === businessObj)
  console.log(`[DataScope DEBUG] obj=${businessObj}: userRules=${userRules.length}, roleRules=${roleRules.length}`)

  let objRules = userRules.length > 0 ? userRules : roleRules

  if (objRules.length === 0) {
    // 没有任何规则 — 不做过滤（默认全看）
    console.log(`[DataScope DEBUG] NO RULES → empty where (default all)`)
    return {}
  }

  // 4d. 按 scope_type=all 直接跳过（全量）
  if (objRules.some(r => r.scope_type === 'all')) {
    console.log(`[DataScope DEBUG] scope_type=all → empty where`)
    return {}
  }

  // 4e. 如果有 perm_code 精确匹配，优先用
  if (requestPermCode) {
    const precise = objRules.filter(r => r.perm_code === requestPermCode)
    if (precise.length > 0) objRules = precise
  }

  // 4f. 翻译每条规则 → Sequelize where 片段
  const whereFragments: Record<string, any>[] = []
  for (const rule of objRules) {
    const frag = translateRule(rule, dimDict, businessObj, username)
    console.log(`[DataScope DEBUG] rule=${JSON.stringify(rule).slice(0,100)} → frag=${JSON.stringify(frag)}`)
    if (frag) whereFragments.push(frag)
  }

  if (whereFragments.length === 0) return {}
  if (whereFragments.length === 1) return whereFragments[0]

  // 多规则 AND 组合
  return { [Op.and]: whereFragments }
}

// ============================================================================
// 5. 单条规则翻译（Phase 4 增强）
// ============================================================================

function translateRule(
  rule: DataScopeRule,
  dimDict: Map<string, DataDimension>,
  businessObj: BusinessObjCode,
  username: string
): Record<string, any> | null {
  switch (rule.scope_type) {
    case 'all':
      return null // 全部数据 = 不加条件

    case 'self': {
      // scope_type=self → 查 self_column_map 里的列名，回退 created_by
      // 注：这里用的是 "employee" 维度的 self_column_map — 由后端配置
      const dim = rule.dim_code ? dimDict.get(rule.dim_code) : null
      let col = 'created_by'
      if (dim?.self_column_map) {
        col = dim.self_column_map[businessObj] || dim.target_column
      } else if (dim) {
        col = dim.target_column
      }
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
        logger.warn(`[DataScope] 维度字典未找到 dim_code=${rule.dim_code}`)
        return null
      }
      // 先查 column_map 里 businessObj 覆盖的列名，回退 target_column
      const col = dim.column_map?.[businessObj] || dim.target_column
      return buildCustomCondition(col, rule.operator, rule.dim_value)
    }

    default:
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

// 导出（给 datascope 中间件用）
export { loadDimDict, loadUserScopeRules }
