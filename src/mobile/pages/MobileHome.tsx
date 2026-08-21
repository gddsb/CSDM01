import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileOutline,
  CheckShieldOutline,
  SetOutline,
  SearchOutline,
  ClockCircleOutline,
  ExclamationOutline,
  EditSOutline,
  RightOutline,
  FillinOutline,
  ScanCodeOutline,
  TeamOutline,
  FireFill,
  TruckOutline,
  StarOutline,
} from 'antd-mobile-icons'
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { useApp } from '../../contexts/AppContext'
import { useTodoStats } from '../../hooks/useTodoStats'
import './home.css'

// 主功能菜单 — 彩色图标 + 描述
const featureMenu = [
  { key: '/mobile/orders', name: '生产订单', desc: '派单/开工/完工', icon: <FileOutline fontSize={26} />, color: '#2196F3', bg: '#E3F2FD', enabled: true },
  { key: '/mobile/reporting', name: '生产报工', desc: '扫码快速报工', icon: <FillinOutline fontSize={26} />, color: '#4CAF50', bg: '#E8F5E9', enabled: true },
  { key: '/mobile/quality', name: '质量检验', desc: '来料/过程/成品', icon: <CheckShieldOutline fontSize={26} />, color: '#9C27B0', bg: '#F3E5F5', enabled: true },
  { key: '/mobile/inspection', name: '设备巡检', desc: '日常/月度巡检', icon: <SetOutline fontSize={26} />, color: '#00BCD4', bg: '#E0F7FA', enabled: true },
  { key: '/mobile/device-inspection', name: '设备点检', desc: '今日点检任务', icon: <CheckCircleOutlined style={{ fontSize: 26 }} />, color: '#4CAF50', bg: '#E8F5E9', enabled: true },
  { key: '/mobile/device-fault', name: '故障上报', desc: '设备故障上报', icon: <WarningOutlined style={{ fontSize: 26 }} />, color: '#F44336', bg: '#FFEBEE', enabled: true },
  { key: '/mobile/craft', name: '工艺查询', desc: 'BOM/SOP 查看', icon: <SearchOutline fontSize={26} />, color: '#FF9800', bg: '#FFF3E0', enabled: false },
  { key: '/mobile/trace', name: '工单追踪', desc: '全过程追溯', icon: <ClockCircleOutline fontSize={26} />, color: '#E91E63', bg: '#FCE4EC', enabled: false },
  { key: '/mobile/exception', name: '异常上报', desc: '设备/质量异常', icon: <ExclamationOutline fontSize={26} />, color: '#F44336', bg: '#FFEBEE', enabled: false },
  { key: '/mobile/archive', name: '档案更新', desc: '物料/工艺变更', icon: <EditSOutline fontSize={26} />, color: '#FFC107', bg: '#FFFDE7', enabled: false },
]

