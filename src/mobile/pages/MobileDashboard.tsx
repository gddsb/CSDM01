/**
 * 移动端工作台（Dashboard）
 * - 顶部欢迎语 + 今日统计
 * - 中部大卡片快捷入口（报工、来料检、设备点检、质量追溯、更多）
 * - 底部最近待办（可选，后续接 API）
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid, Badge } from 'antd-mobile'
import { AppOutline, BillOutline, CheckOutline, TeamOutline, UserOutline } from 'antd-mobile-icons'
import { useApp } from '../../contexts/AppContext'
import api from '../../utils/api'

interface QuickEntry {
  key: string
  title: string
  icon: React.ReactNode
  color: string
  path?: string
  disabled?: boolean
  badge?: number
}

const entries: QuickEntry[] = [
  { key: 'reporting', title: '移动报工', icon: <BillOutline fontSize={32} />, color: '#2196F3', path: '/m/process-reporting' },
  { key: 'incoming', title: '来料检验', icon: <CheckOutline fontSize={32} />, color: '#4CAF50', path: '/m/incoming-inspection' },
  { key: 'device', title: '设备点检', icon: <TeamOutline fontSize={32} />, color: '#FF9800', path: '/m/device-inspection' },
  { key: 'trace', title: '质量追溯', icon: <AppOutline fontSize={32} />, color: '#9C27B0', disabled: true },
]

export default function MobileDashboard() {
  const { currentUser } = useApp()
  const navigate = useNavigate()
  const [stats, setStats] = useState<{ pendingOrders: number; todayReports: number } | null>(null)

  // 轻量今日统计（可选，后续对接真实后端统计接口）
  useEffect(() => {
    let canceled = false
    // 用现有后端数据拼装：待报工工单
    api.get('/production/report-orders', { params: { page: 1, page_size: 1, status: '待报工' } })
      .then((r: any) => { if (!canceled && r.success) setStats((s) => ({ ...(s || { pendingOrders: 0, todayReports: 0 }), pendingOrders: r.data?.total || r.total || 0 })) })
      .catch(() => {})
    api.get('/production/report-orders', { params: { page: 1, page_size: 1, status: '已完成' } })
      .then((r: any) => { if (!canceled && r.success) setStats((s) => ({ ...(s || { pendingOrders: 0, todayReports: 0 }), todayReports: r.data?.total || r.total || 0 })) })
      .catch(() => {})
    return () => { canceled = true }
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 6) return '凌晨好'
    if (h < 12) return '早上好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  })()

  const name = currentUser?.real_name || currentUser?.username || '同事'

  return (
    <div className="mobile-page" style={{ paddingTop: 16 }}>
      {/* 欢迎区 */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: '#888' }}>{greeting}，{name}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#222', marginTop: 4 }}>
          今天也要加油 💪
        </div>
      </div>

      {/* 今日统计卡 */}
      <div style={{
        background: 'linear-gradient(135deg, #1976D2 0%, #42A5F5 100%)',
        borderRadius: 14, padding: '18px 20px', color: '#fff', marginBottom: 20,
        boxShadow: '0 6px 16px rgba(33,150,243,0.25)',
      }}>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>今日概览</div>
        <div style={{ display: 'flex', gap: 28 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>
              {stats ? stats.pendingOrders : '—'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>待报工</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>
              {stats ? stats.todayReports : '—'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>已完成工序</div>
          </div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 10 }}>
        快捷操作
      </div>
      <Grid columns={2} gap={12}>
        {entries.map((entry) => (
          <Grid.Item key={entry.key}>
            <QuickCard entry={entry} onClick={() => {
              if (entry.disabled) {
                // 暂未开放
                return
              }
              if (entry.path) navigate(entry.path)
            }} />
          </Grid.Item>
        ))}
      </Grid>

      {/* 底部空出 TabBar + safe-area */}
      <div style={{ height: 20 }} />
    </div>
  )
}

function QuickCard({ entry, onClick }: { entry: QuickEntry; onClick: () => void }) {
  return (
    <Badge content={entry.badge || null}>
      <div
        onClick={onClick}
        style={{
          background: entry.disabled ? '#f5f6f8' : '#fff',
          borderRadius: 14,
          padding: '22px 16px',
          textAlign: 'center',
          border: '1px solid #eef0f3',
          opacity: entry.disabled ? 0.6 : 1,
          cursor: entry.disabled ? 'not-allowed' : 'pointer',
        }}
        className="mobile-clickable"
      >
        <div style={{ color: entry.color, marginBottom: 10 }}>{entry.icon}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
          {entry.title}
        </div>
        {entry.disabled && (
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>即将上线</div>
        )}
      </div>
    </Badge>
  )
}
