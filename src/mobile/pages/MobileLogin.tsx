import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Input, Button, Toast, CheckList } from 'antd-mobile'
import { UserOutline, LockOutline } from 'antd-mobile-icons'
import { useApp } from '../../contexts/AppContext'
import './mobile-login.css'

export default function MobileLogin() {
  const { login, currentUser } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(true)

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
    <div className="m-login-bg">
      <div className="m-login-orb m-login-orb-1" />
      <div className="m-login-orb m-login-orb-2" />
      <div className="m-login-orb m-login-orb-3" />

      <div className="m-login-container">
        <div className="m-login-brand">
          <div className="m-login-logo">
            <span className="m-login-logo-en">daman</span>
            <span className="m-login-logo-cn">大满</span>
          </div>
          <div className="m-login-title">奶粉罐生产管理系统</div>
          <div className="m-login-subtitle">Milk Can Production MES</div>
        </div>

        <div className="m-login-card">
          <div className="m-login-card-title">
            <span className="m-login-card-bar" />
            用户登录
          </div>

          <div className="m-login-field">
            <div className="m-login-field-icon">
              <UserOutline />
            </div>
            <Input
              value={username}
              onChange={setUsername}
              placeholder="请输入用户名"
              clearable
              className="m-login-input"
            />
          </div>

          <div className="m-login-field">
            <div className="m-login-field-icon">
              <LockOutline />
            </div>
            <Input
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="请输入密码"
              clearable
              className="m-login-input"
            />
          </div>

          <div className="m-login-options">
            <div
              className="m-login-remember"
              onClick={() => setRemember(!remember)}
            >
              <span className={`m-login-check ${remember ? 'checked' : ''}`}>
                {remember && '✓'}
              </span>
              <span>记住密码</span>
            </div>
            <a
              className="m-login-forgot"
              onClick={() => Toast.show({ icon: 'info', content: '请联系管理员重置密码' })}
            >
              忘记密码？
            </a>
          </div>

          <Button
            block
            color="primary"
            size="large"
            loading={loading}
            onClick={handleSubmit}
            className="m-login-btn"
          >
            登 录
          </Button>
        </div>

        <div className="m-login-footer">
          © 2026 大满乳业 · 长沙大满MES
        </div>
      </div>
    </div>
  )
}
