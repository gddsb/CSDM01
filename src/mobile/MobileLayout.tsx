import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { TabBar, Badge, Avatar } from 'antd-mobile'
import {
  AppOutline,
  UnorderedListOutline,
  SetOutline,
  MessageOutline,
  UserOutline,
  BellOutline,
} from 'antd-mobile-icons'
import { useApp } from '../contexts/AppContext'
import { useTodoStats } from '../hooks/useTodoStats'
import api from '../utils/api'
import './mobile.css'

declare const __APP_VERSION__: string
const SYSTEM_VERSION = `V${__APP_VERSION__}`

const tabs = [
  { key: '/mobile/bigscreen', title: '看板', icon: <UnorderedListOutline /> },
  { key: '/mobile/device', title: '设备', icon: <SetOutline /> },
  { key: '/mobile/home', title: '首页', icon: <AppOutline /> },
  { key: '/mobile/messages', title: '消息', icon: <MessageOutline /> },
  { key: '/mobile/profile', title: '我的', icon: <UserOutline /> },
]

export default function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, systemConfig, loadSystemConfig } = useApp()
  const { stats } = useTodoStats()
  const [activeKey, setActiveKey] = useState('/mobile/home')

  useEffect(() => {
    const matched = tabs.find(t => location.pathname === t.key || location.pathname.startsWith(t.key + '/'))
    if (matched) setActiveKey(matched.key)
  }, [location.pathname])

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
      <header className="mobile-header">
        <div className="mobile-header-left">
          <div className="mobile-header-logo">
            <span className="mobile-header-logo-en">DM</span>
          </div>
          <div className="mobile-header-brand">
            <div className="mobile-header-system">{systemName}</div>
            <div className="mobile-header-ver">{SYSTEM_VERSION}</div>
          </div>
        </div>
        <div className="mobile-header-right">
          <div
            className="mobile-header-icon"
            onClick={() => navigate('/mobile/messages')}
          >
            <Badge content={stats.total > 0 ? (stats.total > 99 ? '99+' : stats.total) : null}>
              <BellOutline fontSize={20} />
            </Badge>
          </div>
          <div
            className="mobile-header-avatar"
            onClick={() => navigate('/mobile/profile')}
          >
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="" />
            ) : (
              <UserOutline fontSize={18} />
            )}
          </div>
        </div>
      </header>

      <main className="mobile-content">
        <Outlet />
      </main>

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