// 快捷操作 — 大卡片
const quickActions = [
  { key: '/mobile/reporting', title: '扫码报工', subtitle: '快速完成当日报工', icon: <ScanCodeOutline fontSize={22} />, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', badge: '待办 5' },
  { key: '/mobile/orders', title: '待开工工单', subtitle: '3 个工单等待开工', icon: <FireFill fontSize={22} />, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', badge: '3 个' },
  { key: '/mobile/quality', title: '待检通知', subtitle: '2 件待检品需要处理', icon: <StarOutline fontSize={22} />, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', badge: '2 项' },
  { key: '/mobile/inspection', title: '设备维护', subtitle: '1 台设备即将到期', icon: <TruckOutline fontSize={22} />, gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', badge: '1 台' },
]

// 待办列表（模拟数据，后续接入 API）
const recentItems = [
  { id: 1, title: '奶粉罐-500g 生产订单 WO-2026-0820', status: '进行中', time: '30分钟前', type: 'order' },
  { id: 2, title: '成品检验批次 QC-2026-0820-015', status: '待处理', time: '1小时前', type: 'quality' },
  { id: 3, title: '3#灌装机月度巡检', status: '逾期', time: '昨天', type: 'device' },
]

export default function MobileHome() {
  const navigate = useNavigate()
  const { currentUser, systemConfig } = useApp()
  const { stats } = useTodoStats()

  const userName = currentUser?.real_name || currentUser?.username || '用户'
  const systemName = systemConfig.system_name || '奶粉罐MES'

  // 问候语
  const hour = new Date().getHours()
  const greeting = hour < 6 ? '凌晨好' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'

  // 日期
  const now = new Date()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekDays[now.getDay()]}`

  const getStatusClass = (status: string) => {
    if (status === '逾期') return 'status-overdue'
    if (status === '待处理') return 'status-pending'
    if (status === '进行中') return 'status-progress'
    return 'status-done'
  }

  const getTypeIcon = (type: string) => {
    if (type === 'quality') return <CheckShieldOutline />
    if (type === 'device') return <SetOutline />
    return <FileOutline />
  }

  const handleNav = (key: string) => {
    // 检查是否启用
    const item = featureMenu.find(m => m.key === key)
    if (item && !item.enabled) {
      // 未开发功能跳转到占位页
      const name = featureMenu.find(m => m.key === key)?.name
      navigate(`/mobile/${key.split('/').pop()}`)
      return
    }
    navigate(key)
  }

  return (
    <div className="mobile-page home-page">
      {/* 欢迎区 — 渐变头部 */}
      <div className="home-hero">
        <div className="home-hero-top">
          <div className="home-greeting">
            <span className="home-greeting-text">{greeting}，{userName}</span>
            <span className="home-date">{dateStr}</span>
          </div>
          <div className="home-hero-brand">
            <span className="home-brand-name">{systemName}</span>
          </div>
        </div>

        {/* 快捷统计 — 3 列 */}
        <div className="home-stats">
          <div className="home-stat-item" onClick={() => navigate('/mobile/orders')}>
            <div className="home-stat-value">{stats.deviceMaintenance}</div>
            <div className="home-stat-label">待开工</div>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat-item" onClick={() => navigate('/mobile/reporting')}>
            <div className="home-stat-value">{stats.processInspection}</div>
            <div className="home-stat-label">进行中</div>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat-item" onClick={() => navigate('/mobile/quality')}>
            <div className="home-stat-value">{stats.incomingInspection + stats.processInspection}</div>
            <div className="home-stat-label">待检</div>
          </div>
        </div>
      </div>

      {/* 快捷操作 — 大卡片 */}
      <div className="home-section-header">
        <span className="home-section-title">快捷操作</span>
        <span className="home-section-more" onClick={() => navigate('/mobile/orders')}>全部</span>
      </div>
      <div className="home-quick-actions">
        {quickActions.map(action => (
          <div
            key={action.key}
            className="home-quick-card"
            onClick={() => navigate(action.key)}
            style={{ background: action.gradient }}
          >
            <div className="home-quick-card-icon">{action.icon}</div>
            <div className="home-quick-card-info">
              <div className="home-quick-card-title">{action.title}</div>
              <div className="home-quick-card-sub">{action.subtitle}</div>
            </div>
            <div className="home-quick-card-badge">{action.badge}</div>
          </div>
        ))}
      </div>

      {/* 功能菜单 — 4 列网格 */}
      <div className="home-section-header">
        <span className="home-section-title">全部功能</span>
      </div>
      <div className="home-feature-grid">
        {featureMenu.map(item => (
          <div
            key={item.key}
            className={`home-feature-item ${!item.enabled ? 'disabled' : ''}`}
            onClick={() => handleNav(item.key)}
          >
            <div className="home-feature-icon" style={{ background: item.bg, color: item.color }}>
              {item.icon}
            </div>
            <div className="home-feature-name">{item.name}</div>
            <div className="home-feature-desc">{item.enabled ? item.desc : '即将上线'}</div>
          </div>
        ))}
      </div>

      {/* 待办事项 */}
      <div className="home-section-header">
        <span className="home-section-title">最近待办</span>
        <span className="home-section-more" onClick={() => navigate('/mobile/orders')}>查看全部</span>
      </div>
      <div className="home-recent-list">
        {recentItems.map(item => (
          <div
            key={item.id}
            className="home-recent-item"
            onClick={() => navigate('/mobile/orders')}
          >
            <div className="home-recent-icon" style={{
              background: item.type === 'quality' ? '#F3E5F5' : item.type === 'device' ? '#E0F7FA' : '#E3F2FD',
              color: item.type === 'quality' ? '#9C27B0' : item.type === 'device' ? '#00BCD4' : '#2196F3',
            }}>
              {getTypeIcon(item.type)}</div>
            <div className="home-recent-info">
              <div className="home-recent-title">{item.title}</div>
              <div className="home-recent-meta">
                <span className={`home-status-tag ${getStatusClass(item.status)}`}>{item.status}</span>
                <span className="home-recent-time">{item.time}</span>
              </div>
            </div>
            <div className="home-recent-arrow">
              <RightOutline fontSize={14} />
            </div>
          </div>
        ))}
      </div>

      {/* 团队协作提示 */}
      <div className="home-team-tip" onClick={() => navigate('/mobile/profile')}>
        <div className="home-team-icon"><TeamOutline fontSize={20} /></div>
        <div className="home-team-info">
          <div className="home-team-title">在线 5 位同事</div>
          <div className="home-team-sub">点击查看团队成员</div>
        </div>
        <RightOutline fontSize={14} color="#9E9E9E" />
      </div>
    </div>
  )
}
