/**
 * 离线队列客户端：入队 / 查询 / 同步（P2.2）
 *
 * 设计要点：
 * 1. enqueue：对相同的 (method, url, body) 做幂等去重（key 唯一），重复入队只更新时间
 * 2. drain：FIFO 拉取 pending 队列，逐条执行；失败按指数退避下次重试
 * 3. 状态：pending → syncing → done/failed
 * 4. 同步触发：网络恢复事件、入队后立即尝试、定时器轮询
 */
import axios, { AxiosError } from 'axios'
import { db, buildQueueKey, QueuedRequest, QueueMethod } from './db'

/** 最大重试次数，超过后置为 failed 不再自动重试 */
const MAX_RETRIES = 8
/** 单条请求超时（ms） */
const REQUEST_TIMEOUT = 20000
/** 退避基数（ms），第 n 次重试等待 base * 2^n（最大 5 分钟） */
const BACKOFF_BASE = 2000
const BACKOFF_MAX = 5 * 60 * 1000

// API 实例（独立于 src/utils/api.ts，避免拦截器把 401 重定向到登录页拖累同步）
const syncAxios = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || '/api',
  timeout: REQUEST_TIMEOUT,
})

// 每次同步时从 localStorage 读取最新 token，避免登录切换后 token 失效
function attachAuth(): Record<string, string> {
  const token = localStorage.getItem('mes_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** 计算下次重试时间（指数退避） */
export function computeBackoff(retries: number): number {
  const delay = Math.min(BACKOFF_BASE * Math.pow(2, retries), BACKOFF_MAX)
  // 加入 ±20% 抖动，避免大量积压请求同时重试
  const jitter = delay * (0.8 + Math.random() * 0.4)
  return Date.now() + Math.round(jitter)
}

/** 是否应该立即同步（在线 + 队列非空 + 有可重试项） */
export async function shouldSync(): Promise<boolean> {
  if (!navigator.onLine) return false
  const count = await db.queue
    .where('status')
    .equals('pending')
    .and((r) => !r.nextRetryAt || r.nextRetryAt <= Date.now())
    .count()
  return count > 0
}

/** 入队一个待同步请求（幂等：相同 key 只保留最新） */
export async function enqueue(opts: {
  method: QueueMethod
  url: string
  body?: any
  source?: string
}): Promise<QueuedRequest | null> {
  // 仅在断网或失败时入队；在线时由调用方自行调用原生 API
  const bodyStr = opts.body == null
    ? null
    : (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body))
  const key = buildQueueKey(opts.method, opts.url, opts.body)

  const existing = await db.queue.where('key').equals(key).first()
  const now = Date.now()
  if (existing) {
    // 已有相同请求 → 更新入队时间与 body，重置重试次数（最近一次失败可能已修复）
    await db.queue.update(existing.id!, {
      body: bodyStr,
      enqueuedAt: now,
      retries: 0,
      nextRetryAt: undefined,
      lastError: undefined,
      status: 'pending',
      source: opts.source || existing.source,
    })
    const updated = await db.queue.get(existing.id!)
    return updated || null
  }

  const id = await db.queue.add({
    key,
    method: opts.method,
    url: opts.url,
    body: bodyStr,
    source: opts.source,
    enqueuedAt: now,
    retries: 0,
    status: 'pending',
  } as QueuedRequest)
  return await db.queue.get(id as number) || null
}

/** 队列深度（pending 状态条数） */
export async function pendingCount(): Promise<number> {
  return await db.queue.where('status').equals('pending').count()
}

/** 把已成功的请求移出队列（done 状态保留 N 分钟用于 UI 反馈，再物理删除） */
async function cleanupOldDone(): Promise<void> {
  const cutoff = Date.now() - 5 * 60 * 1000
  await db.queue
    .where('status')
    .equals('done')
    .and((r) => r.enqueuedAt < cutoff)
    .delete()
}

/** 同步循环：逐条执行 pending 请求，直到为空或遇到需要退避的项 */
export async function drain(): Promise<{ ok: number; failed: number; retried: number }> {
  if (!navigator.onLine) return { ok: 0, failed: 0, retried: 0 }

  let ok = 0, failed = 0, retried = 0

  while (true) {
    const next = await db.queue
      .where('status')
      .equals('pending')
      .and((r) => !r.nextRetryAt || r.nextRetryAt <= Date.now())
      .sortBy('enqueuedAt')

    if (next.length === 0) break
    const item = next[0]

    // 标记 syncing
    await db.queue.update(item.id!, { status: 'syncing' })

    try {
      const headers = attachAuth()
      let bodyData: any = undefined
      if (item.body) {
        try { bodyData = JSON.parse(item.body) } catch { bodyData = item.body }
      }
      await syncAxios.request({
        url: item.url,
        method: item.method,
        data: bodyData,
        headers,
      })
      await db.queue.update(item.id!, { status: 'done', lastError: undefined })
      ok++
    } catch (err) {
      const e = err as AxiosError | Error
      const msg = (e as AxiosError)?.response
        ? `HTTP ${(e as AxiosError).response?.status}`
        : (e as Error).message
      const newRetries = item.retries + 1
      if (newRetries >= MAX_RETRIES) {
        await db.queue.update(item.id!, {
          status: 'failed',
          retries: newRetries,
          lastError: msg,
        })
        failed++
      } else {
        await db.queue.update(item.id!, {
          status: 'pending',
          retries: newRetries,
          lastError: msg,
          nextRetryAt: computeBackoff(newRetries),
        })
        retried++
        // 遇到需要退避的项，本次同步暂停
        break
      }
    }
  }

  await cleanupOldDone()
  return { ok, failed, retried }
}

/** 重置 failed 项为 pending，供用户手动重试 */
export async function retryFailed(): Promise<number> {
  const failedItems = await db.queue.where('status').equals('failed').toArray()
  for (const item of failedItems) {
    await db.queue.update(item.id!, {
      status: 'pending',
      retries: 0,
      nextRetryAt: undefined,
      lastError: undefined,
    })
  }
  return failedItems.length
}

/** 清空整队（谨慎调用） */
export async function clearAll(): Promise<void> {
  await db.queue.clear()
}

/** 列出全部队列项（UI 展示用） */
export async function listAll(): Promise<QueuedRequest[]> {
  return await db.queue.orderBy('enqueuedAt').reverse().toArray()
}
