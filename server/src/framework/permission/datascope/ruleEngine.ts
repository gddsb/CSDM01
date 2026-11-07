/**
 * 权限引擎 V2 — 数据权限规则引擎
 *
 * 职责：
 *   1. 根据用户（user_id 或 role_id）查询 sys_data_scope 表
 *   2. 按 scope_type + dim_code + operator + dim_value 三元组合并多条规则
 *   3. 输出 Sequelize where 条件（Op 结构），供拦截器拼到查询里
 *
 * 数据模型：
 *   - 简单类型：scope_type=all/self/dept/workshop → 直接映射成 WHERE
 *   - 自定义类型：scope_type=custom → 按 dimension_code 找 target_column，生成 IN/NOT IN/EQ 等条件
 *   - 多规则组合：同一 obj_code 多条 scope 默认 AND；同一 dim_code 多值 IN 用 OR 组
 *
 * 关键设计：
 *   - 不直接拼 SQL 字符串，输出 Sequelize where 对象
 *   - 支持 IN 值 JSON 数组安全解析
 *   - 超级管理员 / 有 '*' 通配符的用户直接返回空 where（不过滤）
 */

import type { ScopeType, DataScopeRule, DataDimension, BusinessObjCode } from '../types.js'
import { getCache, setCache, TTL } from '../cache/permissionCache.js'
import { DataScope, DataDimension as DataDimModel, Role, User } from '../../../models/index.js'
import { Op } from 'sequelize'
import logger from '../../../utils/logger.js'

// ============================================================================
// 1. 加载维度字典（带缓存）— 用来把 dim_code 翻译成 SQL column
// ============================================================================

const CACHE_KEY_DIMS = 'dimDict'

async function loadDimDict(): Promise<Map<string, DataDimension>> {
  const cached = getCache<Map<string, DataDimension>>(CACHE_KEY_DIMS)
  if (cached) return cached

  const rows = await DataDimModel.findAll({
    attributes: ['dim_id', 'dim_code', 'dim_name', 'target_table', 'target_column', 'data_type', 'description'],
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
      data_type: r.data_type,
      description: r.description,
    })
  }

  setCache(CACHE_KEY_DIMS, map, TTL.dimDict)
  return map
}

// ============================================================================
// 2. 加载用户 scope 规则（带缓存）
//    规则优先级：user_id 规则 > role_id 规则
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
// 3. 把 scope_type 翻译成 Sequelize where 对象（不含具体 target_column）
//    —— 只是描述"按什么逻辑过滤"，拼 WHERE 时还需要知道 column
// ============================================================================

interface ScopeWherePart {
  /** Sequelize where 片段，如 { [Op.in]: [1,2,3] } */
  whereFragment: Record<string, any>
  /** 该片段要用到的 target_column（DataDimension.target_column） */
  targetColumn: string
}

/**
 * 构建业务对象的 Sequelize where 条件
 *
 * @param userId      当前用户
 * @param roleId      当前角色
 * @param businessObj 业务对象编码
 * @param username    当前登录用户名（self scope 用 created_by 过滤）
 * @param requestPermCode 可选：如果知道当前请求需要什么权限码，可以做更细粒度的规则匹配
 * @returns Sequelize where 对象（可能为空对象 = 不做过滤）
 */
export async function buildDataScopeWhere(
  userId: number,
  roleId: number | null,
  businessObj: BusinessObjCode,
  username: string,
  requestPermCode?: string
): Promise<Record<string, any>> {
  const [rules, dimDict] = await Promise.all([loadUserScopeRules(userId, roleId), loadDimDict()])

  // 1. 过滤到该业务对象 + 匹配 perm_code 的规则
  let objRules = rules.filter(r => r.obj_code === businessObj)

  // 如果有 perm_code，优先选精确匹配；没有精确匹配则用 obj_code 级别规则
  if (requestPermCode) {
    const precise = objRules.filter(r => r.perm_code === requestPermCode)
    if (precise.length > 0) objRules = precise
  }

  if (objRules.length === 0) {
    // 没有任何规则 — 不做过滤（默认全看）
    return {}
  }

  // 2. 把规则翻译成 Sequelize where 片段数组
  const whereFragments: Record<string, any>[] = []

  for (const rule of objRules) {
    const frag = translateRule(rule, dimDict, username)
    if (frag) whereFragments.push(frag)
  }

  if (whereFragments.length === 0) return {}
  if (whereFragments.length === 1) return whereFragments[0]

  // 多条规则 AND 组合（来自不同 scope 三元组）
  return { [Op.and]: whereFragments }
}

// ============================================================================
// 单条规则翻译
// ============================================================================

function translateRule(
  rule: DataScopeRule,
  dimDict: Map<string, DataDimension>,
  username: string
): Record<string, any> | null {
  switch (rule.scope_type) {
    case 'all':
      return null // 全部数据 = 不加条件

    case 'self':
      // 仅本人 → created_by = 当前用户名（通用语义）
      return { created_by: username }

    case 'dept':
      // 本部门 → 这里假设 sys_user.department 字段，但业务表里没有 dept 列
      // 简化实现：暂无，留给项目扩展（需要 join sys_user 表或业务表有 dept 字段）
      logger.debug(`[DataScope] dept scope 暂未实现，跳过 (rule=${rule.scope_id})`)
      return null

    case 'workshop':
      // 本车间 → 假设 sys_user 有 workshop 字段（目前没有）
      logger.debug(`[DataScope] workshop scope 暂未实现，跳过 (rule=${rule.scope_id})`)
      return null

    case 'custom': {
      // 自定义 → 按 dim_code 找维度定义
      if (!rule.dim_code) return null
      const dim = dimDict.get(rule.dim_code)
      if (!dim) {
        logger.warn(`[DataScope] 维度字典未找到 dim_code=${rule.dim_code}`)
        return null
      }
      return buildCustomCondition(dim.target_column, rule.operator, rule.dim_value)
    }

    default:
      return null
  }
}

// ============================================================================
// 自定义条件组装（Sequelize Op 形式）
// ============================================================================

function buildCustomCondition(targetColumn: string, operator: string, dimValue: string | null): Record<string, any> | null {
  if (!targetColumn || !dimValue) return null

  // 解析 dim_value 里的 JSON 数组
  let values: any[]
  try {
    values = JSON.parse(dimValue)
    if (!Array.isArray(values)) values = [values]
  } catch {
    // 不是 JSON — 当单值字符串处理
    values = [dimValue]
  }

  // 尝试转为数字（兼容 number 类型列）
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

// 方便：把规则导出给 datascope 中间件用
export { loadDimDict, loadUserScopeRules }
