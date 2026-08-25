import { useState } from 'react'
import { Form, Input, Button, Typography, Checkbox } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useApp, useMessage } from '../contexts/AppContext'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography

export default function Login() {
  const message = useMessage()
  const { login, systemConfig } = useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(true)

  // 上次登录用户名（首次进入默认 admin，使用初始密码 123456；改密后由用户输入实际密码）
  const lastUsername = localStorage.getItem('mes_last_username') || 'admin'

  const onFinish = async (values) => {
    setLoading(true)
    const result = await login(values.username, values.password)
    if (result.success) {
      if (remember) {
        localStorage.setItem('mes_last_username', values.username)
      } else {
        localStorage.removeItem('mes_last_username')
      }
      message.success('登录成功')
      const targetPath = result.isViewer ? '/bigscreen/production' : '/dashboard'
      navigate(targetPath)
    } else {
      message.error(result.message)
    }
    setLoading(false)
  }

  return (
    <div className="login-bg">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />
      <div className="login-grid-overlay" />

      <div className="login-wrapper">
        <div className="login-brand-section">
          <div className="login-brand-logo">
            <div className="daman-logo">
              <span className="daman-en">daman</span>
              <span className="daman-cn">大满</span>
            </div>
          </div>
          <h1 className="login-brand-title">奶粉罐生产管理系统</h1>
          <p className="login-brand-subtitle">Milk Can Production Management System</p>
          <div className="login-brand-tags">
            <span className="login-brand-tag">精益生产</span>
            <span className="login-brand-tag">品质管控</span>
            <span className="login-brand-tag">全程追溯</span>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-card-title">用户登录</h2>
            <p className="login-card-desc">欢迎回来，请输入您的账号信息</p>
          </div>

          <Form
            name="login"
            onFinish={onFinish}
            size="large"
            initialValues={{ username: lastUsername }}
            className="login-form"
          >
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input
                prefix={<UserOutlined className="login-input-icon" />}
                placeholder="请输入用户名"
                className="login-input"
              />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined className="login-input-icon" />}
                placeholder="请输入密码"
                className="login-input"
              />
            </Form.Item>

            <div className="login-form-options">
              <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
                记住用户名
              </Checkbox>
              <a className="login-forgot-link" onClick={() => message.info('请联系管理员重置密码')}>
                忘记密码？
              </a>
            </div>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" loading={loading} block className="login-submit-btn">
                登 录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>

      <div className="login-footer">
        <Text type="secondary" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          © 2026 大满包装 · 长沙大满MES {systemConfig.system_version || ''}
        </Text>
      </div>
    </div>
  )
}
