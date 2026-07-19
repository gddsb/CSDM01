import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { TabBar } from 'antd-mobile'
import {
  AppOutline,
  UnorderedListOutline,
  SetOutline,
  MessageOutline,
  UserOutline,
} from 'antd-mobile-icons'
import { useApp } from '../contexts/AppContext'
import api from '../utils/api'
import './mobile.css'

const SYSTEM_VERSION = 'V1.0.1.1'

const tabs = [
  { key: '/mobile/orders', title: '工单', icon: <UnorderedListOutline /> },
  { key: '/mobile/device', title: '设备', icon: <SetOutline /> },
  { key: '/mobile/home', title: '首页', icon: <AppOutline /> },
  { key: '/mobile/messages', title: '消息', icon: <MessageOutline /> },
  { key: '/mobile/profile', title: '我的', icon: <UserOutline /> },
]

export default function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, systemConfig, loadSystemConfig } = useApp()
  const [activeKey, setActiveKey] = useState('/mobile/home')

  // 根据当前路径匹配底部 Tab
  useEffect(() => {
    const matched = tabs.find(t => location.pathname === t.key || location.pathname.startsWith(t.key + '/'))
    if (matched) setActiveKey(matched.key)
  }, [location.pathname])

  // 加载系统配置（用于顶部显示系统名称）
  useEffect(() => {
    if (!systemConfig.system_name) loadSystemConfig()
  }, [systemConfig.system_name, loadSystemConfig])

  const handleTabChange = (key) => {
    setActiveKey(key)
    navigate(key)
  }

  const systemName = systemConfig.system_name || 'MES工作台'

  return (
    <div className="mobile-shell">
      {/* 顶部信息区：MES工作台 + 系统版本，始终固定 */}
      <header className="mobile-header">
        <div className="mobile-header-title">
          <span className="mobile-header-name">{systemName}</span>
          <span className="mobile-header-version">{SYSTEM_VERSION}</span>
        </div>
        <div className="mobile-header-user">
          <UserOutline fontSize={16} />
          <span style={{ marginLeft: 4 }}>{currentUser?.real_name || currentUser?.username || '-'}</span>
        </div>
      </header>

      {/* 中部功能区：所有操作在此完成，顶部和底部始终不变 */}
      <main className="mobile-content">
        <Outlet />
      </main>

      {/* 底部菜单区：工单 / 设备 / 首页 / 消息 / 我的 */}
      <footer className="mobile-footer">
        <TabBar activeKey={activeKey} onChange={handleTabChange} safeArea>
          {tabs.map(tab => (
            <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
          ))}
        </TabBar>
      </footer>
    </div>
  )
}
