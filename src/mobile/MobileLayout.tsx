/**
 * 移动端主布局
 *
 * Migration 035 改造：业务菜单从"前端硬编码"改为"后端动态下发"
 *   —— sys_permission 加 mobile_* 字段统一双端菜单
 *   —— 后端 /system/permissions/mobile-menu 返回 { tabs: [...] }
 *   —— 前端按 tabGroup 分组 + mobile_sort_order 排序，渲染 TabBar + ActionSheet
 *
 * 固定 Tab（首页/我的）仍硬编码 — APP 框架层入口，不属于 type=menu
 * 业务 Tab（生产/检验/设备）由后端 tabs 数组驱动
 */
import { useMemo, useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { TabBar, NavBar, ActionSheet } from 'antd-mobile'
import { AppOutline, BillOutline, CheckOutline, TeamOutline, UserOutline } from 'antd-mobile-icons'
import { useApp } from '../contexts/AppContext'
import { useOfflineQueue } from './hooks/useOfflineQueue'
import { useKeyboardAvoidance } from './hooks/useKeyboardAvoidance'
import { useEdgeSwipeBack } from './hooks/useEdgeSwipeBack'
import { runBackHandler } from './utils/backInterceptor'
import api from '../utils/api'

interface TabDef {
  key: string
  title: string
  icon: React.ReactNode
}

/** 后端返回的移动端菜单项 */
interface MobileMenuItem {
  text: string        // perm_name
  route: string       // mobile_route_path
  permCode: string    // perm_code（前端二次鉴权）
  icon?: string
  sortOrder?: number
}

/** 后端返回的移动端 Tab 分组 */
interface MobileTabGroup {
  key: string          // '__production__' / '__inspection__' / '__device__'
  title: string        // '生产' / '检验' / '设备'
  tabGroup: string     // 'production' / 'inspection' / 'device'
  items: MobileMenuItem[]
}

/** 固定 Tab — 首页 / 我的（APP 框架层入口，不属于 sys_permission type=menu） */
const FIXED_HOME: TabDef = { key: '/m/dashboard', title: '首页', icon: <AppOutline /> }
const FIXED_PROFILE: TabDef = { key: '/m/profile', title: '我的', icon: <UserOutline /> }

const GROUP_ICON_MAP: Record<string, React.ReactNode> = {
  production: <BillOutline />,
  inspection: <CheckOutline />,
  device: <TeamOutline />,
}

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
  '/m/microbe-inspection': '微生物检验',
  '/m/complaint-report': '投诉上报',
  '/m/device-oee': '设备OEE看板',
  '/m/production-orders': '生产订单',
  '/m/spare-parts': '备件管理',
  '/m/device-documents': '电子档案',
  '/m/profile': '我的',
}

function computeActiveKey(pathname: string, dynamicTabs: MobileTabGroup[]): string {
  if (pathname === '/m/dashboard') return '/m/dashboard'
  if (pathname === '/m/profile') return '/m/profile'
  for (const tab of dynamicTabs) {
    if (tab.items.some(it => it.route === pathname)) return tab.key
  }
  return ''
}

export function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, hasPermission } = useApp()
  const { online } = useOfflineQueue()

  // —— Migration 035: 动态菜单 state ——
  const [dynamicTabs, setDynamicTabs] = useState<MobileTabGroup[]>([])
  const [menuLoading, setMenuLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchMobileMenu = async () => {
      try {
        const res = await api.get('/system/permissions/mobile-menu')
        const data = res?.data || { tabs: [] }
        if (cancelled) return
        setDynamicTabs((data.tabs || []) as MobileTabGroup[])
      } catch (err) {
        console.warn('[MobileLayout] 拉取移动端菜单失败:', err)
        setDynamicTabs([])
      } finally {
        if (!cancelled) setMenuLoading(false)
      }
    }
    fetchMobileMenu()
    return () => { cancelled = true }
    // 用户/角色变化时重拉
  }, [currentUser?.user_id, currentUser?.role?.role_code])

  // —— 前端二次鉴权过滤（后端已按 role_permission 过滤，前端再兜底）——
  const filteredTabs = useMemo(() => {
    return dynamicTabs
      .map(tab => ({ ...tab, items: tab.items.filter(it => !it.permCode || hasPermission(it.permCode)) }))
      .filter(tab => tab.items.length > 0)
  }, [dynamicTabs, hasPermission])

  // —— 合成 visibleTabs（固定首页 + 动态业务 Tab + 固定我的）——
  const visibleTabs = useMemo<TabDef[]>(() => {
    const result: TabDef[] = [FIXED_HOME]
    for (const tab of filteredTabs) {
      result.push({ key: tab.key, title: tab.title, icon: GROUP_ICON_MAP[tab.tabGroup] })
    }
    result.push(FIXED_PROFILE)
    return result
  }, [filteredTabs])

  const activeTabKey = computeActiveKey(location.pathname, filteredTabs)

  const isDashboard = location.pathname === '/m/dashboard'
  const isProfile = location.pathname === '/m/profile'
  const canBack = location.pathname.startsWith('/m/') && !isDashboard && !isProfile
  const title = TITLE_MAP[location.pathname] || (location.pathname.startsWith('/m/') ? '奶粉罐MES' : '')

  const doBack = useCallback(() => {
    if (runBackHandler()) return
    navigate(-1)
  }, [navigate])
  useEdgeSwipeBack({ enable: canBack, onBack: doBack })
  useKeyboardAvoidance()

  // —— 动态 Tab → items 映射 ——
  const tabItemsMap = useMemo(() => {
    const m: Record<string, MobileMenuItem[]> = {}
    for (const tab of filteredTabs) m[tab.key] = tab.items
    return m
  }, [filteredTabs])

  const handleTabClick = (key: string) => {
    const items = tabItemsMap[key]
    if (items) {
      if (items.length === 0) return
      if (items.length === 1) { navigate(items[0].route); return }
      const sheet = ActionSheet.show({
        actions: items.map(it => ({ text: it.text, key: it.route })),
        cancelText: '取消',
        onAction: (action) => {
          const target = items.find(it => it.route === action.key)
          sheet.close()
          if (target) setTimeout(() => navigate(target.route), 120)
        },
      })
      return
    }
    navigate(key)
  }

  const showNavBar = canBack

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
            {visibleTabs.map(t => <TabBar.Item key={t.key} icon={t.icon} title={t.title} />)}
          </TabBar>
        </div>
      </div>
    </div>
  )
}
