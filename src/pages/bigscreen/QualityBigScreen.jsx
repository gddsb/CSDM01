import React from 'react'
import { Empty } from 'antd'
import { useNavigate } from 'react-router-dom'
import logoRect from '../../assets/logo-rect.png'
import '../../styles/bigscreen.css'

export default function QualityBigScreen() {
  const navigate = useNavigate()
  return (
    <div className="bigscreen-container">
      <div className="bs-header">
        <div className="bs-title">
          <img src={logoRect} alt="logo" style={{ height: 40, width: 'auto', marginRight: 12, verticalAlign: 'middle' }} />
          质量分析看板
        </div>
        <button className="bs-back-btn" onClick={() => navigate('/dashboard')}>返回</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 88px)' }}>
        <Empty description="质量分析看板开发中" style={{ fontSize: 24 }} />
      </div>
    </div>
  )
}
