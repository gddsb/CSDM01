import React, { useEffect, Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ConfigProvider, Spin, theme as antdTheme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './styles/global.css'
import './mobile/styles/mobile.css' // 移动端全局样式（有 html.mobile-root 前缀，不影响 PC）
import { initStatusBarHeight } from './mobile/utils/safe-area'
import MobileRoutes from './mobile/routes'
import { DeviceEntryRedirect, isMobilePath } from './mobile/DeviceEntryRedirect'
import { AppProvider, useApp } from './contexts/AppContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import MainLayout from './layouts/MainLayout'
import ErrorBoundary from './components/ErrorBoundary'
import PermissionGate from './components/PermissionGate'
import { DeviceProvider, useDevice, isRouteAllowed, isInNativeShell } from './adapter'
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

// 启动时探测状态栏高度：原生插件 → env() 估测 → 24px 兜底
// 在 React 渲染前调用，让 CSS --sat 变量在首屏 paint 就有正确值
void initStatusBarHeight()

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
  // ⚠️ 不能用 !!window.Capacitor —— Vite 打包后它在 Web 环境也存在，必须用 isNativePlatform()
  const inCapacitorShell = isInNativeShell()
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

      {/* 大屏路由（Web / 平板 / 手机 / PDA 仍可访问） —— 需要登录，无权限守卫 */}
      <Route path="/bigscreen/production" element={<ProtectedRoute>{lazyPage(<ProductionBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/management" element={<ProtectedRoute>{lazyPage(<ManagementBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/quality" element={<ProtectedRoute>{lazyPage(<QualityBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/environment" element={<ProtectedRoute>{lazyPage(<EnvironmentBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/energy" element={<ProtectedRoute>{lazyPage(<EnergyBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/display" element={<ProtectedRoute>{lazyPage(<DisplayBigScreen />)}</ProtectedRoute>} />

      {/* 打印路由 — 直接访问，无需权限守卫 */}
      <Route path="/device/maintenance/print" element={<ProtectedRoute><DeviceMaintenancePrint /></ProtectedRoute>} />

      {/* 主布局 + 所有业务路由 — 统一经 DeviceAwareGuard 做设备路由屏蔽 + PermissionGate 做权限守卫 */}
      <Route path="/" element={<DeviceAwareGuard><MainLayout /></DeviceAwareGuard>}>
        {/* Dashboard — 所有登录用户可访问 */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard-bigscreen" element={<Dashboard />} />

        {/* —— system/* 系统管理 —— DeviceAwareGuard 在非 Web 端（含 TV）自动屏蔽 —— */}
        <Route path="/system/users" element={lazyPage(<PermissionGate permCode="system:user"><UserManagement /></PermissionGate>)} />
        <Route path="/system/roles" element={lazyPage(<PermissionGate permCode="system:role"><RoleManagement /></PermissionGate>)} />
        <Route path="/system/menus" element={lazyPage(<PermissionGate permCode="system:menu"><MenuManagement /></PermissionGate>)} />
        <Route path="/system/dictionary" element={lazyPage(<PermissionGate permCode="system:dict"><DataDictionary /></PermissionGate>)} />
        <Route path="/system/config" element={<Navigate to="/system/config/params" replace />} />
        <Route path="/system/config/params" element={lazyPage(<PermissionGate permCode="system:config"><ConfigParams /></PermissionGate>)} />
        <Route path="/system/config/env" element={lazyPage(<PermissionGate permCode="system:config"><ConfigEnv /></PermissionGate>)} />
        <Route path="/system/config/db" element={lazyPage(<PermissionGate permCode="system:config"><ConfigDb /></PermissionGate>)} />
        <Route path="/system/config/backup" element={lazyPage(<PermissionGate permCode="system:config"><ConfigBackup /></PermissionGate>)} />
        <Route path="/system/config/files" element={lazyPage(<PermissionGate permCode="system:config"><ConfigFiles /></PermissionGate>)} />
        <Route path="/system/logs" element={lazyPage(<PermissionGate permCode="system:log"><OperationLogs /></PermissionGate>)} />
        <Route path="/system/system-logs" element={lazyPage(<PermissionGate permCode="system:system-log"><SystemLogs /></PermissionGate>)} />

        {/* —— basic —— */}
        <Route path="/basic/materials" element={lazyPage(<PermissionGate permCode="basic:material"><MaterialManagement /></PermissionGate>)} />
        <Route path="/basic/lines" element={lazyPage(<PermissionGate permCode="basic:line"><ProductionLine /></PermissionGate>)} />
        <Route path="/basic/processes" element={lazyPage(<PermissionGate permCode="basic:process"><ProcessManagement /></PermissionGate>)} />
        <Route path="/basic/devices" element={lazyPage(<PermissionGate permCode="device:list"><DeviceManagement /></PermissionGate>)} />
        <Route path="/basic/defects" element={lazyPage(<PermissionGate permCode="basic:defect"><DefectManagement /></PermissionGate>)} />
        <Route path="/basic/customers" element={lazyPage(<PermissionGate permCode="basic:customer"><CustomerManagement /></PermissionGate>)} />
        <Route path="/basic/suppliers" element={lazyPage(<PermissionGate permCode="basic:supplier"><SupplierManagement /></PermissionGate>)} />
        <Route path="/basic/number-rules" element={lazyPage(<PermissionGate permCode="basic:number-rule"><NumberRuleManagement /></PermissionGate>)} />

        {/* —— production —— */}
        <Route path="/production/orders" element={lazyPage(<PermissionGate permCode="production:order"><OrderManagement /></PermissionGate>)} />
        <Route path="/production/reporting" element={lazyPage(<PermissionGate permCode="production:reporting"><ProcessReporting /></PermissionGate>)} />

        {/* —— quality —— */}
        <Route path="/quality/standards" element={lazyPage(<PermissionGate permCode="quality:standard"><InspectionStandard /></PermissionGate>)} />
        <Route path="/quality/standards/new" element={lazyPage(<PermissionGate permCode="quality:standard"><InspectionStandardForm /></PermissionGate>)} />
        <Route path="/quality/standards/:id/edit" element={lazyPage(<PermissionGate permCode="quality:standard"><InspectionStandardForm /></PermissionGate>)} />
        <Route path="/quality/incoming" element={lazyPage(<PermissionGate permCode="quality:incoming"><IncomingInspection /></PermissionGate>)} />
        <Route path="/quality/process" element={lazyPage(<PermissionGate permCode="quality:process"><ProcessInspection /></PermissionGate>)} />
        <Route path="/quality/product" element={lazyPage(<PermissionGate permCode="quality:product"><ProductInspection /></PermissionGate>)} />
        <Route path="/quality/microbe" element={lazyPage(<PermissionGate permCode="quality:microbe"><MicrobeInspection /></PermissionGate>)} />
        <Route path="/quality/environment" element={lazyPage(<PermissionGate permCode="quality:environment"><EnvironmentInspection /></PermissionGate>)} />
        <Route path="/quality/complaints" element={lazyPage(<PermissionGate permCode="quality:complaint"><ComplaintManagement /></PermissionGate>)} />
        <Route path="/quality/supplier" element={lazyPage(<PermissionGate permCode="quality:complaint:supplier"><SupplierComplaint /></PermissionGate>)} />
        <Route path="/quality/instruments" element={lazyPage(<PermissionGate permCode="quality:instrument"><InstrumentManagement /></PermissionGate>)} />

        {/* —— device —— */}
        <Route path="/device/list" element={lazyPage(<PermissionGate permCode="device:list"><DeviceArchive /></PermissionGate>)} />
        <Route path="/device/oee" element={lazyPage(<PermissionGate permCode="device:oee"><DeviceOEE /></PermissionGate>)} />
        <Route path="/device/fault" element={lazyPage(<PermissionGate permCode="device:fault"><DeviceFault /></PermissionGate>)} />
        <Route path="/device/maintenance" element={lazyPage(<PermissionGate permCode="device:maintenance"><DeviceMaintenanceUnified /></PermissionGate>)} />
        <Route path="/device/maintenance-history" element={lazyPage(<PermissionGate permCode="device:maintenance"><DeviceMaintenanceHistory /></PermissionGate>)} />
        <Route path="/device/maintenance-standard" element={lazyPage(<PermissionGate permCode="device:maintenance"><DeviceMaintenanceStandardList /></PermissionGate>)} />
        <Route path="/device/maintenance-standard/:deviceId" element={lazyPage(<PermissionGate permCode="device:maintenance"><DeviceMaintenanceStandardDetail /></PermissionGate>)} />
        <Route path="/device/maintenance/matrix" element={lazyPage(<PermissionGate permCode="device:maintenance"><DeviceMaintenanceMatrix /></PermissionGate>)} />
        <Route path="/device/spare-parts" element={lazyPage(<PermissionGate permCode="device:spare-part"><DeviceSparePart /></PermissionGate>)} />
        <Route path="/device/calibration" element={lazyPage(<PermissionGate permCode="device:calibration"><DeviceCalibration /></PermissionGate>)} />
        <Route path="/device/documents" element={lazyPage(<PermissionGate permCode="device:document"><DeviceDocumentPage /></PermissionGate>)} />
        <Route path="/device/dashboard" element={lazyPage(<PermissionGate permCode="device:dashboard"><DeviceDashboard /></PermissionGate>)} />

        {/* —— report —— */}
        <Route path="/report/daily" element={lazyPage(<PermissionGate permCode="report:daily"><DailyReport /></PermissionGate>)} />
        <Route path="/report/monthly" element={lazyPage(<PermissionGate permCode="report:monthly"><MonthlyReport /></PermissionGate>)} />
        <Route path="/report/efficiency" element={lazyPage(<PermissionGate permCode="report:efficiency"><EfficiencyReport /></PermissionGate>)} />
        <Route path="/report/production" element={lazyPage(<PermissionGate permCode="report:production"><ProductionReport /></PermissionGate>)} />
        <Route path="/report/quality" element={lazyPage(<PermissionGate permCode="report:quality"><QualityReport /></PermissionGate>)} />
        <Route path="/report/exception" element={lazyPage(<PermissionGate permCode="report:exception"><ExceptionReport /></PermissionGate>)} />

        {/* —— auto/* 自动任务 —— DeviceAwareGuard 在非 Web 端自动屏蔽 —— */}
        <Route path="/auto/task-settings" element={lazyPage(<PermissionGate permCode="auto:task-setting"><TaskSettingsPage /></PermissionGate>)} />
        <Route path="/auto/scheduled-tasks" element={lazyPage(<PermissionGate permCode="auto:scheduled-task"><ScheduledTaskPage /></PermissionGate>)} />
        <Route path="/auto/task-logs" element={lazyPage(<PermissionGate permCode="auto:task-log"><TaskLogPage /></PermissionGate>)} />
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
  return useAppUpdate(/* enabled */ isInNativeShell())
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
