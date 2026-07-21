import { useState } from 'react'
import { Card, Form, Input, Button, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useApp, useMessage } from '../contexts/AppContext'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography

export default function Login() {
  const message = useMessage()
  const { login } = useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values) => {
    setLoading(true)
    const result = await login(values.username, values.password)
    if (result.success) {
      message.success('登录成功')
      const targetPath = result.isViewer ? '/bigscreen/production' : '/dashboard'
      console.log('登录成功，完整链接地址：', `${window.location.origin}${targetPath}`)
      navigate(targetPath)
    } else {
      message.error(result.message)
    }
    setLoading(false)
  }

  const quickLogin = async (username) => {
    setLoading(true)
    const result = await login(username, '123456')
    if (result.success) {
      message.success('登录成功')
      const targetPath = result.isViewer ? '/bigscreen/production' : '/dashboard'
      console.log('登录成功，完整链接地址：', `${window.location.origin}${targetPath}`)
      navigate(targetPath)
    } else {
      message.error(result.message)
    }
    setLoading(false)
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="daman-logo" style={{ marginBottom: 8 }}>
            <span className="daman-en">daman</span>
            <span className="daman-cn">大满</span>
          </div>
          <div className="login-title">奶粉罐生产管理系统</div>
          <div className="login-subtitle">Milk Can Production Management System V1.0.1.722</div>
        </div>
        <Form name="login" onFinish={onFinish} size="large" initialValues={{ username: 'admin', password: '123456' }}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44 }}>
              登 录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>快捷登录（统一密码 123456）：</Text>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Button size="small" onClick={() => quickLogin('admin')} style={{ fontSize: 12 }}>
              admin
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
