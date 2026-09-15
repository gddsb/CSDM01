import React, { useEffect, Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ConfigProvider, Spin, theme as antdTheme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './styles/global.css'
import './mobile/styles/mobile.css' // 移动端全局样式（有 html.mobile-root 前缀，不影响 PC）
import MobileRoutes from './mobile/routes'
import { DeviceEntryRedirect, isMobilePath } from './mobile/DeviceEntryRedirect'
import { AppProvider, useApp } from './contexts/AppContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import MainLayout from './layouts/MainLayout'
import ErrorBoundary from './components/ErrorBoundary'
import { DeviceProvider, useDevice, isRouteAllowed } from './adapter'
import { useAppUpdate } from './adapter/update'

// 首屏关键页面同步加载（避免白屏）
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// 业务页面按模块懒加载，自动代码分割
const UserManagement = lazy(() => import('./pages/system/UserManagement'))
const RoleManagement = lazy(() => import('./pages/system/RoleManagement'))
const DataDictionary = lazy(() => import('./pages/system/DataDictionary'))
const OperationLogs = lazy(() => import('./pages/system/OperationLogs'))
const SystemLogs = lazy(() => import('./pages/system/SystemLogs'))
const ConfigParams = lazy(() => import('./pages/system/config-pages/ParamsConfigPage'))
const ConfigEnv = lazy(() => import('./pages/system/config-pages/EnvConfigPage'))
const ConfigDb = lazy(() => import('./pages/system/config-pages/DbConfigPage'))
const ConfigBackup = lazy(() => import('./pages/system/config-pages/BackupConfigPage'))
const ConfigFiles = lazy(() => import('./pages/system/config-pages/FilesConfigPage'))
const MenuManagement = lazy(() => import('./pages/system/MenuManagement'))
const MaterialManagement = lazy(() => import('./pages/basic/MaterialManagement'))
const ProductionLine = lazy(() => import('./pages/basic/ProductionLine'))
const ProcessManagement = lazy(() => import('./pages/basic/ProcessManagement'))
const DeviceManagement = lazy(() => import('./pages/basic/DeviceManagement'))
const DefectManagement = lazy(() => import('./pages/basic/DefectManagement'))
const CustomerManagement = lazy(() => import('./pages/basic/CustomerManagement'))
const SupplierManagement = lazy(() => import('./pages/basic/SupplierManagement'))
const NumberRuleManagement = lazy(() => import('./pages/basic/NumberRuleManagement'))
const OrderManagement = lazy(() => import('./pages/production/OrderManagement'))
const ProcessReporting = lazy(() => import('./pages/production/ProcessReporting'))
const InspectionStandard = lazy(() => import('./pages/quality/InspectionStandard'))
const InspectionStandardForm = lazy(() => import('./pages/quality/InspectionStandardForm'))
const IncomingInspection = lazy(() => import('./pages/quality/IncomingInspection'))
const ProductInspection = lazy(() => import('./pages/quality/ProductInspection'))
const ProcessInspection = lazy(() => import('./pages/quality/ProcessInspection'))
const MicrobeInspection = lazy(() => import('./pages/quality/MicrobeInspection'))
const EnvironmentInspection = lazy(() => import('./pages/quality/EnvironmentInspection'))
const ComplaintManagement = lazy(() => import('./pages/quality/ComplaintManagement'))
const SupplierComplaint = lazy(() => import('./pages/quality/SupplierComplaint'))
const InstrumentManagement = lazy(() => import('./pages/quality/InstrumentManagement'))
const DeviceArchive = lazy(() => import('./pages/device/DeviceManagement'))
const DeviceOEE = lazy(() => import('./pages/device/DeviceOEE'))
const DeviceFault = lazy(() => import('./pages/device/DeviceFault'))
const DeviceMaintenanceUnified = lazy(() => import('./pages/device/DeviceMaintenanceUnified'))
const DeviceMaintenanceHistory = lazy(() => import('./pages/device/DeviceMaintenanceHistory'))
const DeviceMaintenanceMatrix = lazy(() => import('./pages/device/DeviceMaintenanceMatrix'))
const DeviceMaintenancePrint = lazy(() => import('./pages/device/DeviceMaintenancePrint'))
const DeviceMaintenanceStandardList = lazy(() => import('./pages/device/DeviceMaintenanceStandardList'))
const DeviceMaintenanceStandardDetail = lazy(() => import('./pages/device/DeviceMaintenanceStandardDetail'))
const DeviceSparePart = lazy(() => import('./pages/device/DeviceSparePart'))
const DeviceCalibration = lazy(() => import('./pages/device/DeviceCalibration'))
const DeviceDocumentPage = lazy(() => import('./pages/device/DeviceDocument'))
const DeviceDashboard = lazy(() => import('./pages/device/DeviceDashboard'))
const ProductionReport = lazy(() => import('./pages/report/ProductionReport'))
const QualityReport = lazy(() => import('./pages/report/QualityReport'))
const ExceptionReport = lazy(() => import('./pages/report/ExceptionReport'))
const DailyReport = lazy(() => import('./pages/report/DailyReport'))
const MonthlyReport = lazy(() => import('./pages/report/MonthlyReport'))
const EfficiencyReport = lazy(() => import('./pages/report/EfficiencyReport'))
const ProductionBigScreen = lazy(() => import('./pages/bigscreen/ProductionBigScreen'))
const ManagementBigScreen = lazy(() => import('./pages/bigscreen/ManagementBigScreen'))
const QualityBigScreen = lazy(() => import('./pages/bigscreen/QualityBigScreen'))
const EnvironmentBigScreen = lazy(() => import('./pages/bigscreen/EnvironmentBigScreen'))
const EnergyBigScreen = lazy(() => import('./pages/bigscreen/EnergyBigScreen'))
const DisplayBigScreen = lazy(() => import('./pages/bigscreen/DisplayBigScreen'))
const TaskSettingsPage = lazy(() => import('./pages/auto/TaskSettingsPage'))
const TaskLogPage = lazy(() => import('./pages/auto/TaskLogPage'))
const ScheduledTaskPage = lazy(() => import('./pages/auto/ScheduledTaskPage'))

dayjs.locale('zh-cn')

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 240 }}>
      <Spin size="large" tip="加载中..." />
    </div>
  )
}

