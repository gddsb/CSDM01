/**
 * 设备入口重定向
 * - phone/pda/tablet（且在 Capacitor 壳内）访问 / → 跳到 /m/dashboard
 * - PC（或 TV）访问 /m/* → 跳回 /dashboard
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useDevice } from '../adapter'

export function isMobilePath(pathname: string): boolean {
  return pathname === '/m' || pathname.startsWith('/m/')
}

export function DeviceEntryRedirect({ children }: { children: React.ReactNode }) {
  const { type } = useDevice()
  const location = useLocation()
  const isMobileDevice = type === 'phone' || type === 'pda' || type === 'tablet'

  // 移动端设备访问 PC 根路由 → 跳到移动端入口
  if (isMobileDevice && !isMobilePath(location.pathname)) {
    // TV 端不参与移动端路由
    if (type === 'tv') return <>{children}</>
    return <Navigate to="/m/dashboard" replace />
  }

  // PC 设备访问移动端路由 → 跳回 PC 端
  if (!isMobileDevice && isMobilePath(location.pathname)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
