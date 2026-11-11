/**
 * 移动端主布局（后端驱动菜单）
 * - 顶部 NavBar（子功能页显示返回）
 * - 中部 Outlet（子页面）
 * - 底部 TabBar：home + 业务 Tab（production/quality/device）+ profile
 *   业务 Tab 点击弹出 ActionSheet 选择子功能
 * - 菜单数据来自 /api/system/permissions/mobile-menu
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { TabBar, NavBar, ActionSheet } from 'antd-mobile'
import {
  AppOutline, BillOutline, CheckOutline, TeamOutline, UserOutline,
} from 'antd-mobile-icons'
import { useApp } from '../contexts/AppContext'
import { useOfflineQueue } from './hooks/useOfflineQueue'
import { useKeyboardAvoidance } from './hooks/useKeyboardAvoidance'
import { useEdgeSwipeBack } from './hooks/useEdgeSwipeBack'
import { runBackHandler } from './utils/backInterceptor'
import api from '../utils/api'

/** 后端 icon 字符串 → antd-mobile-icons 组件 */
const ICON_MAP: Record<string, React.ReactNode> = {
  AppOutline: <AppOutline />,
  BillOutline: <BillOutline />,
  CheckOutline: <CheckOutline />,
  TeamOutline: <TeamOutline />,
  UserOutline: <UserOutline />,
}
const DEFAULT_TAB_ICON: Record<string, React.ReactNode> = {
  __production__: <BillOutline />,
  __inspection__: <CheckOutline />,
  __device__: <TeamOutline />,
}
const resolveIcon = (icon: string | null | undefined, fallbackKey?: string) =>
  (icon && ICON_MAP[icon]) || (fallbackKey && DEFAULT_TAB_ICON[fallbackKey]) || <AppOutline />

interface MobileItem { text: string; route: string; permCode?: string; icon?: string | null; sortOrder?: number }
interface MobileTab { key: string; title: string; tabGroup: string; items: MobileItem[] }
interface MobileMenuResp { home: { key: string; title: string; route: string; icon?: string | null }; tabs: MobileTab[]; profile: { key: string; title: string; route: string; icon?: string | null } }

/** 标题映射（子功能页 NavBar 标题） */
const TITLE_MAP: Record<string, string> = {
  '/m/dashboard': '奶粉罐MES',
  '/m/process-reporting': '移动报工',
  '/m/incoming-inspection': '来料检验',
  '/m/product-inspection': '成品检验',
  '/m/process-inspection': '过程检验',
  '/m/device-maintenance': '设备维保',
  '/m/device-fault': '设备故障上报',
  '/m/calibration-reminder': '校准提醒',
  '/m/inspection-history': '检验历史',
  '/m/daily-card': '日报卡',
  '/m/microbe-inspection': '微生物检验',
  '/m/complaint-report': '投诉上报',
  '/m/offline-queue': '离线暂存队列',
  '/m/device-oee': '设备OEE看板',
  '/m/production-orders': '生产订单',
  '/m/spare-parts': '备件管理',
  '/m/device-documents': '电子档案',
  '/m/exception-report': '异常上报',
  '/m/profile': '我的',
}

