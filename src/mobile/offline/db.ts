/**
 * 离线优先队列 — Dexie IndexedDB 数据库（P2.2）
 *
 * 存储因网络中断而暂存的 POST/PUT/DELETE 请求，等网络恢复时按 FIFO 自动重放。
 * 每条记录包含：方法、URL、请求体、入队时间、重试次数、最后一次错误信息。
 */
import Dexie, { Table } from 'dexie'

export type QueueMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface QueuedRequest {
  id?: number
  /** 业务键：用于幂等去重；通常是 方法+url+body 的稳定哈希 */
  key: string
  method: QueueMethod
  url: string
  /** 请求体（JSON 序列化字符串，便于 IndexedDB 存储） */
  body?: string | null
  /** 来源业务标签（如 "process-inspection" / "exception-report"），便于 UI 展示 */
  source?: string
  /** 入队时间戳（ms） */
  enqueuedAt: number
  /** 重试次数 */
  retries: number
  /** 下次允许重试的时间（ms，用于指数退避） */
  nextRetryAt?: number
  /** 最后一次错误信息 */
  lastError?: string
  /** 状态：pending / syncing / failed / done */
  status: 'pending' | 'syncing' | 'failed' | 'done'
}

class OfflineQueueDB extends Dexie {
  queue!: Table<QueuedRequest, number>

  constructor() {
    super('daman_mes_offline')
    this.version(1).stores({
      // ++id 自增主键；&key 唯一索引；status/nextRetryAt 用于查询待同步
      queue: '++id, &key, status, nextRetryAt, enqueuedAt',
    })
  }
}

export const db = new OfflineQueueDB()

/** 生成稳定 key（method+url+body 简单哈希），用于幂等去重 */
export function buildQueueKey(method: QueueMethod, url: string, body?: any): string {
  const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : ''
  // 简单 FNV-1a 哈希，避免引入额外依赖
  let hash = 2166136261
  const s = `${method}|${url}|${bodyStr}`
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return `${method}:${url}:${hash.toString(16)}`
}
