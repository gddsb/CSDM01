import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd-mobile'

export default function PlaceholderPage({ title }) {
  const navigate = useNavigate()
  return (
    <div className="mobile-page" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 12, color: '#BDBDBD' }}>🚧</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#424242', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: '#9E9E9E', marginBottom: 24, padding: '0 32px' }}>
        该功能正在开发中，敬请期待
      </div>
      <Button color="primary" fill="outline" size="small" onClick={() => navigate('/mobile/home')}>
        返回首页
      </Button>
    </div>
  )
}
