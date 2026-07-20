import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { TabBar } from 'antd-mobile'
import {
  AppOutline,
  UnorderedListOutline,
  SetOutline,
  MessageOutline,
  UserOutline,
  AddOutline,
  CheckOutline,
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

const DEVICE_TYPES = [
  { value: 'default', label: 'iPhone 13' },
  { value: 'iphone-se', label: 'iPhone SE' },
  { value: 'iphone-14-pro', label: 'iPhone 14 Pro' },
  { value: 'android-s', label: 'Android S' },
  { value: 'android-xl', label: 'Android XL' },
]

export default function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, systemConfig, loadSystemConfig } = useApp()
  const [activeKey, setActiveKey] = useState('/mobile/home')
  const [isLandscape, setIsLandscape] = useState(false)
  const [deviceType, setDeviceType] = useState('default')
  const [showControls, setShowControls] = useState(false)

  useEffect(() => {
    const checkDesktop = () => {
      setShowControls(window.innerWidth >= 768)
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

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

  const handleOrientationChange = () => {
    setIsLandscape(!isLandscape)
  }

  const handleDeviceChange = (e) => {
    setDeviceType(e.target.value)
  }

  const handleBackToPC = () => {
    navigate('/dashboard')
  }

  const systemName = systemConfig.system_name || 'MES工作台'

  const shellClass = `mobile-shell ${isLandscape ? 'landscape' : ''} ${deviceType !== 'default' ? deviceType : ''}`

  return (
    <>
      <div className={shellClass}>
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

      {showControls && (
        <div className="mobile-simulator-controls">
          <button
            className={`mobile-sim-btn ${!isLandscape ? 'active' : ''}`}
            onClick={handleOrientationChange}
          >
            <AddOutline fontSize={14} />
            <span>竖屏</span>
          </button>
          <button
            className={`mobile-sim-btn ${isLandscape ? 'active' : ''}`}
            onClick={handleOrientationChange}
          >
            <CheckOutline fontSize={14} />
            <span>横屏</span>
          </button>
          <div className="mobile-sim-divider" />
          <select className="mobile-sim-select" value={deviceType} onChange={handleDeviceChange}>
            {DEVICE_TYPES.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <div className="mobile-sim-divider" />
          <button className="mobile-sim-btn pc-btn" onClick={handleBackToPC}>
            <CheckOutline fontSize={14} />
            <span>返回PC主页</span>
          </button>
        </div>
      )}
    </>
  )
}
