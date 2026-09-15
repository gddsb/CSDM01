/**
 * 移动端主布局
 * - 顶部 NavBar（可返回 / 可自定义标题）
 * - 中部 Outlet（子页面）
 * - 底部 TabBar（首页 / 报工 / 检验 / 设备 / 我的）
 *   "检验" Tab 点击时弹出 ActionSheet 选择：来料/成品/过程检验
 * - 冷启动调 checkForUpdate()：有新版本时弹 antd-mobile Dialog
 */
import { useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { TabBar, NavBar, ActionSheet, Dialog } from 'antd-mobile'
import { AppOutline, EditSOutline, CheckOutline, TeamOutline, UserOutline } from 'antd-mobile-icons'
import { useApp } from '../contexts/AppContext'
import { checkForUpdate, skipUpdate } from '../adapter/update'

const TABS = [
  { key: '/m/dashboard', title: '首页', icon: <AppOutline /> },
  { key: '/m/process-reporting', title: '报工', icon: <EditSOutline /> },
  { key: '__inspection__', title: '检验', icon: <CheckOutline /> },
  { key: '/m/device-inspection', title: '设备', icon: <TeamOutline /> },
  { key: '/m/profile', title: '我的', icon: <UserOutline /> },
]

/** 标题映射（Tab 页 + 子页都覆盖） */
const TITLE_MAP: Record<string, string> = {
  '/m/dashboard': '奶粉罐MES',
  '/m/process-reporting': '移动报工',
  '/m/incoming-inspection': '来料检验',
  '/m/product-inspection': '成品检验',
  '/m/process-inspection': '过程检验',
  '/m/device-inspection': '设备点检',
  '/m/profile': '我的',
}

/** 当前路径是否属于"检验"家族（用于高亮 Tab） */
function isInspectionPath(p: string) {
  return p === '/m/incoming-inspection' || p === '/m/product-inspection' || p === '/m/process-inspection'
}

export function MobileLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useApp()

  // isTabPage: 直接路由匹配 or 属于检验家族
  const isTabPage = TABS.some(t => t.key === location.pathname) || isInspectionPath(location.pathname)
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
      ActionSheet.show({
        actions: [
          { text: '📦 来料检验', key: 'incoming' },
          { text: '🏷️ 成品检验', key: 'product' },
          { text: '⚙️ 过程检验', key: 'process' },
        ],
        cancelText: '取消',
        onAction: (action) => {
          const route: Record<string, string> = {
            incoming: '/m/incoming-inspection',
            product: '/m/product-inspection',
            process: '/m/process-inspection',
          }
          navigate(route[action.key as string])
        },
      })
      return
    }
    navigate(key)
  }

  const activeKey = isInspectionPath(location.pathname) ? '__inspection__' : location.pathname

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
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          paddingBottom: 'var(--sab)', background: '#fff', borderTop: '1px solid #f0f0f0',
        }}>
          <TabBar activeKey={activeKey} onChange={handleTabClick}>
            {TABS.map(t => (
              <TabBar.Item key={t.key} icon={t.icon} title={t.title} />
            ))}
          </TabBar>
        </div>
      )}
    </div>
  )
}
