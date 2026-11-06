/**
 * 移动端登录页 —— 独立视觉体系
 * - 不消费全局 --m-surface / --m-text token
 * - 登录页有渐变背景，需要独立的 --login-* 变量 + 毛玻璃卡片
 * - 所有颜色定义在 mobile.css 的 .mobile-login-root 选择器下
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Toast, Checkbox } from 'antd-mobile'
import { useApp } from '../../contexts/AppContext'
import { formatAppVersion, refreshAppVersion } from '../utils/app-version'

export default function MobileLogin() {
  const { login } = useApp()
  const navigate = useNavigate()
  // 记住我 —— 勾选时持久化账号密码，退出后自动填充
  const rememberedUser = localStorage.getItem('mes_remember_username') || ''
  const rememberedPwd = localStorage.getItem('mes_remember_password') || ''
  const [remember, setRemember] = useState(() => localStorage.getItem('mes_remember') === 'true' && !!rememberedUser)
  const [username, setUsername] = useState(rememberedUser || localStorage.getItem('mes_last_username') || '')
  const [password, setPassword] = useState(rememberedPwd)
  const [loading, setLoading] = useState(false)
  // 启动时刷新版本号缓存（/api/version 公开端点，无需 auth）
  const [verLabel, setVerLabel] = useState(() => formatAppVersion())
  useEffect(() => {
    refreshAppVersion().then((info) => {
      if (info) setVerLabel(formatAppVersion(info))
    })
  }, [])

  const onSubmit = async () => {
    if (!username.trim()) {
      Toast.show({ content: '请输入用户名', position: 'bottom' })
      return
    }
    if (!password) {
      Toast.show({ content: '请输入密码', position: 'bottom' })
      return
    }
    setLoading(true)
    try {
      const result = await login(username.trim(), password)
      if (result.success) {
        localStorage.setItem('mes_last_username', username.trim())
        if (remember) {
          localStorage.setItem('mes_remember', 'true')
          localStorage.setItem('mes_remember_username', username.trim())
          localStorage.setItem('mes_remember_password', password)
        } else {
          localStorage.setItem('mes_remember', 'false')
          localStorage.removeItem('mes_remember_username')
          localStorage.removeItem('mes_remember_password')
        }
        Toast.show({ content: '登录成功', icon: 'success', position: 'bottom' })
        setTimeout(() => navigate('/m/dashboard', { replace: true }), 400)
      } else {
        Toast.show({ content: result.message || '登录失败', position: 'bottom' })
      }
    } catch {
      Toast.show({ content: '网络错误，请检查连接', position: 'bottom' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-login-root" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100dvh',
      padding: '64px 28px 28px',
    }}>
      {/* ============ Logo + 标题（在渐变背景上，必须用 --login-*）============ */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        {/* Logo 方块 —— 毛玻璃 + 独立 token */}
        <div className="login-logo" style={{
          width: 76, height: 76, borderRadius: 20,
          background: 'var(--login-logo-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
          fontSize: 30, fontWeight: 800,
          color: 'var(--login-logo-text)',
          boxShadow: 'var(--login-logo-shadow)',
          letterSpacing: '-0.5px',
        }}>
          DM
        </div>
        {/* 品牌标题 —— 白色在蓝渐变上天然好看 */}
        <div style={{
          fontSize: 22, fontWeight: 700, marginBottom: 4,
          color: 'var(--login-title-text)',
          letterSpacing: '0.5px',
          textShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}>
          奶粉罐MES
        </div>
        <div style={{
          fontSize: 13,
          color: 'var(--login-subtitle-text)',
          letterSpacing: '1.5px',
        }}>
          移动工作台
        </div>
      </div>

      {/* ============ 登录卡片 —— 毛玻璃 ============ */}
      <div className="login-card" style={{
        width: '100%',
        background: 'var(--login-card-bg)',
        border: '1px solid var(--login-card-border)',
        borderRadius: 20,
        padding: '28px 24px 24px',
        boxShadow: 'var(--login-card-shadow)',
      }}>
        {/* 卡片标题 */}
        <div style={{
          fontSize: 17, fontWeight: 600, marginBottom: 22,
          color: 'var(--login-card-title-text)',
          letterSpacing: '0.3px',
        }}>
          账号登录
        </div>

        {/* 用户名输入框 —— 样式由 mobile.css 的 .mobile-login-root .adm-input 统一接管 */}
        <div className="login-input" style={{ marginBottom: 12 }}>
          <Input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(v) => setUsername(v)}
            style={{
              fontSize: 16,
              padding: '14px 14px',
              border: '1px solid var(--login-input-border)',
              borderRadius: 10,
              background: 'var(--login-input-bg)',
              color: 'var(--login-input-text)',
            }}
          />
        </div>

        {/* 密码输入框 */}
        <div className="login-input" style={{ marginBottom: 20 }}>
          <Input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(v) => setPassword(v)}
            enterKeyHint="go"
            onEnterPress={onSubmit}
            style={{
              fontSize: 16,
              padding: '14px 14px',
              border: '1px solid var(--login-input-border)',
              borderRadius: 10,
              background: 'var(--login-input-bg)',
              color: 'var(--login-input-text)',
            }}
          />
        </div>

        {/* 记住我 */}
        <div style={{
          marginBottom: 20, display: 'flex', alignItems: 'center',
          color: 'var(--login-checkbox-text)',
          fontSize: 13,
        }}>
          <Checkbox
            checked={remember}
            onChange={(v) => setRemember(v)}
            style={{ fontSize: 13, '--border-color': 'var(--login-input-border)' } as React.CSSProperties}
          >
            记住我（下次自动填充账号密码）
          </Checkbox>
        </div>

        {/* 登录按钮 —— 渐变背景 */}
        <Button
          block
          color="primary"
          size="large"
          loading={loading}
          onClick={onSubmit}
          style={{
            background: 'var(--login-btn-bg)',
            color: 'var(--login-btn-text)',
            borderRadius: 12,
            height: 50,
            fontSize: 16,
            fontWeight: 600,
            boxShadow: 'var(--login-btn-shadow)',
            border: 'none',
            letterSpacing: '1px',
          }}
        >
          登录
        </Button>

        {/* 底部公司名 */}
        <div style={{
          marginTop: 18, fontSize: 12,
          color: 'var(--login-card-muted-text)',
          textAlign: 'center',
        }}>
          东莞大满包装 · 长沙分公司
        </div>
        <div style={{
          marginTop: 4, fontSize: 11,
          color: 'var(--login-card-muted-text)',
          textAlign: 'center',
          letterSpacing: 0.5,
          opacity: 0.8,
        }}>
          {verLabel}
        </div>
      </div>
    </div>
  )
}
