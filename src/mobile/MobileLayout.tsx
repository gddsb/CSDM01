/**
 * 移动端主布局
 * - 顶部 NavBar（可返回 / 可自定义标题）
 * - 中部 Outlet（子页面）
 * - 底部 TabBar：仅在 Dashboard / Profile 两个 Tab 页常驻显示
 *   "生产 / 检验 / 设备" 三个 Tab 点击弹出 ActionSheet 选择子功能
 *   子功能页面跳转后 TabBar 自动收起（显示 NavBar 返回按钮）
 * - 冷启动调 checkForUpdate()：有新版本时弹 antd-mobile Dialog
 */
import { useEffect, useMemo } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { TabBar, NavBar, ActionSheet, Dialog, Badge } from 'antd-mobile'
import { AppOutline, BillOutline, CheckOutline, TeamOutline, UserOutline } from 'antd-mobile-icons'
import { useApp } from '../contexts/AppContext'
import { checkForUpdate, skipUpdate } from '../adapter/update'
import { useOfflineQueue } from './hooks/useOfflineQueue'

interface TabDef {
  key: string
  title: string
  icon: React.ReactNode
  /** 权限码：未配置时对所有登录用户可见；配置后用户需具备该权限码（或其任意父级） */
  permCode?: string
}

const TABS: TabDef[] = [
  { key: '/m/dashboard', title: '首页', icon: <AppOutline /> },
  { key: '__production__', title: '生产', icon: <BillOutline /> },
  { key: '__inspection__', title: '检验', icon: <CheckOutline /> },
  { key: '__device__', title: '设备', icon: <TeamOutline /> },
  { key: '/m/profile', title: '我的', icon: <UserOutline /> },
]

/** 底部 TabBar 常驻显示 —— 现在**所有页面**都显示 TabBar（用户希望始终可见） */

/** 根据当前路由计算 TabBar 应该高亮哪个 Tab */
function computeActiveKey(pathname: string): string {
  // 先检查直接的 Tab 路由
  if (pathname === '/m/dashboard') return '/m/dashboard'
  if (pathname === '/m/profile') return '/m/profile'
  // 生产子路由
  const prodRoutes = PRODUCTION_ITEMS.map(i => i.route)
  if (prodRoutes.includes(pathname)) return '__production__'
  // 检验子路由
  const inspRoutes = INSPECTION_ITEMS.map(i => i.route)
  if (inspRoutes.includes(pathname)) return '__inspection__'
  // 设备子路由
  const devRoutes = DEVICE_ITEMS.map(i => i.route)
  if (devRoutes.includes(pathname)) return '__device__'
  // 未知子页面，不高亮任何 Tab
  return ''
}

/** "生产" ActionSheet 子项 —— 订单管理 + 移动报工 */
const PRODUCTION_ITEMS = [
  { text: '📋 生产订单', key: 'orders', route: '/m/production-orders', permCode: 'production:reporting' },
  { text: '📝 移动报工', key: 'reporting', route: '/m/process-reporting', permCode: 'production:reporting' },
]

/** "检验" ActionSheet 子项（每项独立鉴权，全部不可见时隐藏检验 Tab） */
const INSPECTION_ITEMS = [
  { text: '📦 来料检验', key: 'incoming', route: '/m/incoming-inspection', permCode: 'quality:incoming' },
  { text: '🏷️ 成品检验', key: 'product', route: '/m/product-inspection', permCode: 'quality:product' },
  { text: '⚙️ 过程检验', key: 'process', route: '/m/process-inspection', permCode: 'quality:process' },
  { text: '🔬 微生物检验', key: 'microbe', route: '/m/microbe-inspection', permCode: 'quality:incoming' },
  { text: '📋 检验历史', key: 'history', route: '/m/inspection-history', permCode: 'quality:incoming' },
  { text: '📢 投诉上报', key: 'complaint', route: '/m/complaint-report', permCode: 'quality:incoming' },
]

