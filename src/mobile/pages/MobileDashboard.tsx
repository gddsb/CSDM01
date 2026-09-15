/**
 * 移动端工作台（Dashboard）
 * - 顶部欢迎语 + 今日统计
 * - 中部大卡片快捷入口（报工、来料检、设备点检、质量追溯、更多）
 * - 底部最近待办（可选，后续接 API）
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid, Badge, PullToRefresh, Toast } from 'antd-mobile'
import { AppOutline, BillOutline, CheckOutline, TeamOutline, UserOutline } from 'antd-mobile-icons'
import { AppstoreOutline, SetOutline } from 'antd-mobile-icons'
import { useApp } from '../../contexts/AppContext'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import api from '../../utils/api'

interface QuickEntry {
  key: string
  title: string
  icon: React.ReactNode
  color: string
  path?: string
  disabled?: boolean
  badge?: number
  /** 权限码：配置后用户需具备该权限码（或父级）才显示 */
  permCode?: string
}

const entries: QuickEntry[] = [
  { key: 'reporting', title: '移动报工', icon: <BillOutline fontSize={32} />, color: '#2196F3', path: '/m/process-reporting', permCode: 'production:reporting' },
  { key: 'incoming', title: '来料检验', icon: <CheckOutline fontSize={32} />, color: '#4CAF50', path: '/m/incoming-inspection', permCode: 'quality:incoming' },
  { key: 'device', title: '设备点检', icon: <TeamOutline fontSize={32} />, color: '#FF9800', path: '/m/device-inspection', permCode: 'device:inspection' },
  { key: 'maintenance', title: '设备保养', icon: <SetOutline fontSize={32} />, color: '#00BCD4', path: '/m/device-maintenance', permCode: 'device:maintenance' },
  { key: 'exception', title: '异常上报', icon: <AppstoreOutline fontSize={32} />, color: '#F44336', path: '/m/exception-report', permCode: 'production:reporting' },
  { key: 'process', title: '过程检验', icon: <CheckOutline fontSize={32} />, color: '#3F51B5', path: '/m/process-inspection', permCode: 'quality:process' },
]

export default function MobileDashboard() {
  const { currentUser, hasPermission } = useApp()
  const navigate = useNavigate()
  const [stats, setStats] = useState<{ pendingOrders: number; todayReports: number } | null>(null)
  const { pending, refresh: refreshQueue } = useOfflineQueue()

  // 按权限过滤快捷入口
  const visibleEntries = entries.filter(e => !e.permCode || hasPermission(e.permCode))

  // 轻量今日统计（可选，后续对接真实后端统计接口）
  const loadStats = useCallback(() => {
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

  useEffect(() => {
    const cleanup = loadStats()
    return cleanup
  }, [loadStats])

  // 下拉刷新：重新拉取统计 + 同步离线队列计数
  const onRefresh = async () => {
    loadStats()
    await refreshQueue()
    Toast.show({ content: '已刷新', icon: 'success', position: 'bottom', duration: 600 })
  }

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
    <PullToRefresh onRefresh={onRefresh} className="mobile-page" style={{ paddingTop: 16 }}>
      {/* 欢迎区 */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: '#888' }}>{greeting}，{name}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#222', marginTop: 4 }}>
          今天也要加油 💪
        </div>
        {pending > 0 && (
          <div style={{ fontSize: 11, color: '#E65100', marginTop: 4 }}>
            📥 {pending} 条离线请求待同步
          </div>
        )}
      </div>

      {/* 今日统计卡 */}
      <div style={{
        background: 'linear-gradient(135deg, #1976D2 0%, #42A5F5 100%)',
        borderRadius: 14, padding: '18px 20px', color: '#fff', marginBottom: 20,
        boxShadow: '0 6px 16px rgba(33,150,243,0.25)',
      }}>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>今日概览 · 下拉刷新</div>
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
        {visibleEntries.map((entry) => (
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
    </PullToRefresh>
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