function lazyPage(node: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>
}

/**
 * 设备感知的登录守卫
 * - TV 端：跳过登录（capability.skipLogin = true）
 * - 其他端：要求 currentUser 存在
 * - 路由被设备屏蔽（如 TV 访问 /system 或手机访问 /tv/*）：重定向到首页
 */
function DeviceAwareGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, initialized } = useApp()
  const { type, capability } = useDevice()
  const location = useLocation()

  if (!initialized) return null

  // 检查路由在当前设备上是否允许（TV 只允许 /tv 和少量 public；移动端屏蔽 system/auto）
  if (!isRouteAllowed(location.pathname, type)) {
    // TV 端重定向到 TV 大屏；其他端重定向到 Dashboard
    const redirect = type === 'tv' ? '/tv/display' : '/dashboard'
    return <Navigate to={redirect} replace />
  }

  // TV 端跳过登录
  if (capability.skipLogin) return <>{children}</>

  // 普通登录守卫
  if (!currentUser) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, initialized } = useApp()
  if (!initialized) return null
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { currentUser, initialized } = useApp()
  const { type, capability } = useDevice()
  const location = useLocation()
  if (!initialized) return null

  // TV 端：访问根路径直接跳到 TV 大屏
  const isTv = type === 'tv'

  // 是否在 Capacitor 原生壳内（只有壳内才自动跳转移动端路由）
  const inCapacitorShell = typeof window !== 'undefined' && (
    (window as any).Capacitor || /capacitor/i.test(navigator.userAgent)
  )
  const forceMobileOverride = typeof window !== 'undefined' && (
    window.location.search.toLowerCase().includes('mobile=1') ||
    window.location.hash.toLowerCase().includes('mobile=1')
  )
  const shouldUseMobile = inCapacitorShell || forceMobileOverride

  // 设备入口自动跳转（只看壳环境，不看 useDevice 类型 —— 避免 localStorage 缓存误判）
  if (shouldUseMobile && !isMobilePath(location.pathname)) {
    return <Navigate to="/m/dashboard" replace />
  }
  if (!shouldUseMobile && isMobilePath(location.pathname)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Routes>
      {/* 登录页 — TV 端跳过 */}
      <Route
        path="/login"
        element={capability.skipLogin
          ? <Navigate to="/tv/display" replace />
          : currentUser ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* —— TV 端专属路由前缀 /tv/* —— 直接展示，跳过登录，无任何交互控件 —— */}
      <Route path="/tv" element={<Navigate to="/tv/display" replace />} />
      <Route path="/tv/display" element={<DeviceAwareGuard>{lazyPage(<DisplayBigScreen />)}</DeviceAwareGuard>} />
      <Route path="/tv/production" element={<DeviceAwareGuard>{lazyPage(<ProductionBigScreen />)}</DeviceAwareGuard>} />
      <Route path="/tv/quality" element={<DeviceAwareGuard>{lazyPage(<QualityBigScreen />)}</DeviceAwareGuard>} />
      <Route path="/tv/environment" element={<DeviceAwareGuard>{lazyPage(<EnvironmentBigScreen />)}</DeviceAwareGuard>} />
      <Route path="/tv/energy" element={<DeviceAwareGuard>{lazyPage(<EnergyBigScreen />)}</DeviceAwareGuard>} />
      <Route path="/tv/management" element={<DeviceAwareGuard>{lazyPage(<ManagementBigScreen />)}</DeviceAwareGuard>} />

      {/* 大屏路由（Web / 平板 / 手机 / PDA 仍可访问） —— 需要登录 */}
      <Route path="/bigscreen/production" element={<ProtectedRoute>{lazyPage(<ProductionBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/management" element={<ProtectedRoute>{lazyPage(<ManagementBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/quality" element={<ProtectedRoute>{lazyPage(<QualityBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/environment" element={<ProtectedRoute>{lazyPage(<EnvironmentBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/energy" element={<ProtectedRoute>{lazyPage(<EnergyBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/display" element={<ProtectedRoute>{lazyPage(<DisplayBigScreen />)}</ProtectedRoute>} />

      {/* 打印路由 */}
      <Route path="/device/maintenance/print" element={<ProtectedRoute><DeviceMaintenancePrint /></ProtectedRoute>} />

      {/* 主布局 + 所有业务路由 — 统一经 DeviceAwareGuard 做设备路由屏蔽 */}
      <Route path="/" element={<DeviceAwareGuard><MainLayout /></DeviceAwareGuard>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard-bigscreen" element={<Dashboard />} />
        {/* —— system/* 系统管理 —— DeviceAwareGuard 会在非 Web 端（含 TV）自动屏蔽 —— */}
        <Route path="/system/users" element={lazyPage(<UserManagement />)} />
        <Route path="/system/roles" element={lazyPage(<RoleManagement />)} />
        <Route path="/system/menus" element={lazyPage(<MenuManagement />)} />
        <Route path="/system/dictionary" element={lazyPage(<DataDictionary />)} />
        <Route path="/system/config" element={<Navigate to="/system/config/params" replace />} />
        <Route path="/system/config/params" element={lazyPage(<ConfigParams />)} />
        <Route path="/system/config/env" element={lazyPage(<ConfigEnv />)} />
        <Route path="/system/config/db" element={lazyPage(<ConfigDb />)} />
        <Route path="/system/config/backup" element={lazyPage(<ConfigBackup />)} />
        <Route path="/system/config/files" element={lazyPage(<ConfigFiles />)} />
        <Route path="/system/logs" element={lazyPage(<OperationLogs />)} />
        <Route path="/system/system-logs" element={lazyPage(<SystemLogs />)} />
        {/* —— basic —— */}
        <Route path="/basic/materials" element={lazyPage(<MaterialManagement />)} />
        <Route path="/basic/lines" element={lazyPage(<ProductionLine />)} />
        <Route path="/basic/processes" element={lazyPage(<ProcessManagement />)} />
        <Route path="/basic/devices" element={lazyPage(<DeviceManagement />)} />
        <Route path="/basic/defects" element={lazyPage(<DefectManagement />)} />
        <Route path="/basic/customers" element={lazyPage(<CustomerManagement />)} />
        <Route path="/basic/suppliers" element={lazyPage(<SupplierManagement />)} />
        <Route path="/basic/number-rules" element={lazyPage(<NumberRuleManagement />)} />
        {/* —— production —— */}
        <Route path="/production/orders" element={lazyPage(<OrderManagement />)} />
        <Route path="/production/reporting" element={lazyPage(<ProcessReporting />)} />
        {/* —— quality —— */}
        <Route path="/quality/standards" element={lazyPage(<InspectionStandard />)} />
        <Route path="/quality/standards/new" element={lazyPage(<InspectionStandardForm />)} />
        <Route path="/quality/standards/:id/edit" element={lazyPage(<InspectionStandardForm />)} />
        <Route path="/quality/incoming" element={lazyPage(<IncomingInspection />)} />
        <Route path="/quality/process" element={lazyPage(<ProcessInspection />)} />
        <Route path="/quality/product" element={lazyPage(<ProductInspection />)} />
        <Route path="/quality/microbe" element={lazyPage(<MicrobeInspection />)} />
        <Route path="/quality/environment" element={lazyPage(<EnvironmentInspection />)} />
        <Route path="/quality/complaints" element={lazyPage(<ComplaintManagement />)} />
        <Route path="/quality/supplier" element={lazyPage(<SupplierComplaint />)} />
        <Route path="/quality/instruments" element={lazyPage(<InstrumentManagement />)} />
        {/* —— device —— */}
        <Route path="/device/list" element={lazyPage(<DeviceArchive />)} />
        <Route path="/device/oee" element={lazyPage(<DeviceOEE />)} />
        <Route path="/device/fault" element={lazyPage(<DeviceFault />)} />
        <Route path="/device/maintenance" element={lazyPage(<DeviceMaintenanceUnified />)} />
        <Route path="/device/maintenance-history" element={lazyPage(<DeviceMaintenanceHistory />)} />
        <Route path="/device/maintenance-standard" element={lazyPage(<DeviceMaintenanceStandardList />)} />
        <Route path="/device/maintenance-standard/:deviceId" element={lazyPage(<DeviceMaintenanceStandardDetail />)} />
        <Route path="/device/maintenance/matrix" element={lazyPage(<DeviceMaintenanceMatrix />)} />
        <Route path="/device/spare-parts" element={lazyPage(<DeviceSparePart />)} />
        <Route path="/device/calibration" element={lazyPage(<DeviceCalibration />)} />
        <Route path="/device/documents" element={lazyPage(<DeviceDocumentPage />)} />
        <Route path="/device/dashboard" element={lazyPage(<DeviceDashboard />)} />
        {/* —— report —— */}
        <Route path="/report/daily" element={lazyPage(<DailyReport />)} />
        <Route path="/report/monthly" element={lazyPage(<MonthlyReport />)} />
        <Route path="/report/efficiency" element={lazyPage(<EfficiencyReport />)} />
        <Route path="/report/production" element={lazyPage(<ProductionReport />)} />
        <Route path="/report/quality" element={lazyPage(<QualityReport />)} />
        <Route path="/report/exception" element={lazyPage(<ExceptionReport />)} />
        {/* —— auto/* 自动任务 —— DeviceAwareGuard 在非 Web 端自动屏蔽 —— */}
        <Route path="/auto/task-settings" element={lazyPage(<TaskSettingsPage />)} />
        <Route path="/auto/scheduled-tasks" element={lazyPage(<ScheduledTaskPage />)} />
        <Route path="/auto/task-logs" element={lazyPage(<TaskLogPage />)} />
      </Route>

      {/* —— 移动端路由子树（antd-mobile，独立 ConfigProvider）—— */}
      <Route path="/m/*" element={<MobileRoutes />} />

      {/* 兜底：TV 走 TV 大屏，其他端走 Dashboard */}
      <Route path="*" element={<Navigate to={isTv ? '/tv/display' : shouldUseMobile ? '/m/dashboard' : '/dashboard'} replace />} />
    </Routes>
  )
}

function App() {
  const { themeKey, setMessageApi, setModalApi, setNotificationApi } = useApp()
  const isDark = themeKey === 'darkFactory'
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2196F3',
          borderRadius: 6,
        },
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <AntdApp>
        <AppInner setMessageApi={setMessageApi} setModalApi={setModalApi} setNotificationApi={setNotificationApi} />
      </AntdApp>
    </ConfigProvider>
  )
}

function AppInner({ setMessageApi, setModalApi, setNotificationApi }: {
  setMessageApi: (api: unknown) => void
  setModalApi: (api: unknown) => void
  setNotificationApi: (api: unknown) => void
}) {
  const { message, modal, notification } = AntdApp.useApp()
  useEffect(() => {
    setMessageApi(message)
    setModalApi(modal)
    setNotificationApi(notification)
  }, [message, modal, notification, setMessageApi, setModalApi, setNotificationApi])
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
      {/* 版本检测弹窗 — 在路由外层渲染，避免路由切换影响弹窗状态 */}
      <AppUpdateLoader />
    </BrowserRouter>
  )
}

/**
 * 版本检测独立组件：冷启动时 checkForUpdate()
 *
 * 规则（与路由重定向一致，只看 Capacitor shell，不依赖 useDevice）：
 *  - Capacitor 原生壳内（Android/iOS）→ 启用版本检测，有新版本时弹窗
 *  - PC Web 浏览器 → 不启用（避免 PC 登录时弹出"移动端版本更新"提示）
 *    Web 端的 PWA 热更新由 Service Worker 自行处理，无需此弹窗
 *  - TV 大屏 → 不启用（电视用户一般不知道怎么点下载 APK）
 */
function AppUpdateLoader() {
  const inCapacitorShell = typeof window !== 'undefined' && (
    (window as any).Capacitor || /capacitor/i.test(navigator.userAgent)
  )
  return useAppUpdate(/* enabled */ inCapacitorShell)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <DeviceProvider>
          <App />
        </DeviceProvider>
      </AppProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
