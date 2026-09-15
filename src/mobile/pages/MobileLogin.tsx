/**
 * 移动端登录页
 * - antd-mobile Form + Input + Button
 * - 大字简洁，适配软键盘弹起（adjustPan）
 * - 登录成功后跳 /m/dashboard
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Toast } from 'antd-mobile'
import { useApp } from '../../contexts/AppContext'

export default function MobileLogin() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [username, setUsername] = useState(() => localStorage.getItem('mes_last_username') || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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
        Toast.show({ content: '登录成功', icon: 'success', position: 'bottom' })
        // 稍等 Toast 显示再跳转
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100dvh',
      padding: '60px 28px 28px',
      background: 'linear-gradient(160deg, #1976D2 0%, #42A5F5 45%, #64B5F6 100%)',
    }}>
      {/* Logo + 标题 */}
      <div style={{ textAlign: 'center', color: '#fff', marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18, background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28, fontWeight: 800, color: '#1976D2',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          DM
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>奶粉罐MES</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>移动工作台</div>
      </div>

      {/* 登录卡片 */}
      <div style={{
        width: '100%', background: '#fff', borderRadius: 16, padding: '28px 22px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 20, color: '#333' }}>
          账号登录
        </div>

        <div style={{ marginBottom: 14 }}>
          <Input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(v) => setUsername(v)}
            style={{ fontSize: 16, padding: '14px 12px', border: '1px solid #e5e6eb', borderRadius: 10 }}
          />
        </div>
        <div style={{ marginBottom: 22 }}>
          <Input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(v) => setPassword(v)}
            enterKeyHint="go"
            onEnterPress={onSubmit}
            style={{ fontSize: 16, padding: '14px 12px', border: '1px solid #e5e6eb', borderRadius: 10 }}
          />
        </div>

        <Button
          block
          color="primary"
          size="large"
          loading={loading}
          onClick={onSubmit}
          style={{
            background: '#2196F3',
            borderRadius: 10,
            height: 48,
            fontSize: 17,
            fontWeight: 500,
          }}
        >
          登录
        </Button>

        <div style={{ marginTop: 14, fontSize: 12, color: '#999', textAlign: 'center' }}>
          东莞大满包装 · 长沙分公司
        </div>
      </div>
    </div>
  )
}
