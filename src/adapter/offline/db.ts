/**
 * Dexie 离线缓存层骨架
 *
 * 说明：完整的离线业务提交/同步策略在阶段 2 中实现。
 * 本文件先定义 schema 和 CRUD 基础方法，供后续扩展。
 *
 * 离线数据结构：
 *   - pending_ops   : 待提交业务操作队列（在有网时自动 sync 到后端）
 *   - cached_lists  : 列表页缓存（弱网可查看）
 *   - cached_detail : 详情页缓存（弱网可查看）
 *   - bigscreen_last: TV 大屏上次渲染数据（断网时仍可展示）
 */
import Dexie, { type Table } from 'dexie'

class OfflineDB extends Dexie {
  pendingOps!: Table<OfflineOp, number>
  cachedLists!: Table<CacheEntry, string>
  cachedDetail!: Table<CacheEntry, string>
  bigscreenLast!: Table<CacheEntry, string>

  constructor() {
    super('milk-can-mes-offline')
    this.version(1).stores({
      pendingOps: '++id, type, endpoint, status, createdAt',
      cachedLists: 'key, updatedAt',
      cachedDetail: 'key, updatedAt',
      bigscreenLast: 'key, updatedAt',
    })
  }
}

export interface OfflineOp {
  id?: number
  /** POST / PUT / DELETE */
  type: string
  /** 相对 API 路径，如 /production/report-orders */
  endpoint: string
  body?: unknown
  status: 'pending' | 'syncing' | 'done' | 'failed'
  createdAt: number
  error?: string
}

export interface CacheEntry {
  key: string
  data: unknown
  updatedAt: number
  ttlMs?: number
}

export const db = new OfflineDB()

/** 入队一个待提交操作 */
export async function enqueueOp(op: Omit<OfflineOp, 'id' | 'createdAt' | 'status'>): Promise<number> {
  return db.pendingOps.add({ ...op, status: 'pending', createdAt: Date.now() })
}

/** 获取所有待提交操作 */
export async function listPending(): Promise<OfflineOp[]> {
  return db.pendingOps.where('status').equals('pending').toArray()
}

/** 缓存列表页数据 */
export async function cacheList(key: string, data: unknown, ttlMs?: number): Promise<void> {
  await db.cachedLists.put({ key, data, updatedAt: Date.now(), ttlMs })
}

/** 读取列表页缓存（过期自动返回 null） */
export async function getListCache(key: string): Promise<unknown | null> {
  const hit = await db.cachedLists.get(key)
  if (!hit) return null
  if (hit.ttlMs && Date.now() - hit.updatedAt > hit.ttlMs) return null
  return hit.data
}

/** 缓存大屏数据（TV 断网时 fallback） */
export async function cacheBigScreen(key: string, data: unknown): Promise<void> {
  await db.bigscreenLast.put({ key, data, updatedAt: Date.now() })
}

export async function getBigScreen(key: string): Promise<unknown | null> {
  const hit = await db.bigscreenLast.get(key)
  return hit?.data ?? null
}
