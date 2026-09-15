/**
 * 移动端主布局
 * - 顶部 NavBar（可返回 / 可自定义标题）
 * - 中部 Outlet（子页面）
 * - 底部 TabBar（首页 / 报工 / 检验 / 设备 / 我的）
 *   "检验" Tab 点击时弹出 ActionSheet 选择：来料/成品/过程检验
 * - 冷启动调 checkForUpdate()：有新版本时弹 antd-mobile Dialog
 */
import { useEffect, useMemo } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { TabBar, NavBar, ActionSheet, Dialog, Badge } from 'antd-mobile'
import { AppOutline, EditSOutline, CheckOutline, TeamOutline, UserOutline } from 'antd-mobile-icons'
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
  { key: '/m/process-reporting', title: '报工', icon: <EditSOutline />, permCode: 'production:reporting' },
  { key: '__inspection__', title: '检验', icon: <CheckOutline /> },
  { key: '__device__', title: '设备', icon: <TeamOutline /> },
  { key: '/m/profile', title: '我的', icon: <UserOutline /> },
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
]

/** 标题映射（Tab 页 + 子页都覆盖） */
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
  '/m/exception-report': '异常上报',
  '/m/profile': '我的',
}

/** 当前路径是否属于"检验"家族（用于高亮 Tab） */
function isInspectionPath(p: string) {
  return p === '/m/incoming-inspection' || p === '/m/product-inspection' || p === '/m/process-inspection' || p === '/m/inspection-history' || p === '/m/microbe-inspection' || p === '/m/complaint-report'
}

/** 当前路径是否属于"设备"家族（用于高亮 Tab） */
function isDevicePath(p: string) {
  return p === '/m/device-inspection' || p === '/m/device-maintenance' || p === '/m/device-fault' || p === '/m/calibration-reminder'
}

export function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, hasPermission } = useApp()
  const { online, pending, syncing } = useOfflineQueue()

  // 权限过滤：检验/设备 Tab 的可见性取决于其子项中是否至少有一项可见
  const visibleInspectionItems = useMemo(
    () => INSPECTION_ITEMS.filter(it => !it.permCode || hasPermission(it.permCode)),
    [hasPermission],
  )
  const visibleDeviceItems = useMemo(
    () => DEVICE_ITEMS.filter(it => !it.permCode || hasPermission(it.permCode)),
    [hasPermission],
  )

  // 计算 Tab 可见性
  const visibleTabs = useMemo(() => {
    return TABS.filter((t) => {
      if (t.key === '__inspection__') return visibleInspectionItems.length > 0
      if (t.key === '__device__') return visibleDeviceItems.length > 0
      if (!t.permCode) return true
      return hasPermission(t.permCode)
    })
  }, [hasPermission, visibleInspectionItems.length, visibleDeviceItems.length])

  // isTabPage: 直接路由匹配 or 属于检验/设备家族（且对应 Tab 仍可见）
  const isInspectionVisibleTab = visibleInspectionItems.length > 0
  const isDeviceVisibleTab = visibleDeviceItems.length > 0
  const isTabPage = visibleTabs.some(t => t.key === location.pathname)
    || (isInspectionVisibleTab && isInspectionPath(location.pathname))
    || (isDeviceVisibleTab && isDevicePath(location.pathname))
  const title = TITLE_MAP[location.pathname] || (location.pathname.startsWith('/m/') ? '奶粉罐MES' : '')
  const canBack = location.pathname.startsWith('/m/') && !isTabPage

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
          // 强制更新：无取消按钮
          Dialog.alert({
            title: '🔔 发现新版本（强制更新）',
            content,
            confirmText: '立即更新',
            onConfirm: openDownload,
          })
        } else {
          // 非强制更新：可跳过
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
        /* 静默降级 —— 网络失败 / parse 失败都不打扰用户 */
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  // ========== TabBar 交互 ==========
  const handleTabClick = (key: string) => {
    if (key === '__inspection__') {
      const items = visibleInspectionItems
      if (items.length === 0) return
      if (items.length === 1) {
        navigate(items[0].route)
        return
      }
      ActionSheet.show({
        actions: items.map(it => ({ text: it.text, key: it.key })),
        cancelText: '取消',
        onAction: (action) => {
          const target = items.find(it => it.key === action.key)
          if (target) navigate(target.route)
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
      ActionSheet.show({
        actions: items.map(it => ({ text: it.text, key: it.key })),
        cancelText: '取消',
        onAction: (action) => {
          const target = items.find(it => it.key === action.key)
          if (target) navigate(target.route)
        },
      })
      return
    }
    navigate(key)
  }

  const activeKey = (isInspectionVisibleTab && isInspectionPath(location.pathname))
    ? '__inspection__'
    : ((isDeviceVisibleTab && isDevicePath(location.pathname)) ? '__device__' : location.pathname)

  return (
    <div className="mobile-app">
      {/* NavBar — 适配 safe-area */}
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

      {/* 内容区 */}
      <div className={`mobile-app__content ${isTabPage ? 'mobile-tabbar-padding' : ''}`}>
        <Outlet />
      </div>

      {/* TabBar */}
      {isTabPage && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          paddingBottom: 'var(--sab)', background: 'var(--m-surface)', borderTop: '1px solid var(--m-border)',
        }}>
          <TabBar activeKey={activeKey} onChange={handleTabClick}>
            {visibleTabs.map(t => {
              // "我的" Tab 上挂载离线队列待同步条数 Badge
              const showPendingBadge = t.key === '/m/profile' && pending > 0
              const icon = showPendingBadge
                ? <Badge content={pending > 99 ? '99+' : String(pending)}>{t.icon}</Badge>
                : t.icon
              return <TabBar.Item key={t.key} icon={icon} title={t.title} />
            })}
          </TabBar>
        </div>
      )}
    </div>
  )
}
