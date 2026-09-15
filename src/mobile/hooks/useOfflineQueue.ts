/**
 * useOfflineQueue — 移动端离线队列监控/触发 hook（P2.2）
 *
 * 功能：
 * 1. 监听 navigator.online/online 事件，恢复时自动 drain
 * 2. 提供队列深度（pending 数量）实时反馈 UI
 * 3. 暴露 retryFailed / clearAll 给"我的"页或 Toast 入口
 * 4. 在线时定时轮询，避免漏掉退避到期未自动触发的项
 *
 * 使用：在 MobileLayout 顶层挂一次即可，下游通过订阅 localStorage 事件或 Context 读取 pendingCount
 */
import { useCallback, useEffect, useState } from 'react'
import { drain, pendingCount, retryFailed, clearAll } from '../offline/queue'

const POLL_INTERVAL = 60 * 1000 // 60s 轮询一次

export function useOfflineQueue() {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncing, setSyncing] = useState(false)

  // 刷新 pending 数量
  const refresh = useCallback(async () => {
    try {
      const n = await pendingCount()
      setPending(n)
    } catch {
      /* IndexedDB 可能在隐私模式下不可用，静默降级 */
    }
  }, [])

  // 触发一次同步
  const triggerSync = useCallback(async () => {
    if (syncing || !navigator.onLine) return
    setSyncing(true)
    try {
      await drain()
    } catch {
      /* 静默降级 */
    } finally {
      setSyncing(false)
      await refresh()
    }
  }, [syncing, refresh])

  // 监听网络事件
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      // 网络恢复，立即触发同步
      triggerSync()
    }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [triggerSync])

  // 启动 + 定时轮询
  useEffect(() => {
    refresh()
    triggerSync()
    const timer = setInterval(() => {
      refresh()
      triggerSync()
    }, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [refresh, triggerSync])

  return {
    online,
    pending,
    syncing,
    refresh,
    triggerSync,
    retryFailed: async () => { const n = await retryFailed(); await refresh(); await triggerSync(); return n },
    clearAll: async () => { await clearAll(); await refresh() },
  }
}
