/**
 * 权限引擎 V2 公共类型定义
 * 所有权限引擎相关模块共享的类型集中在此，避免魔法字符串
 */

// ============================================================================
// 业务对象 / 维度 / 状态 — 字典表对应的运行时类型
// ============================================================================

/** 业务对象编码 (对应 sys_business_object.obj_code) */
export type BusinessObjCode = string

/** 数据维度编码 (对应 sys_data_dimension.dim_code) */
export type DataDimCode = string

/** 业务状态规则 operateKey (对应 sys_biz_status_rule.operate_key) */
export type OperateKey = string

// ============================================================================
// 数据权限范围类型 (scope_type)
// ============================================================================

export type ScopeType = 'all' | 'self' | 'dept' | 'workshop' | 'custom'

export const SCOPE_TYPES: Record<ScopeType, string> = {
  all: '全部数据',
  self: '仅本人',
  dept: '本部门及下级',
  workshop: '本车间',
  custom: '自定义维度过滤',
}

// ============================================================================
// 数据权限规则三元组
// ============================================================================

export type DataScopeOperator = 'IN' | 'NOT_IN' | 'EQ' | 'NEQ' | 'LIKE' | 'GT' | 'LT' | 'BETWEEN'

export interface DataScopeRule {
  scope_id?: number
  role_id: number | null
  user_id: number | null
  obj_code: BusinessObjCode
  scope_type: ScopeType
  dim_code: DataDimCode | null
  operator: DataScopeOperator
  dim_value: string | null // JSON 数组字符串
  perm_code: string | null // 可选：绑定到具体权限码
}

// ============================================================================
// 业务状态规则
// ============================================================================

export interface BizStatusRule {
  rule_id?: number
  obj_code: BusinessObjCode
  operate_key: OperateKey
  operate_name: string
  /** JSON 数组字符串，允许的状态值列表 */
  allowed_states: string
  next_state: string | null
  perm_code: string | null
  error_message: string | null
}

// ============================================================================
// 数据维度字典（运行时用来拼 SQL）
// ============================================================================

export interface DataDimension {
  dim_id: number
  dim_code: DataDimCode
  dim_name: string
  /** 目标表名（逗号分隔） */
  target_table: string
  /** SQL WHERE 里实际用来过滤的列名 */
  target_column: string
  data_type: 'string' | 'number' | 'date' | 'enum'
  description: string | null
}

// ============================================================================
// Express Request 扩展 — 权限引擎挂载的数据
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      /** 权限引擎 V2 运行时上下文 */
      permV2?: {
        userId: number
        roleId: number | null
        roleCode: string | null
        roleName: string | null
        username: string
        /** 用户权限码全集（含角色继承 + 用户独立 + '*' 通配） */
        permCodes: Set<string>
        /** 角色/用户级 scope_type */
        scopeType: ScopeType
        /** scope 拦截器拼好的 SQL 片段（Sequelize Op 形式） */
        scopeWhere?: Record<string, any>
      }
    }
  }
}

// ============================================================================
// 注解（Express 中间件）参数类型
// ============================================================================

/** 功能权限中间件参数 — 替代 @PreAuthorize("hasPerm('xxx')") */
export interface RequirePermOptions {
  /** 必需的权限码（后端注解里的 permKey），如 production:order:view */
  permCode: string | string[]
  /** 多个权限码的组合逻辑：ALL 表示全部具备，ANY 表示任意一个即可 */
  logic?: 'ALL' | 'ANY'
}

/** 业务状态校验中间件参数 — 替代 @BizStatusCheck */
export interface BizStatusCheckOptions {
  businessObj: BusinessObjCode
  operateKey: OperateKey
  /** 从哪个 URL param 或 body 字段取单据 ID 默认 'id' */
  idField?: string
  /** 默认从 req.params 取 */
  idSource?: 'params' | 'body' | 'query'
}

/** 数据权限中间件参数 — 替代 @DataScope */
export interface DataScopeOptions {
  businessObj: BusinessObjCode
}

// ============================================================================
// 审计 / 扫描器类型
// ============================================================================

export interface ScannerDiff {
  /** 类型: missing=字典缺失多余=未注解 */
  type: 'missing' | 'extra'
  obj_code?: string
  dim_code?: string
  perm_code?: string
  file?: string
  line?: number
  message: string
}

export interface ScannerReport {
  scanner: string
  generatedAt: string
  total: number
  diffs: ScannerDiff[]
}
