/**
 * 移动端图片上传日志持久化 + 批量上报
 *
 * 设计：
 *   - 所有 [IMG-UPLOAD] 阶段日志除了 console.log（真机 Logcat 可见），
 *     还同步存一份到 localStorage 队列（最多 500 条，超了丢最旧的）
 *   - 每次 APP 启动 / 登录成功后，后台静默 POST 到
 *     POST /production/report-images/upload-logs 服务器临时目录
 *   - 日志队列 flush 成功后清空
 *   - flush 失败不影响主业务，下次启动继续尝试
 */
import api from '../../utils/api'

const QUEUE_KEY = 'mes_img_upload_logs'
const MAX_QUEUE = 500

export interface QueuedLogEntry {
  /** ISO 时间戳 */
  time: string
  /** 阶段：START / COMPRESS / REQUEST / RESPONSE / DONE / FAIL / ABORT / CHANGE 等 */
  stage: string
  /** 详细内容（自由 JSON） */
  ctx: any
  /** info / warn / error */
  level: 'info' | 'warn' | 'error'
}

/** 追加一条到队列（自动滑动窗口，超 MAX 丢最旧的） */
export function pushLog(entry: QueuedLogEntry): void {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const queue: QueuedLogEntry[] = raw ? JSON.parse(raw) : []
    queue.push(entry)
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch { /* localStorage 满 / 隐私模式静默失败 */ }
}

/** 读当前队列（调试用） */
export function readAll(): QueuedLogEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/**
 * 批量 flush 到服务器（静默，不弹 UI）
 * 成功返回 true，失败返回 false（但不抛异常，让调用方 try/catch 可选）
 */
export async function flushLogs(): Promise<boolean> {
  const queue = readAll()
  if (queue.length === 0) return true

  try {
    // 用裸 fetch 不用 api.ts —— 避免阻塞全局请求链
    const API_BASE =
      ((import.meta as any).env?.VITE_API_BASE_URL as string) || ''
    const url = API_BASE
      ? `${API_BASE}/report-images/upload-logs`
      : '/api/production/report-images/upload-logs'

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ logs: queue }),
      // 短超时：日志上报不能卡 APP 启动
      signal: AbortSignal.timeout?.(5000),
    })
    // 上报成功才清，失败下次继续
    localStorage.removeItem(QUEUE_KEY)
    return true
  } catch {
    return false
  }
}
