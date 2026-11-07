/**
 * 权限引擎 V2 统一缓存管理
 *
 * 职责：
 *   1. 集中管理权限相关的所有缓存 key / TTL / 失效逻辑
 *   2. 业务 Controller 禁止零散写 Redis/内存删除，统一调 clear()
 *   3. 当前实现为内存缓存（进程内 Map），接口预留 Redis 替换能力
 *
 * 缓存层级：
 *   L1 用户权限码全集       key=permCodes:{userId}               TTL=60s
 *   L2 角色 → 权限码映射    key=rolePerms:{roleId}                 TTL=60s
 *   L3 用户 scope_type      key=userScope:{userId}                 TTL=30s
 *   L4 业务对象字典         key=objDict                            TTL=5min
 *   L5 数据维度字典         key=dimDict                            TTL=5min
 *   L6 状态规则             key=bizRule:{obj_code}:{operateKey}  TTL=2min
 */

import logger from '../../../utils/logger.js'

type CacheEntry<T> = { value: T; ts: number; ttl: number }

const MEMORY_STORE = new Map<string, CacheEntry<any>>()

const CACHE_KEYS = {
  permCodes: (uid: number) => `permCodes:${uid}`,
  rolePerms: (rid: number) => `rolePerms:${rid}`,
  userScope: (uid: number) => `userScope:${uid}`,
  objDict: 'objDict',
  dimDict: 'dimDict',
  bizRule: (obj: string, op: string) => `bizRule:${obj}:${op}`,
} as const

/** 缓存 TTL（毫秒） */
const TTL = {
  permCodes: 60_000,
  rolePerms: 60_000,
  userScope: 30_000,
  objDict: 5 * 60_000,
  dimDict: 5 * 60_000,
  bizRule: 2 * 60_000,
}

export function getCache<T>(key: string): T | null {
  const entry = MEMORY_STORE.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > entry.ttl) {
    MEMORY_STORE.delete(key)
    return null
  }
  return entry.value as T
}

export function setCache<T>(key: string, value: T, ttl?: number): void {
  MEMORY_STORE.set(key, { value, ts: Date.now(), ttl: ttl ?? 60_000 })
}

function deleteCache(key: string): void {
  MEMORY_STORE.delete(key)
}

// ============================================================================
// 统一失效 API — 业务代码只调这些，不直接操作底层 store
// ============================================================================

/**
 * 角色权限变更后调用：清除该角色下所有用户的权限码 + 角色映射
 * （因为角色绑定了新权限 → 所有关联用户的权限码全集变了）
 */
export function onRolePermissionChange(roleId: number): void {
  deleteCache(CACHE_KEYS.rolePerms(roleId))
  // 清除字典缓存（业务对象/维度字典不变，但 role_permission 关联变了）
  // 注意：permCodes:{userId} 无法知道哪些 userId 属于这个 role，
  // 所以简单粗暴 — 全部清掉（内存缓存代价很低，60s 内所有用户自动刷新）
  for (const k of MEMORY_STORE.keys()) {
    if (k.startsWith('permCodes:')) deleteCache(k)
  }
  logger.info(`[PermissionCache] cleared for role_permission change roleId=${roleId}`)
}

/**
 * 用户级独立 scope 变更后调用
 */
export function onUserScopeChange(userId: number): void {
  deleteCache(CACHE_KEYS.userScope(userId))
  deleteCache(CACHE_KEYS.permCodes(userId))
  logger.info(`[PermissionCache] cleared for user scope change userId=${userId}`)
}

/**
 * 业务对象字典变更后调用
 */
export function onBusinessObjectChange(): void {
  deleteCache(CACHE_KEYS.objDict)
  logger.info('[PermissionCache] cleared objDict')
}

/**
 * 数据维度字典变更后调用
 */
export function onDataDimensionChange(): void {
  deleteCache(CACHE_KEYS.dimDict)
  logger.info('[PermissionCache] cleared dimDict')
}

/**
 * 业务状态规则变更后调用
 */
export function onBizStatusRuleChange(objCode?: string, operateKey?: string): void {
  if (objCode && operateKey) {
    deleteCache(CACHE_KEYS.bizRule(objCode, operateKey))
  } else {
    // 清除所有 bizRule
    for (const k of MEMORY_STORE.keys()) {
      if (k.startsWith('bizRule:')) deleteCache(k)
    }
  }
  logger.info(`[PermissionCache] cleared bizRule ${objCode ?? 'ALL'}`)
}

/**
 * 数据权限规则（sys_data_scope）变更后调用
 */
export function onDataScopeChange(userId?: number, roleId?: number): void {
  if (userId) deleteCache(CACHE_KEYS.userScope(userId))
  if (roleId) deleteCache(CACHE_KEYS.rolePerms(roleId))
  // 清除所有用户 scope
  for (const k of MEMORY_STORE.keys()) {
    if (k.startsWith('userScope:')) deleteCache(k)
  }
  logger.info(`[PermissionCache] cleared data_scope ${userId ?? ''}/${roleId ?? ''}`)
}

/** 全量清除（用于 admin 手动清缓存接口） */
export function clearAllCache(): void {
  MEMORY_STORE.clear()
  logger.info('[PermissionCache] ALL cleared')
}

/** 诊断：返回当前缓存大小 */
export function cacheStats(): { size: number; keys: string[] } {
  return { size: MEMORY_STORE.size, keys: [...MEMORY_STORE.keys()] }
}

// 导出 key 工厂 — 其他模块可能需要手动 get/set
export { CACHE_KEYS, TTL }
