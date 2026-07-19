import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import MobileLayout from './MobileLayout'
import MobileLogin from './pages/MobileLogin'
import MobileHome from './pages/MobileHome'
import OrderList from './pages/production/OrderList'
import OrderDetail from './pages/production/OrderDetail'
import ReportList from './pages/production/ReportList'
import ReportDetail from './pages/production/ReportDetail'
import PlaceholderPage from './pages/PlaceholderPage'
import ProfilePage from './pages/ProfilePage'

// 移动端鉴权路由（复用 PC 端 JWT）
function MobileProtectedRoute({ children }) {
  const { currentUser, initialized } = useApp()
  const location = useLocation()
  if (!initialized) return null
  if (!currentUser) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/mobile/login?redirect=${redirect}`} replace />
  }
  return children
}

export default function MobileRoutes() {
  return (
    <Routes>
      <Route path="/mobile/login" element={<MobileLogin />} />
      <Route path="/mobile" element={<MobileProtectedRoute><MobileLayout /></MobileProtectedRoute>}>
        <Route index element={<MobileHome />} />
        <Route path="home" element={<MobileHome />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="reporting" element={<ReportList />} />
        <Route path="reporting/:id" element={<ReportDetail />} />
        <Route path="device" element={<PlaceholderPage title="设备" />} />
        <Route path="messages" element={<PlaceholderPage title="消息" />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="quality" element={<PlaceholderPage title="质量检验" />} />
        <Route path="inspection" element={<PlaceholderPage title="设备巡检" />} />
        <Route path="craft" element={<PlaceholderPage title="工艺查询" />} />
        <Route path="trace" element={<PlaceholderPage title="工单追踪" />} />
        <Route path="exception" element={<PlaceholderPage title="异常上报" />} />
        <Route path="archive" element={<PlaceholderPage title="档案更新" />} />
      </Route>
      <Route path="*" element={<Navigate to="/mobile" replace />} />
    </Routes>
  )
}
