/**
 * 移动端 —— 我的（个人中心）
 * - 用户信息
 * - 离线队列状态（待同步条数、立即同步 / 重试失败 / 清空）
 * - 退出登录
 * - 版本号
 */
import { useNavigate } from 'react-router-dom'
import { Button, Dialog, Toast, Switch } from 'antd-mobile'
import { useApp } from '../../contexts/AppContext'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { useMobileThemeContext } from '../theme'

export function MobileProfile() {
  const { currentUser, logout } = useApp()
  const navigate = useNavigate()
  const version = __APP_VERSION__ || 'dev'
  const { online, pending, syncing, triggerSync, retryFailed, clearAll } = useOfflineQueue()
  const { isDark, toggleTheme } = useMobileThemeContext()

  const handleSync = async () => {
    if (!online) {
      Toast.show({ content: '当前离线，无法同步', position: 'bottom' })
      return
    }
    await triggerSync()
    Toast.show({ content: '已触发同步', icon: 'success', position: 'bottom' })
  }

  const handleRetry = async () => {
    const n = await retryFailed()
    Toast.show({ content: n > 0 ? `已重置 ${n} 条失败请求` : '暂无失败请求', position: 'bottom' })
  }

  const handleClear = async () => {
    if (pending === 0) {
      Toast.show({ content: '队列为空', position: 'bottom' })
      return
    }
    const ok = await Dialog.confirm({
      content: `确认清空 ${pending} 条离线请求？清空后这些数据将丢失。`,
      confirmText: '清空',
      cancelText: '取消',
    })
    if (!ok) return
    await clearAll()
    Toast.show({ content: '已清空', icon: 'success', position: 'bottom' })
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
      <div className="mobile-page" style={{ paddingTop: 24 }}>
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--m-text-3)' }}>
          未登录
        </div>
        <Button block color="primary" onClick={() => navigate('/m/login')}>去登录</Button>
      </div>
    )
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 20 }}>
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

      {/* 深色模式切换（P3.5） */}
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

      {/* 离线队列卡片 */}
      <div style={{
        background: 'var(--m-surface)', borderRadius: 14, padding: '16px 18px',
        border: '1px solid var(--m-border)', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--m-text)' }}>离线队列</span>
          <span style={{
            fontSize: 12, padding: '2px 8px', borderRadius: 10,
            background: online ? 'var(--m-success-bg, #E8F5E9)' : 'var(--m-warn-bg, #FFF3E0)',
            color: online ? '#2E7D32' : '#E65100',
          }}>
            {online ? (syncing ? '同步中…' : '在线') : '离线'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--m-text-2)' }}>
            待同步请求：<span style={{ color: 'var(--brand-color, #1976D2)', fontWeight: 600 }}>{pending}</span> 条
          </div>
          <span
            onClick={() => navigate('/m/offline-queue')}
            style={{ fontSize: 12, color: '#2196F3', cursor: 'pointer', fontWeight: 500 }}
          >查看详情 →</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small" color="primary" fill="outline"
            disabled={!online || syncing || pending === 0}
            onClick={handleSync} style={{ flex: 1 }}
          >立即同步</Button>
          <Button
            size="small" fill="outline"
            onClick={handleRetry} style={{ flex: 1 }}
          >重试失败</Button>
          <Button
            size="small" color="danger" fill="outline"
            disabled={pending === 0}
            onClick={handleClear} style={{ flex: 1 }}
          >清空</Button>
        </div>
      </div>

      {/* 退出按钮 */}
      <Button
        block
        color="primary"
        shape="rounded"
        style={{ background: '#F44336', height: 46, fontSize: 15 }}
        onClick={handleLogout}
      >
        退出登录
      </Button>

      {/* 版本号 */}
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--m-text-3)', marginTop: 24 }}>
        奶粉罐MES v{version}
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
