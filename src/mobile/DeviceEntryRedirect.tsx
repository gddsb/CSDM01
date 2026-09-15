/**
 * 设备入口重定向
 * - 仅在 **Capacitor 原生壳内** 才自动跳转移动端路由
 * - 纯 Web 浏览器（PC / 移动浏览器调试）一律留 PC 端，避免误判
 *
 * 判断依据优先级（递减）：
 *   1. window.Capacitor 存在 → 原生壳内
 *   2. URL 带 ?mobile=1 / hash #mobile → 强制进入移动端（调试用）
 *   3. Web 环境 → 永远留在 PC 端
 *
 * 反向跳转（PC 浏览器访问 /m/* → 跳 /dashboard）始终生效。
 */
import { Navigate, useLocation } from 'react-router-dom'

function isInCapacitorShell(): boolean {
  const win: any = typeof window !== 'undefined' ? window : {}
  if (win.Capacitor) return true
  // UA 兜底（某些版本壳内 UA 带 Capacitor）
  if (typeof navigator !== 'undefined' && /capacitor/i.test(navigator.userAgent)) return true
  return false
}

function isForceMobileOverride(): boolean {
  if (typeof window === 'undefined') return false
  const search = window.location.search.toLowerCase()
  const hash = window.location.hash.toLowerCase()
  return search.includes('mobile=1') || hash.includes('mobile=1')
}

export function isMobilePath(pathname: string): boolean {
  return pathname === '/m' || pathname.startsWith('/m/')
}

export function DeviceEntryRedirect({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  // 1) 原生壳内 或 强制移动端 → 走移动端路由
  const shouldUseMobile = isInCapacitorShell() || isForceMobileOverride()

  if (shouldUseMobile && !isMobilePath(location.pathname)) {
    return <Navigate to="/m/dashboard" replace />
  }

  // 2) Web 环境访问移动端路由 → 跳回 PC 端（防误触）
  if (!shouldUseMobile && isMobilePath(location.pathname)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
