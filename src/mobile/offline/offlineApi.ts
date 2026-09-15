/**
 * 离线优先 API 包装（P2.2）
 *
 * 使用方式：
 *   import { offlinePost } from '../offline/offlineApi'
 *   const r = await offlinePost('/basic/process-inspections/submit', payload, { source: 'process-inspection' })
 *
 * 行为：
 *  - 在线 → 直接走 api.post，返回原始 ApiResponse（成功或失败均透传）
 *  - 离线 / 网络错误 → 入队并返回 { success: true, data: { queued: true }, message: '已加入离线队列' }
 *    调用方据此在 UI 上提示"已暂存，网络恢复后自动同步"
 *
 * 设计目标：移动端断网也能完成"提交"动作，避免用户卡在 Toast 报错。
 */
import api from '../../utils/api'
import { enqueue } from './queue'
import type { QueueMethod } from './db'
import type { ApiResponse } from '../../utils/api'

interface OfflineOptions {
  /** 业务来源标签 */
  source?: string
  /** 在线时是否允许透传失败响应（默认 false：在线时仍按失败原样返回） */
  passThroughOnlineErrors?: boolean
}

/** 离线感知 POST */
export async function offlinePost(url: string, body?: any, opts: OfflineOptions = {}): Promise<ApiResponse> {
  return offlineRequest('POST', url, body, opts)
}

/** 离线感知 PUT */
export async function offlinePut(url: string, body?: any, opts: OfflineOptions = {}): Promise<ApiResponse> {
  return offlineRequest('PUT', url, body, opts)
}

/** 离线感知 DELETE */
export async function offlineDelete(url: string, opts: OfflineOptions = {}): Promise<ApiResponse> {
  return offlineRequest('DELETE', url, undefined, opts)
}

async function offlineRequest(
  method: QueueMethod,
  url: string,
  body: any,
  opts: OfflineOptions,
): Promise<ApiResponse> {
  // 离线 → 直接入队
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return enqueueIfOffline(method, url, body, opts)
  }

  // 在线 → 尝试正常调用；失败若为网络错误，则降级为入队
  try {
    const fn = method === 'POST' ? api.post
      : method === 'PUT' ? api.put
      : method === 'DELETE' ? api.delete
      : (api as any).patch
    return await fn.call(api, url, body)
  } catch (err: any) {
    const isNetwork = err?.code === 'ERR_NETWORK'
      || err?.code === 'ECONNABORTED'
      || /网络连接失败|请求超时/.test(err?.message || '')
    if (isNetwork) {
      return enqueueIfOffline(method, url, body, opts)
    }
    // 业务错误透传（让调用方处理）
    if (opts.passThroughOnlineErrors === false) {
      return {
        success: false,
        code: 10000,
        message: err?.message || '请求失败',
        data: null,
      } as ApiResponse
    }
    throw err
  }
}

async function enqueueIfOffline(
  method: QueueMethod,
  url: string,
  body: any,
  opts: OfflineOptions,
): Promise<ApiResponse> {
  try {
    await enqueue({ method, url, body, source: opts.source })
    return {
      success: true,
      code: 0,
      message: '已加入离线队列，网络恢复后自动同步',
      data: { queued: true },
    } as ApiResponse
  } catch (err: any) {
    return {
      success: false,
      code: 10000,
      message: err?.message || '离线入队失败',
      data: null,
    } as ApiResponse
  }
}
