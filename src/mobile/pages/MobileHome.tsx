import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileTextOutline,
  ProfileOutline,
  CheckShieldOutline,
  SetOutline,
  SearchOutline,
  FileSearchOutline,
  AlertOutline,
  EditSOutline,
} from 'antd-mobile-icons'
import { useApp } from '../../contexts/AppContext'
import './home.css'

// 首页菜单（仅显示图标和名称）
// 除"生产订单"和"生产报工"外，其他菜单功能后续开发（点击跳转到占位页）
const menuItems = [
  { key: '/mobile/orders', name: '生产订单', icon: <FileTextOutline />, color: '#1890ff', enabled: true },
  { key: '/mobile/reporting', name: '生产报工', icon: <ProfileOutline />, color: '#52c41a', enabled: true },
  { key: '/mobile/quality', name: '质量检验', icon: <CheckShieldOutline />, color: '#722ed1', enabled: false },
  { key: '/mobile/inspection', name: '设备巡检', icon: <SetOutline />, color: '#13c2c2', enabled: false },
  { key: '/mobile/craft', name: '工艺查询', icon: <SearchOutline />, color: '#fa8c16', enabled: false },
  { key: '/mobile/trace', name: '工单追踪', icon: <FileSearchOutline />, color: '#eb2f96', enabled: false },
  { key: '/mobile/exception', name: '异常上报', icon: <AlertOutline />, color: '#f5222d', enabled: false },
  { key: '/mobile/archive', name: '档案更新', icon: <EditSOutline />, color: '#faad14', enabled: false },
]

export default function MobileHome() {
  const navigate = useNavigate()
  const { currentUser, systemConfig } = useApp()

  return (
    <div className="mobile-page home-page">
      {/* 顶部欢迎区 */}
      <div className="home-welcome">
        <div className="home-welcome-row">
          <div className="home-welcome-name">您好，{currentUser?.real_name || currentUser?.username || '用户'}</div>
          <div className="home-welcome-company">{systemConfig.company_name || '大满乳业'}</div>
        </div>
        <div className="home-welcome-sub">欢迎使用 MES 工作台</div>
      </div>

      {/* 中部功能区上部：菜单网格 */}
      <div className="home-section-title">功能菜单</div>
      <div className="mobile-menu-grid">
        {menuItems.map(item => (
          <div
            key={item.key}
            className="mobile-menu-item"
            onClick={() => navigate(item.key)}
          >
            <div className="mobile-menu-icon" style={{ color: item.color }}>
              {item.icon}
            </div>
            <div className="mobile-menu-name">{item.name}</div>
          </div>
        ))}
      </div>

      {/* 中部功能区下部：快捷统计/最近操作区 */}
      <div className="home-section-title">快捷入口</div>
      <div className="home-quick">
        <div className="home-quick-item" onClick={() => navigate('/mobile/orders')}>
          <div className="home-quick-label">查看生产订单</div>
          <div className="home-quick-arrow">›</div>
        </div>
        <div className="home-quick-item" onClick={() => navigate('/mobile/reporting')}>
          <div className="home-quick-label">查看生产报工</div>
          <div className="home-quick-arrow">›</div>
        </div>
        <div className="home-quick-item" onClick={() => navigate('/mobile/profile')}>
          <div className="home-quick-label">个人中心</div>
          <div className="home-quick-arrow">›</div>
        </div>
      </div>
    </div>
  )
}
