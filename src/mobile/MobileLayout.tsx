/**
 * 移动端主布局
 * - 顶部 NavBar（可返回 / 可自定义标题）
 * - 中部 Outlet（子页面）
 * - 底部 TabBar（首页 / 检验 / 设备 / 我的）
 */
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { TabBar, NavBar } from 'antd-mobile'
import { AppOutline, CheckOutline, TeamOutline, UserOutline } from 'antd-mobile-icons'
import { useApp } from '../contexts/AppContext'

const TABS = [
  { key: '/m/dashboard', title: '首页', icon: <AppOutline /> },
  { key: '/m/incoming-inspection', title: '检验', icon: <CheckOutline /> },
  { key: '/m/device-inspection', title: '设备', icon: <TeamOutline /> },
  { key: '/m/profile', title: '我的', icon: <UserOutline /> },
]

/** 标题映射 */
const TITLE_MAP: Record<string, string> = {
  '/m/dashboard': '奶粉罐MES',
  '/m/incoming-inspection': '来料检验',
  '/m/device-inspection': '设备点检',
  '/m/profile': '我的',
  '/m/process-reporting': '移动报工',
}

export function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useApp()

  const isTabPage = TABS.some((t) => location.pathname === t.key)
  const title = TITLE_MAP[location.pathname] || (location.pathname.startsWith('/m/') ? '奶粉罐MES' : '')
  const canBack = location.pathname.startsWith('/m/') && !isTabPage

  return (
    <div className="mobile-app">
      {/* NavBar — 适配 safe-area */}
      <div style={{ paddingTop: 'var(--sat)' }}>
        <NavBar
          style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}
          back={canBack}
          onBack={() => navigate(-1)}
        >
          {title}
          {currentUser && (
            <span style={{ fontSize: 12, color: '#999', marginLeft: 8, fontWeight: 'normal' }}>
              {currentUser.real_name}
            </span>
          )}
        </NavBar>
      </div>

      {/* 内容区 */}
      <div className={`mobile-app__content ${isTabPage ? 'mobile-tabbar-padding' : ''}`}>
        <Outlet />
      </div>

      {/* TabBar */}
      {isTabPage && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          paddingBottom: 'var(--sab)',
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
        }}>
          <TabBar activeKey={location.pathname} onChange={(key) => navigate(key)}>
            {TABS.map((tab) => (
              <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
            ))}
          </TabBar>
        </div>
      )}
    </div>
  )
}
