import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Input, Button, Toast } from 'antd-mobile'
import { UserOutline, LockOutline } from 'antd-mobile-icons'
import { useApp } from '../../contexts/AppContext'

export default function MobileLogin() {
  const { login, currentUser } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)

  // 已登录用户访问登录页时直接跳转
  useEffect(() => {
    if (currentUser) {
      const redirect = searchParams.get('redirect') || '/mobile'
      navigate(redirect, { replace: true })
    }
  }, [currentUser, navigate, searchParams])

  const handleSubmit = async () => {
    if (!username || !password) {
      Toast.show({ icon: 'fail', content: '请输入用户名和密码' })
      return
    }
    setLoading(true)
    const result = await login(username, password)
    if (result.success) {
      Toast.show({ icon: 'success', content: '登录成功' })
      const redirect = searchParams.get('redirect') || '/mobile'
      setTimeout(() => navigate(redirect, { replace: true }), 300)
    } else {
      Toast.show({ icon: 'fail', content: result.message || '登录失败' })
    }
    setLoading(false)
  }

  return (
    <div className="mobile-shell" style={{ background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 32px', color: '#fff',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>MES工作台</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>奶粉罐生产管理系统 V1.0.1.1</div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 12, padding: 24,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#212121', marginBottom: 20, textAlign: 'center' }}>
            用户登录
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#616161', marginBottom: 6 }}>用户名</div>
            <div style={{ position: 'relative' }}>
              <UserOutline style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9E9E' }} />
              <Input
                value={username}
                onChange={setUsername}
                placeholder="请输入用户名"
                clearable
                style={{ '--padding-left': '36px', height: 44, border: '1px solid #e0e0e0', borderRadius: 8 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#616161', marginBottom: 6 }}>密码</div>
            <div style={{ position: 'relative' }}>
              <LockOutline style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9E9E' }} />
              <Input
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="请输入密码"
                clearable
                style={{ '--padding-left': '36px', height: 44, border: '1px solid #e0e0e0', borderRadius: 8 }}
              />
            </div>
          </div>

          <Button
            block
            color="primary"
            size="large"
            loading={loading}
            onClick={handleSubmit}
            style={{ borderRadius: 8, height: 44 }}
          >
            登 录
          </Button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, opacity: 0.7 }}>
          © 2026 大满乳业 · 奶粉罐MES
        </div>
      </div>
    </div>
  )
}
