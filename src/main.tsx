import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './styles/global.css'
import { AppProvider, useApp } from './contexts/AppContext'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/system/UserManagement'
import RoleManagement from './pages/system/RoleManagement'
import DataDictionary from './pages/system/DataDictionary'
import OperationLogs from './pages/system/OperationLogs'
import SystemConfig from './pages/system/SystemConfig'
import MaterialManagement from './pages/basic/MaterialManagement'
import ProductionLine from './pages/basic/ProductionLine'
import ProcessManagement from './pages/basic/ProcessManagement'
import DeviceManagement from './pages/basic/DeviceManagement'
import DefectManagement from './pages/basic/DefectManagement'
import CustomerManagement from './pages/basic/CustomerManagement'
import NumberRuleManagement from './pages/basic/NumberRuleManagement'
import MenuManagement from './pages/system/MenuManagement'
import OrderManagement from './pages/production/OrderManagement'
import ProcessReporting from './pages/production/ProcessReporting'
import InspectionStandard from './pages/quality/InspectionStandard'
import IncomingInspection from './pages/quality/IncomingInspection'
import ProcessInspection from './pages/quality/ProcessInspection'
import FinishedInspection from './pages/quality/FinishedInspection'
import MicrobeInspection from './pages/quality/MicrobeInspection'
import EnvironmentInspection from './pages/quality/EnvironmentInspection'
import ComplaintManagement from './pages/quality/ComplaintManagement'
import SupplierComplaint from './pages/quality/SupplierComplaint'
import InstrumentManagement from './pages/quality/InstrumentManagement'
import DeviceArchive from './pages/device/DeviceManagement'
import CheckRecord from './pages/device/CheckRecord'
import Maintenance from './pages/device/Maintenance'
import DeviceOEE from './pages/device/DeviceOEE'
import ProductionReport from './pages/report/ProductionReport'
import QualityReport from './pages/report/QualityReport'
import ExceptionReport from './pages/report/ExceptionReport'
import DailyReport from './pages/report/DailyReport'
import MonthlyReport from './pages/report/MonthlyReport'
import EfficiencyReport from './pages/report/EfficiencyReport'
import ProductionBigScreen from './pages/bigscreen/ProductionBigScreen'
import ManagementBigScreen from './pages/bigscreen/ManagementBigScreen'
import QualityBigScreen from './pages/bigscreen/QualityBigScreen'
import MobileRoutes from './mobile/MobileRoutes'

dayjs.locale('zh-cn')

function ProtectedRoute({ children }) {
  const { currentUser, initialized } = useApp()
  if (!initialized) return null
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { currentUser, initialized } = useApp()
  const location = useLocation()
  if (!initialized) return null
  // 移动端独立路由（不进入 PC 端 MainLayout）
  if (location.pathname.startsWith('/mobile')) {
    return <MobileRoutes />
  }
  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/dashboard" replace /> : <Login />} />
      {/* 大屏路由 - 独立全屏页面 */}
      <Route path="/bigscreen/production" element={<ProtectedRoute><ProductionBigScreen /></ProtectedRoute>} />
      <Route path="/bigscreen/management" element={<ProtectedRoute><ManagementBigScreen /></ProtectedRoute>} />
      <Route path="/bigscreen/quality" element={<ProtectedRoute><QualityBigScreen /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard-bigscreen" element={<Dashboard />} />
        <Route path="/system/users" element={<UserManagement />} />
        <Route path="/system/roles" element={<RoleManagement />} />
        <Route path="/system/menus" element={<MenuManagement />} />
        <Route path="/system/dictionary" element={<DataDictionary />} />
        <Route path="/system/config" element={<SystemConfig />} />
        <Route path="/system/logs" element={<OperationLogs />} />
        <Route path="/basic/materials" element={<MaterialManagement />} />
        <Route path="/basic/lines" element={<ProductionLine />} />
        <Route path="/basic/processes" element={<ProcessManagement />} />
        <Route path="/basic/devices" element={<DeviceManagement />} />
        <Route path="/basic/defects" element={<DefectManagement />} />
        <Route path="/basic/customers" element={<CustomerManagement />} />
        <Route path="/basic/number-rules" element={<NumberRuleManagement />} />
        <Route path="/production/orders" element={<OrderManagement />} />
        <Route path="/production/reporting" element={<ProcessReporting />} />
        <Route path="/quality/standards" element={<InspectionStandard />} />
        <Route path="/quality/incoming" element={<IncomingInspection />} />
        <Route path="/quality/process" element={<ProcessInspection />} />
        <Route path="/quality/finished" element={<FinishedInspection />} />
        <Route path="/quality/microbe" element={<MicrobeInspection />} />
        <Route path="/quality/environment" element={<EnvironmentInspection />} />
        <Route path="/quality/complaints" element={<ComplaintManagement />} />
        <Route path="/quality/supplier" element={<SupplierComplaint />} />
        <Route path="/quality/instruments" element={<InstrumentManagement />} />
        <Route path="/device/list" element={<DeviceArchive />} />
        <Route path="/device/check-records" element={<CheckRecord />} />
        <Route path="/device/maintenance" element={<Maintenance />} />
        <Route path="/device/oee" element={<DeviceOEE />} />
        <Route path="/report/daily" element={<DailyReport />} />
        <Route path="/report/monthly" element={<MonthlyReport />} />
        <Route path="/report/efficiency" element={<EfficiencyReport />} />
        <Route path="/report/production" element={<ProductionReport />} />
        <Route path="/report/quality" element={<QualityReport />} />
        <Route path="/report/exception" element={<ExceptionReport />} />
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

function AppInner({ setMessageApi, setModalApi, setNotificationApi }) {
  const { message, modal, notification } = AntdApp.useApp()
  useEffect(() => {
    setMessageApi(message)
    setModalApi(modal)
    setNotificationApi(notification)
  }, [message, modal, notification, setMessageApi, setModalApi, setNotificationApi])
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
)