/** "设备" ActionSheet 子项（每项独立鉴权，全部不可见时隐藏设备 Tab） */
const DEVICE_ITEMS = [
  { text: '🔍 设备点检', key: 'inspection', route: '/m/device-inspection', permCode: 'device:inspection' },
  { text: '🛠️ 设备保养', key: 'maintenance', route: '/m/device-maintenance', permCode: 'device:maintenance' },
  { text: '⚠️ 设备故障', key: 'fault', route: '/m/device-fault', permCode: 'device:fault' },
  { text: '⏰ 校准提醒', key: 'calibration', route: '/m/calibration-reminder', permCode: 'device:calibration' },
  { text: '📊 设备OEE', key: 'oee', route: '/m/device-oee', permCode: 'device:oee' },
  { text: '📦 备件管理', key: 'spare-parts', route: '/m/spare-parts', permCode: 'device:spare-part' },
  { text: '📁 电子档案', key: 'device-documents', route: '/m/device-documents', permCode: 'device:document' },
]

/** 标题映射 */
const TITLE_MAP: Record<string, string> = {
  '/m/dashboard': '奶粉罐MES',
  '/m/process-reporting': '移动报工',
  '/m/incoming-inspection': '来料检验',
  '/m/product-inspection': '成品检验',
  '/m/process-inspection': '过程检验',
  '/m/device-inspection': '设备点检',
  '/m/device-maintenance': '设备保养',
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

  // 权限过滤：检验/设备/生产 Tab 的可见性取决于其子项中是否至少有一项可见
  const visibleInspectionItems = useMemo(
    () => INSPECTION_ITEMS.filter(it => !it.permCode || hasPermission(it.permCode)),
    [hasPermission],
  )
  const visibleDeviceItems = useMemo(
    () => DEVICE_ITEMS.filter(it => !it.permCode || hasPermission(it.permCode)),
    [hasPermission],
  )
  const visibleProductionItems = useMemo(
    () => PRODUCTION_ITEMS.filter(it => !it.permCode || hasPermission(it.permCode)),
    [hasPermission],
  )

  // 计算 Tab 可见性
  const visibleTabs = useMemo(() => {
    return TABS.filter((t) => {
      if (t.key === '__production__') return visibleProductionItems.length > 0
      if (t.key === '__inspection__') return visibleInspectionItems.length > 0
      if (t.key === '__device__') return visibleDeviceItems.length > 0
      if (!t.permCode) return true
      return hasPermission(t.permCode)
    })
  }, [hasPermission, visibleProductionItems.length, visibleInspectionItems.length, visibleDeviceItems.length])

  // TabBar 常驻显示（所有页面）—— 根据当前路由计算高亮哪个 Tab
  const activeTabKey = computeActiveKey(location.pathname)
  // canBack 仅对"有返回历史的子页面"显示 NavBar 返回按钮
  const isDashboard = location.pathname === '/m/dashboard'
  const isProfile = location.pathname === '/m/profile'
  const canBack = location.pathname.startsWith('/m/') && !isDashboard && !isProfile
  const title = TITLE_MAP[location.pathname] || (location.pathname.startsWith('/m/') ? '奶粉罐MES' : '')

  // ========== 版本检测（冷启动时跑一次） ==========
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const result = await checkForUpdate()
        if (cancelled || !result.hasUpdate || !result.release) return
        const rel = result.release
        const apkUrl = rel.downloadUrl
        const iosUrl = rel.downloadUrlIos
        const isIos = result.local.platform === 'ios'
        const targetUrl = isIos && iosUrl ? iosUrl : apkUrl

        const content = (
          <div>
            <div style={{ fontSize: 14, color: '#333', marginBottom: 8, fontWeight: 500 }}>
              新版本 v{rel.version}（build {rel.buildNumber}）
            </div>
            {rel.updateNotes && (
              <div style={{ fontSize: 12, color: '#666', background: '#f5f7fa', padding: 10, borderRadius: 6, marginBottom: 8 }}>
                {rel.updateNotes}
              </div>
            )}
            {rel.apkSize && (
              <div style={{ fontSize: 11, color: '#999' }}>
                📦 {(rel.apkSize / 1024 / 1024).toFixed(1)}MB · Android
              </div>
            )}
          </div>
        )

        const openDownload = () => {
          if (targetUrl) window.open(targetUrl, '_blank')
        }

        if (result.forceUpdate) {
          Dialog.alert({
            title: '🔔 发现新版本（强制更新）',
            content,
            confirmText: '立即更新',
            onConfirm: openDownload,
          })
        } else {
          Dialog.confirm({
            title: '🔔 发现新版本',
            content,
            confirmText: '立即更新',
            cancelText: '稍后再说',
            onConfirm: openDownload,
            onCancel: () => skipUpdate(rel),
          })
        }
      } catch {
        /* 静默降级 */
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  // ========== TabBar 交互 ==========
  const handleTabClick = (key: string) => {
    if (key === '__production__') {
      const items = visibleProductionItems
      if (items.length === 0) return
      if (items.length === 1) {
        navigate(items[0].route)
        return
      }
      const sheet = ActionSheet.show({
        actions: items.map(it => ({ text: it.text, key: it.key })),
        cancelText: '取消',
        onAction: (action) => {
          const target = items.find(it => it.key === action.key)
          sheet.close()
          if (target) setTimeout(() => navigate(target.route), 120)
        },
      })
      return
    }
    if (key === '__inspection__') {
      const items = visibleInspectionItems
      if (items.length === 0) return
      if (items.length === 1) {
        navigate(items[0].route)
        return
      }
      const sheet = ActionSheet.show({
        actions: items.map(it => ({ text: it.text, key: it.key })),
        cancelText: '取消',
        onAction: (action) => {
          const target = items.find(it => it.key === action.key)
          sheet.close()
          if (target) setTimeout(() => navigate(target.route), 120)
        },
      })
      return
    }
    if (key === '__device__') {
      const items = visibleDeviceItems
      if (items.length === 0) return
      if (items.length === 1) {
        navigate(items[0].route)
        return
      }
      const sheet = ActionSheet.show({
        actions: items.map(it => ({ text: it.text, key: it.key })),
        cancelText: '取消',
        onAction: (action) => {
          const target = items.find(it => it.key === action.key)
          sheet.close()
          if (target) setTimeout(() => navigate(target.route), 120)
        },
      })
      return
    }
    navigate(key)
  }

  // 仅子功能页面渲染 NavBar；首页/我的自绘顶部，避免标题重复
  const showNavBar = canBack

  return (
    <div className="mobile-app">
      {/* NavBar — 仅子功能页面显示，适配 safe-area，固定顶部 */}
      {showNavBar && (
        <div style={{ paddingTop: 'var(--sat)' }}>
          <NavBar
            style={{ background: 'var(--m-surface)', borderBottom: '1px solid var(--m-border)' }}
            back={canBack}
            onBack={() => navigate(-1)}
          >
            {title}
            {currentUser && (
              <span style={{ fontSize: 12, color: 'var(--m-text-3)', marginLeft: 8, fontWeight: 'normal' }}>
                {currentUser.real_name}
              </span>
            )}
          </NavBar>
        </div>
      )}

      {/* 离线/同步状态条：仅在需要提醒时出现 */}
      {(!online || pending > 0) && (
        <div style={{
          background: !online ? 'var(--m-warn-bg, #FFF3E0)' : (syncing ? 'var(--m-info-bg, #E3F2FD)' : 'var(--m-amber-bg, #FFF8E1)'),
          color: !online ? '#E65100' : (syncing ? '#1565C0' : '#8D6E63'),
          fontSize: 12, padding: '6px 14px', textAlign: 'center',
          borderBottom: '1px solid var(--m-shadow)',
        }}>
          {!online
            ? '📶 离线模式：提交将暂存，网络恢复后自动同步'
            : (syncing ? `🔄 正在同步离线请求…（剩余 ${pending}）` : `📥 ${pending} 条离线请求待同步`)}
        </div>
      )}

      {/* 内容区 —— TabBar 常驻，底部始终留白 */}
      <div className="mobile-app__content mobile-tabbar-padding">
        <Outlet />
      </div>

      {/* TabBar —— 始终显示（5 个菜单常驻，ActionSheet 二级菜单选择后自动收起） */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        paddingBottom: 'var(--sab)',
      }}>
        <div style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f8faff 100%)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 -4px 20px rgba(33,150,243,0.08)',
          padding: '6px 0 2px',
        }}>
          <TabBar activeKey={activeTabKey} onChange={handleTabClick} safeArea={false}>
            {visibleTabs.map(t => {
              const showPendingBadge = t.key === '/m/profile' && pending > 0
              const icon = showPendingBadge
                ? <Badge content={pending > 99 ? '99+' : String(pending)}>{t.icon}</Badge>
                : t.icon
              return <TabBar.Item key={t.key} icon={icon} title={t.title} />
            })}
          </TabBar>
        </div>
      </div>
    </div>
  )
}
