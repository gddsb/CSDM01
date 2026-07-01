import { useState } from 'react'
import { Card, Form, Input, Button, Select, message, Typography } from 'antd'
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons'
import { useApp } from '../contexts/AppContext'
import { users } from '../mock/data'
import logoSquare from '../assets/logo-square.png'

const { Text } = Typography

export default function Login() {
  const { login } = useApp()
  const [loading, setLoading] = useState(false)

  const onFinish = (values) => {
    setLoading(true)
    setTimeout(() => {
      const result = login(values.username, values.password)
      if (result.success) {
        message.success('登录成功')
      } else {
        message.error(result.message)
      }
      setLoading(false)
    }, 500)
  }

  const quickLogin = (username) => {
    setLoading(true)
    setTimeout(() => {
      const result = login(username, '123456')
      if (!result.success) message.error(result.message)
      setLoading(false)
    }, 300)
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logoSquare} alt="logo" style={{ height: 56, width: 'auto', objectFit: 'contain', marginBottom: 8 }} />
          <div className="login-title">奶粉罐生产管理系统</div>
          <div className="login-subtitle">Milk Can Production Management System V4.3</div>
        </div>
        <Form name="login" onFinish={onFinish} size="large" initialValues={{ username: '超级管理员', password: '123456' }}>
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
            {users.slice(0, 9).map(u => (
              <Button key={u.user_id} size="small" onClick={() => quickLogin(u.username)} style={{ fontSize: 12 }}>
                {u.username}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
