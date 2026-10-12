/**
 * 设备入口重定向
 * - 仅在 **Capacitor 原生壳内** 才自动跳转移动端路由
 * - 纯 Web 浏览器（PC / 移动浏览器调试）一律留 PC 端，避免误判
 *
 * 判断依据（统一用 isInNativeShell()，不能直接 !!window.Capacitor ——
 * 因为 Vite 打包后 window.Capacitor 对象在 Web 环境也存在！）
 *
 * 反向跳转（PC 浏览器访问 /m/* → 跳 /dashboard）始终生效。
 */
import { Navigate, useLocation } from 'react-router-dom'
import { isInNativeShell } from '../adapter'

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
  const shouldUseMobile = isInNativeShell() || isForceMobileOverride()

  if (shouldUseMobile && !isMobilePath(location.pathname)) {
    return <Navigate to="/m/dashboard" replace />
  }

  // 2) Web 环境访问移动端路由 → 跳回 PC 端（防误触）
  if (!shouldUseMobile && isMobilePath(location.pathname)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
