import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Dialog } from 'antd-mobile'
import { UserOutline, SetOutline } from 'antd-mobile-icons'
import { useApp, useMessage } from '../../contexts/AppContext'
import { themes, themeList } from '../../themes'
import './profile.css'

export default function ProfilePage() {
  const { currentUser, logout, themeKey, cycleTheme } = useApp()
  const message = useMessage()
  const navigate = useNavigate()
  const currentTheme = themes[themeKey] || themes.pureMilk

  const handleLogout = async () => {
    const confirmed = await Dialog.confirm({ content: '确定退出登录吗？' })
    if (confirmed) {
      logout()
      navigate('/mobile/login', { replace: true })
    }
  }

  const handleCycleTheme = () => {
    const nextKey = cycleTheme()
    const next = themes[nextKey]
    message.success(`已切换主题：${next.name}`, 1)
  }

  return (
    <div className="mobile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          {currentUser?.avatar_url
            ? <img src={currentUser.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: 32 }} />
            : <UserOutline fontSize={32} color="#fff" />}
        </div>
        <div className="profile-info">
          <div className="profile-name">{currentUser?.real_name || currentUser?.username || '-'}</div>
          <div className="profile-role">{currentUser?.role?.role_name || '-'}</div>
        </div>
      </div>

      <div className="mobile-card">
        <div
          className="profile-menu-item"
          onClick={handleCycleTheme}
        >
          <div className="profile-menu-left">
            <span className="profile-menu-icon" style={{ background: '#FFF3E0', color: '#FF9800' }}>
              <SetOutline fontSize={18} />
            </span>
            <span className="profile-menu-label">主题设置</span>
          </div>
          <div className="profile-menu-right">
            <span style={{ fontSize: 12, color: '#9e9e9e', marginRight: 4 }}>
              {currentTheme.icon} {currentTheme.name}
            </span>
            <span style={{ color: '#BDBDBD', fontSize: 16 }}>›</span>
          </div>
        </div>
      </div>

      <div className="mobile-card">
        <div className="mobile-card-row">
          <span className="mobile-card-label">用户名</span>
          <span className="mobile-card-value">{currentUser?.username || '-'}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">部门</span>
          <span className="mobile-card-value">{currentUser?.department || '-'}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">手机</span>
          <span className="mobile-card-value">{currentUser?.phone || '-'}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">邮箱</span>
          <span className="mobile-card-value">{currentUser?.email || '-'}</span>
        </div>
      </div>

      <Button block color="danger" fill="outline" size="large" onClick={handleLogout} style={{ marginTop: 20, borderRadius: 8 }}>
        退出登录
      </Button>
    </div>
  )
}
