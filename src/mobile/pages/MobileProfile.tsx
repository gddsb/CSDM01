/**
 * 移动端 —— 我的（个人中心）
 * - 用户信息
 * - 退出登录
 * - 版本号
 */
import { useNavigate } from 'react-router-dom'
import { Button, Dialog } from 'antd-mobile'
import { useApp } from '../../contexts/AppContext'

export function MobileProfile() {
  const { currentUser, logout } = useApp()
  const navigate = useNavigate()
  const version = __APP_VERSION__ || 'dev'

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
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
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
        background: '#fff', borderRadius: 14, padding: 20,
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16,
        border: '1px solid #eef0f3',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#E3F2FD', color: '#1976D2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 600,
        }}>
          {currentUser.real_name?.[0] || currentUser.username?.[0] || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#222' }}>{currentUser.real_name}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {currentUser.department || ''} · {currentUser.position || '—'}
          </div>
          <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>
            {currentUser.username}
          </div>
        </div>
      </div>

      {/* 信息清单 */}
      <div style={{
        background: '#fff', borderRadius: 14, overflow: 'hidden',
        border: '1px solid #eef0f3', marginBottom: 16,
      }}>
        <InfoRow label="工号" value={currentUser.employee_no || '—'} />
        <InfoRow label="邮箱" value={currentUser.email || '—'} />
        <InfoRow label="手机" value={currentUser.phone || '—'} last />
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
      <div style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 24 }}>
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
      borderBottom: last ? 'none' : '1px solid #f0f1f4',
    }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: '#333' }}>{value}</span>
    </div>
  )
}