export function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, hasPermission } = useApp()
  const { online, pending, syncing } = useOfflineQueue()
  const [menu, setMenu] = useState<MobileMenuResp | null>(null)
  const [loading, setLoading] = useState(true)

  // 拉取后端驱动的移动端菜单
  useEffect(() => {
    let active = true
    api.get<MobileMenuResp>('/system/permissions/mobile-menu')
      .then(res => { if (active) setMenu(res.data); })
      .catch(() => { if (active) setMenu(null); })
      .finally(() => { if (active) setLoading(false); })
    return () => { active = false }
  }, [])

  // 权限过滤每个 Tab 的子项
  const visibleTabs = useMemo(() => {
    if (!menu) return []
    return menu.tabs
      .map(tab => ({ ...tab, items: tab.items.filter(it => !it.permCode || hasPermission(it.permCode)) }))
      .filter(tab => tab.items.length > 0)
  }, [menu, hasPermission])

  // 组装 TabBar 列表（home + 业务 tab + profile）
  const tabBarItems = useMemo(() => {
    if (!menu) return []
    const items: { key: string; title: string; icon: React.ReactNode }[] = [
      { key: menu.home.key, title: menu.home.title, icon: resolveIcon(menu.home.icon, menu.home.key) },
    ]
    for (const tab of visibleTabs) {
      items.push({ key: tab.key, title: tab.title, icon: resolveIcon(null, tab.key) })
    }
    items.push({ key: menu.profile.key, title: menu.profile.title, icon: resolveIcon(menu.profile.icon, menu.profile.key) })
    return items
  }, [menu, visibleTabs])

  // 根据当前路由计算 TabBar 高亮
  const activeTabKey = useMemo(() => {
    if (!menu) return ''
    const path = location.pathname
    if (path === menu.home.key) return menu.home.key
    if (path === menu.profile.key) return menu.profile.key
    for (const tab of visibleTabs) {
      if (tab.items.some(it => it.route === path)) return tab.key
    }
    return ''
  }, [menu, location.pathname, visibleTabs])

  const isDashboard = menu ? location.pathname === menu.home.key : location.pathname === '/m/dashboard'
  const isProfile = menu ? location.pathname === menu.profile.key : location.pathname === '/m/profile'
  const canBack = location.pathname.startsWith('/m/') && !isDashboard && !isProfile
  const title = TITLE_MAP[location.pathname] || (location.pathname.startsWith('/m/') ? '奶粉罐MES' : '')

  const doBack = useCallback(() => {
    if (runBackHandler()) return
    navigate(-1)
  }, [navigate])
  useEdgeSwipeBack({ enable: canBack, onBack: doBack })
  useKeyboardAvoidance()

  const handleTabClick = (key: string) => {
    if (!menu) return
    // home / profile 直接跳转
    if (key === menu.home.key) { navigate(menu.home.route); return }
    if (key === menu.profile.key) { navigate(menu.profile.route); return }
    // 业务 Tab → ActionSheet
    const tab = visibleTabs.find(t => t.key === key)
    if (!tab || tab.items.length === 0) return
    if (tab.items.length === 1) { navigate(tab.items[0].route); return }
    const sheet = ActionSheet.show({
      actions: tab.items.map(it => ({ text: it.text, key: it.route })),
      cancelText: '取消',
      onAction: (action) => {
        sheet.close()
        setTimeout(() => navigate(action.key as string), 120)
      },
    })
  }

  const showNavBar = canBack

  if (loading) {
    return (
      <div className="mobile-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span style={{ color: 'var(--m-text-2)' }}>加载中...</span>
      </div>
    )
  }

  return (
    <div className="mobile-app">
      {showNavBar && (
        <NavBar
          style={{ background: 'var(--m-surface)', borderBottom: '1px solid var(--m-border)', flexShrink: 0 }}
          back={canBack}
          onBack={() => { if (runBackHandler()) return; navigate(-1) }}
        >
          {title}
          {currentUser && (
            <span style={{ fontSize: 12, color: 'var(--m-text-3)', marginLeft: 8, fontWeight: 'normal' }}>
              {currentUser.real_name}
            </span>
          )}
        </NavBar>
      )}

      <div className="mobile-app__content mobile-tabbar-padding">
        <Outlet />
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, paddingBottom: 'var(--sab)' }}>
        <div className="mobile-tabbar-shell">
          <TabBar activeKey={activeTabKey} onChange={handleTabClick} safeArea={false}>
            {tabBarItems.map(t => (
              <TabBar.Item key={t.key} icon={t.icon} title={t.title} />
            ))}
          </TabBar>
        </div>
      </div>
    </div>
  )
}
