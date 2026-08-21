import React, { useEffect, Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ConfigProvider, Spin, theme as antdTheme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './styles/global.css'
import { AppProvider, useApp } from './contexts/AppContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import MainLayout from './layouts/MainLayout'
import ErrorBoundary from './components/ErrorBoundary'

// 首屏关键页面同步加载（避免白屏）
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// 业务页面按模块懒加载，自动代码分割
const UserManagement = lazy(() => import('./pages/system/UserManagement'))
const RoleManagement = lazy(() => import('./pages/system/RoleManagement'))
const DataDictionary = lazy(() => import('./pages/system/DataDictionary'))
const OperationLogs = lazy(() => import('./pages/system/OperationLogs'))
const SystemLogs = lazy(() => import('./pages/system/SystemLogs'))
const SystemConfig = lazy(() => import('./pages/system/SystemConfig'))
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
const CheckRecord = lazy(() => import('./pages/device/CheckRecord'))
const Maintenance = lazy(() => import('./pages/device/Maintenance'))
const DeviceOEE = lazy(() => import('./pages/device/DeviceOEE'))
const DeviceFault = lazy(() => import('./pages/device/DeviceFault'))
const DeviceInspection = lazy(() => import('./pages/device/DeviceInspection'))
const DeviceMaintenancePlan = lazy(() => import('./pages/device/DeviceMaintenancePlan'))
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
const DisplayBigScreen = lazy(() => import('./pages/bigscreen/DisplayBigScreen'))
const TaskSettingsPage = lazy(() => import('./pages/auto/TaskSettingsPage'))
const TaskLogPage = lazy(() => import('./pages/auto/TaskLogPage'))
const ScheduledTaskPage = lazy(() => import('./pages/auto/ScheduledTaskPage'))
const MobileRoutes = lazy(() => import('./mobile/MobileRoutes'))

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, initialized } = useApp()
  if (!initialized) return null
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { currentUser, initialized } = useApp()
  const location = useLocation()
  if (!initialized) return null

  // Capacitor 原生 App：APK/IPA 启动时默认路径为 /，自动跳转到移动端主页
  const win = window as any
  const isNative = !!(win.Capacitor && (win.Capacitor.getPlatform?.() === 'android' || win.Capacitor.getPlatform?.() === 'ios'))
  if (isNative && !location.pathname.startsWith('/mobile')) {
    return <Navigate to="/mobile/home" replace />
  }

  // 移动端独立路由（不进入 PC 端 MainLayout）
  if (location.pathname.startsWith('/mobile')) {
    return lazyPage(<MobileRoutes />)
  }
  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/dashboard" replace /> : <Login />} />
      {/* 大屏路由 - 独立全屏页面 */}
      <Route path="/bigscreen/production" element={<ProtectedRoute>{lazyPage(<ProductionBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/management" element={<ProtectedRoute>{lazyPage(<ManagementBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/quality" element={<ProtectedRoute>{lazyPage(<QualityBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/environment" element={<ProtectedRoute>{lazyPage(<EnvironmentBigScreen />)}</ProtectedRoute>} />
      <Route path="/bigscreen/display" element={<ProtectedRoute>{lazyPage(<DisplayBigScreen />)}</ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard-bigscreen" element={<Dashboard />} />
        <Route path="/system/users" element={lazyPage(<UserManagement />)} />
        <Route path="/system/roles" element={lazyPage(<RoleManagement />)} />
        <Route path="/system/menus" element={lazyPage(<MenuManagement />)} />
        <Route path="/system/dictionary" element={lazyPage(<DataDictionary />)} />
        <Route path="/system/config" element={lazyPage(<SystemConfig />)} />
        <Route path="/system/logs" element={lazyPage(<OperationLogs />)} />
        <Route path="/system/system-logs" element={lazyPage(<SystemLogs />)} />
        <Route path="/basic/materials" element={lazyPage(<MaterialManagement />)} />
        <Route path="/basic/lines" element={lazyPage(<ProductionLine />)} />
        <Route path="/basic/processes" element={lazyPage(<ProcessManagement />)} />
        <Route path="/basic/devices" element={lazyPage(<DeviceManagement />)} />
        <Route path="/basic/defects" element={lazyPage(<DefectManagement />)} />
        <Route path="/basic/customers" element={lazyPage(<CustomerManagement />)} />
        <Route path="/basic/suppliers" element={lazyPage(<SupplierManagement />)} />
        <Route path="/basic/number-rules" element={lazyPage(<NumberRuleManagement />)} />
        <Route path="/production/orders" element={lazyPage(<OrderManagement />)} />
        <Route path="/production/reporting" element={lazyPage(<ProcessReporting />)} />
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
        <Route path="/device/list" element={lazyPage(<DeviceArchive />)} />
        <Route path="/device/check-records" element={lazyPage(<CheckRecord />)} />
        <Route path="/device/maintenance" element={lazyPage(<Maintenance />)} />
        <Route path="/device/oee" element={lazyPage(<DeviceOEE />)} />
        <Route path="/device/fault" element={lazyPage(<DeviceFault />)} />
        <Route path="/device/inspection" element={lazyPage(<DeviceInspection />)} />
        <Route path="/device/maintenance-plan" element={lazyPage(<DeviceMaintenancePlan />)} />
        <Route path="/device/spare-parts" element={lazyPage(<DeviceSparePart />)} />
        <Route path="/device/calibration" element={lazyPage(<DeviceCalibration />)} />
        <Route path="/device/documents" element={lazyPage(<DeviceDocumentPage />)} />
        <Route path="/device/dashboard" element={lazyPage(<DeviceDashboard />)} />
        <Route path="/report/daily" element={lazyPage(<DailyReport />)} />
        <Route path="/report/monthly" element={lazyPage(<MonthlyReport />)} />
        <Route path="/report/efficiency" element={lazyPage(<EfficiencyReport />)} />
        <Route path="/report/production" element={lazyPage(<ProductionReport />)} />
        <Route path="/report/quality" element={lazyPage(<QualityReport />)} />
        <Route path="/report/exception" element={lazyPage(<ExceptionReport />)} />
        <Route path="/auto/task-settings" element={lazyPage(<TaskSettingsPage />)} />
        <Route path="/auto/scheduled-tasks" element={lazyPage(<ScheduledTaskPage />)} />
        <Route path="/auto/task-logs" element={lazyPage(<TaskLogPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <App />
      </AppProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
