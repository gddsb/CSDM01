/**
 * 全局 NavBar 返回按钮拦截器
 *
 * 设计目的：
 *   SPA 内部 step 状态机（如维保 step 0→1→2）切换不产生浏览器历史，
 *   NavBar 的 navigate(-1) 会直接跳出页面回首页。
 *   子页面通过 registerBackHandler 注册拦截器，NavBar onBack 先调 runBackHandler，
 *   返回 true 表示子页面已处理（step 降级），不再 navigate(-1)。
 *
 * 生命周期：
 *   registerBackHandler 返回 unregister 函数，子页面 useEffect cleanup 时调用，
 *   避免组件卸载后 handler 泄漏。
 *
 * 多 handler 场景：
 *   从后往前执行（reverse），确保最内层注册的 handler 先响应。
 */
type BackHandler = () => boolean

const handlers: Set<BackHandler> = new Set()

/** 子页面注册返回拦截器 —— 返回 unregister 函数 */
export function registerBackHandler(handler: BackHandler): () => void {
  handlers.add(handler)
  return () => { handlers.delete(handler) }
}

/** NavBar 调用 —— 任一 handler 返回 true 即消费，不再 navigate(-1) */
export function runBackHandler(): boolean {
  for (const h of Array.from(handlers).reverse()) {
    try {
      if (h()) return true
    } catch { /* handler 内部异常不阻断其它 handler */ }
  }
  return false
}
