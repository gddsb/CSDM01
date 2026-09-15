/**
 * 移动端路由子树
 * 特点：
 * - 独立的 antd-mobile ConfigProvider（不能和 PC 的 antd ConfigProvider 嵌套）
 * - 移动端入口重定向（在 DeviceEntryRedirect 里处理，路由内不再重复）
 * - 登录守卫：未登录访问 /m/* → Navigate /m/login
 * - /m/login 可公开访问
 */
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { MobileLayout } from './MobileLayout'
import { MobileThemeProvider } from './theme'
import MobileLogin from './pages/MobileLogin'

const MobileDashboard = lazy(() => import('./pages/MobileDashboard'))
const MobileProcessReporting = lazy(() => import('./pages/MobileProcessReporting'))
const MobileIncomingInspection = lazy(() => import('./pages/MobileIncomingInspection'))
const MobileProductInspection = lazy(() => import('./pages/MobileProductInspection'))
const MobileProcessInspection = lazy(() => import('./pages/MobileProcessInspection'))
const MobileDeviceInspection = lazy(() => import('./pages/MobileDeviceInspection'))
const MobileDeviceMaintenance = lazy(() => import('./pages/MobileDeviceMaintenance'))
const MobileExceptionReport = lazy(() => import('./pages/MobileExceptionReport'))
const MobileDeviceFault = lazy(() => import('./pages/MobileDeviceFault'))
const MobileCalibrationReminder = lazy(() => import('./pages/MobileCalibrationReminder'))
const MobileInspectionHistory = lazy(() => import('./pages/MobileInspectionHistory'))
const MobileDailyCard = lazy(() => import('./pages/MobileDailyCard'))
const MobileMicrobeInspection = lazy(() => import('./pages/MobileMicrobeInspection'))
const MobileComplaintReport = lazy(() => import('./pages/MobileComplaintReport'))
const MobileOfflineQueue = lazy(() => import('./pages/MobileOfflineQueue'))
const MobileOeeDashboard = lazy(() => import('./pages/MobileOeeDashboard'))
const MobileOrderManagement = lazy(() => import('./pages/MobileOrderManagement'))
import { MobileProfile } from './pages/MobileProfile'

function MobileLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60dvh', color: '#999', fontSize: 14,
    }}>
      加载中...
    </div>
  )
}

function MobileProtected({ children }: { children: React.ReactNode }) {
  const { currentUser, initialized } = useApp()
  if (!initialized) return <MobileLoading />
  if (!currentUser) return <Navigate to="/m/login" replace />
  return <>{children}</>
}

export default function MobileRoutes() {
  return (
    <MobileThemeProvider>
      <Routes>
        {/* 登录页 — 可公开访问；已登录用户跳到 Dashboard */}
        <Route path="/login" element={<MobileLoginOrDashboard />} />

        {/* 受保护的移动端业务路由，统一经 MobileLayout + MobileProtected */}
        <Route
          element={
            <MobileProtected>
              <MobileLayout />
            </MobileProtected>
          }
        >
          <Route path="dashboard" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileDashboard />
            </Suspense>
          } />
          {/* Batch B + C 业务页面 */}
          <Route path="process-reporting" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileProcessReporting />
            </Suspense>
          } />
          <Route path="incoming-inspection" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileIncomingInspection />
            </Suspense>
          } />
          <Route path="product-inspection" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileProductInspection />
            </Suspense>
          } />
          <Route path="process-inspection" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileProcessInspection />
            </Suspense>
          } />
          <Route path="device-inspection" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileDeviceInspection />
            </Suspense>
          } />
          <Route path="device-maintenance" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileDeviceMaintenance />
            </Suspense>
          } />
          <Route path="exception-report" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileExceptionReport />
            </Suspense>
          } />
          <Route path="device-fault" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileDeviceFault />
            </Suspense>
          } />
          <Route path="calibration-reminder" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileCalibrationReminder />
            </Suspense>
          } />
          <Route path="inspection-history" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileInspectionHistory />
            </Suspense>
          } />
          <Route path="daily-card" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileDailyCard />
            </Suspense>
          } />
          <Route path="microbe-inspection" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileMicrobeInspection />
            </Suspense>
          } />
          <Route path="complaint-report" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileComplaintReport />
            </Suspense>
          } />
          <Route path="offline-queue" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileOfflineQueue />
            </Suspense>
          } />
          <Route path="device-oee" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileOeeDashboard />
            </Suspense>
          } />
          <Route path="production-orders" element={
            <Suspense fallback={<MobileLoading />}>
              <MobileOrderManagement />
            </Suspense>
          } />
          <Route path="profile" element={<MobileProfile />} />
        </Route>

        {/* 兜底：/m 根 → /m/dashboard */}
        <Route path="" element={<Navigate to="/m/dashboard" replace />} />
      </Routes>
    </MobileThemeProvider>
  )
}

function MobileLoginOrDashboard() {
  const { currentUser, initialized } = useApp()
  if (!initialized) return <MobileLoading />
  return currentUser
    ? <Navigate to="/m/dashboard" replace />
    : <MobileLogin />
}
