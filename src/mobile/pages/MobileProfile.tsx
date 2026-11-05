/**
 * 移动端 —— 我的（个人中心）
 */
import { useNavigate } from 'react-router-dom'
import { Button, Dialog, Toast, Switch } from 'antd-mobile'
import { useApp } from '../../contexts/AppContext'
import { useMobileThemeContext } from '../theme'
import { getAppVersion, formatAppVersion, refreshAppVersion } from '../utils/app-version'
import { checkAndPromptUpdate, getNativeBuildNumber } from '../utils/app-updater'

export function MobileProfile() {
  const { currentUser, logout } = useApp()
  const navigate = useNavigate()
  const appVer = getAppVersion()
  const { isDark, toggleTheme } = useMobileThemeContext()

  const handleCheckUpdate = async () => {
    await refreshAppVersion()
    const triggered = await checkAndPromptUpdate(true) // ignoreDateLock：用户主动检查不受当天限流
    if (!triggered) {
      const nativeBuild = getNativeBuildNumber()
      Toast.show({
        content: nativeBuild > 0
          ? `已是最新版本 build${nativeBuild} ✅`
          : '无法获取当前安装版本号，请重新下载安装 APK',
        position: 'bottom',
        duration: 1500,
      })
    }
  }

  const handleLogout = async () => {
    const confirmed = await Dialog.confirm({
      content: '确定退出登录？',
      confirmText: '退出',
      cancelText: '取消',
    })
    if (confirmed) {
      await logout()
      navigate('/m/login', { replace: true })
    }
  }

  if (!currentUser) {
    return (
      <div className="mobile-page mobile-page-scrollable" style={{ paddingTop: 24 }}>
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--m-text-3)' }}>
          未登录
        </div>
        <Button block color="primary" onClick={() => navigate('/m/login')}>去登录</Button>
      </div>
    )
  }

  const versionLabel = `V${appVer.version} build${getNativeBuildNumber()}`

  return (
    <div className="mobile-page mobile-page-scrollable" style={{ paddingTop: 20 }}>
      {/* 用户卡片 */}
      <div style={{
        background: 'var(--m-surface)', borderRadius: 14, padding: 20,
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16,
        border: '1px solid var(--m-border)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--m-info-bg, #E3F2FD)', color: 'var(--brand-color, #1976D2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 600,
        }}>
          {currentUser.real_name?.[0] || currentUser.username?.[0] || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--m-text)' }}>{currentUser.real_name}</div>
          <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginTop: 2 }}>
            {currentUser.department || ''} · {currentUser.position || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 2 }}>
            {currentUser.username}
          </div>
        </div>
      </div>

      {/* 信息清单 */}
      <div style={{
        background: 'var(--m-surface)', borderRadius: 14, overflow: 'hidden',
        border: '1px solid var(--m-border)', marginBottom: 16,
      }}>
        <InfoRow label="工号" value={currentUser.employee_no || '—'} />
        <InfoRow label="邮箱" value={currentUser.email || '—'} />
        <InfoRow label="手机" value={currentUser.phone || '—'} last />
      </div>

      {/* 深色模式切换 */}
      <div style={{
        background: 'var(--m-surface)', borderRadius: 14, padding: '14px 16px',
        border: '1px solid var(--m-border)', marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--m-text)' }}>深色模式</div>
          <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 2 }}>
            夜班/暗光环境下减少刺眼，自动跟随系统
          </div>
        </div>
        <Switch checked={isDark} onChange={toggleTheme} />
      </div>

      {/* 检查更新 —— 主动点击绕过当天限流 */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleCheckUpdate}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCheckUpdate() }}
        style={{
          background: 'var(--m-surface)', borderRadius: 14, padding: '14px 16px',
          border: '1px solid var(--m-border)', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--m-text)' }}>📦 检查更新</div>
          <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 2 }}>
            {versionLabel} · 点击检查新版本
          </div>
        </div>
        <span style={{ color: 'var(--m-text-3)', fontSize: 18 }}>›</span>
      </div>

      {/* 退出按钮 */}
      <Button
        block
        color="danger"
        shape="rounded"
        style={{ height: 46, fontSize: 15 }}
        onClick={handleLogout}
      >
        退出登录
      </Button>

      {/* 版本号 */}
      <div style={{
        textAlign: 'center', fontSize: 11, color: 'var(--m-text-3)',
        marginTop: 28, paddingTop: 16,
        borderTop: '1px solid var(--m-border-2)',
      }}>
        奶粉罐MES · {formatAppVersion(appVer)}
      </div>
    </div>
  )
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px', fontSize: 14,
      borderBottom: last ? 'none' : '1px solid var(--m-border-2)',
    }}>
      <span style={{ color: 'var(--m-text-2)' }}>{label}</span>
      <span style={{ color: 'var(--m-text)' }}>{value}</span>
    </div>
  )
}
