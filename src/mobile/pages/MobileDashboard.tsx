/**
 * 移动端工作台（Dashboard）— 三栏式
 * ┌──────────────────────────────┐
 * │ 🔔 通知（15%）               │  ← 顶部，从异常/待办中提取高优先级
 * ├──────────────────────────────┤
 * │ ⚡ 快捷操作（35%，横向滑）   │  ← ScrollView 横排，超出左右滑
 * ├──────────────────────────────┤
 * │ 📋 代办任务（50%）           │  ← 剩余空间
 * └──────────────────────────────┘
 *
 * 保留：
 *   - 快捷操作权限过滤 + localStorage 排序持久化
 *   - loadTodos 并发请求待办数量
 *   - 下拉刷新
 *   - 离线暂存条目
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh, Toast } from 'antd-mobile'
import {
  BillOutline, CheckOutline, TeamOutline, SetOutline, AppstoreOutline,
  FlagOutline, SearchOutline, CalendarOutline, PieOutline, FolderOutline,
  FileOutline, ChatAddOutline,
} from 'antd-mobile-icons'
import { useApp } from '../../contexts/AppContext'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import api from '../../utils/api'

interface TodoItem {
  icon: string
  text: string
  count: number
  path: string
  color: string
}

interface QuickEntry {
  key: string
  title: string
  icon: React.ReactNode
  color: string
  path: string
  permCode?: string
  disabled?: boolean
}

/** 快捷操作全集（按权限过滤 + localStorage 排序） */
const DEFAULT_ORDER: QuickEntry[] = [
  { key: 'reporting', title: '移动报工', icon: <BillOutline fontSize={28} />, color: '#2196F3', path: '/m/process-reporting', permCode: 'production:reporting' },
  { key: 'prod-orders', title: '生产订单', icon: <CalendarOutline fontSize={28} />, color: '#FF9800', path: '/m/production-orders', permCode: 'production:reporting' },
  { key: 'incoming', title: '来料检验', icon: <CheckOutline fontSize={28} />, color: '#4CAF50', path: '/m/incoming-inspection', permCode: 'quality:incoming' },
  { key: 'process', title: '过程检验', icon: <CheckOutline fontSize={28} />, color: '#3F51B5', path: '/m/process-inspection', permCode: 'quality:process' },
  { key: 'device', title: '设备点检', icon: <TeamOutline fontSize={28} />, color: '#FF9800', path: '/m/device-inspection', permCode: 'device:inspection' },
  { key: 'maintenance', title: '设备保养', icon: <SetOutline fontSize={28} />, color: '#00BCD4', path: '/m/device-maintenance', permCode: 'device:maintenance' },
  { key: 'spare-parts', title: '备件管理', icon: <FolderOutline fontSize={28} />, color: '#607D8B', path: '/m/spare-parts', permCode: 'device:spare-part' },
  { key: 'device-fault', title: '设备故障', icon: <FlagOutline fontSize={28} />, color: '#E91E63', path: '/m/device-fault', permCode: 'device:fault' },
  { key: 'exception', title: '异常上报', icon: <AppstoreOutline fontSize={28} />, color: '#F44336', path: '/m/exception-report', permCode: 'production:reporting' },
  { key: 'daily-card', title: '日报卡', icon: <CalendarOutline fontSize={28} />, color: '#009688', path: '/m/daily-card' },
  { key: 'device-documents', title: '电子档案', icon: <FileOutline fontSize={28} />, color: '#795548', path: '/m/device-documents', permCode: 'device:document' },
  { key: 'oee', title: '设备OEE', icon: <PieOutline fontSize={28} />, color: '#5E35B1', path: '/m/device-oee', permCode: 'device:oee' },
  { key: 'calibration', title: '校准提醒', icon: <SetOutline fontSize={28} />, color: '#FF5722', path: '/m/calibration-reminder', permCode: 'device:calibration' },
  { key: 'inspection-history', title: '检验历史', icon: <SearchOutline fontSize={28} />, color: '#795548', path: '/m/inspection-history', permCode: 'quality:incoming' },
  { key: 'microbe', title: '微生物检验', icon: <CheckOutline fontSize={28} />, color: '#673AB7', path: '/m/microbe-inspection', permCode: 'quality:incoming' },
  { key: 'complaint', title: '投诉上报', icon: <ChatAddOutline fontSize={28} />, color: '#FF4081', path: '/m/complaint-report', permCode: 'quality:incoming' },
]

const STORAGE_KEY = 'mobile_home_order'

/** 根据 localStorage 自定义顺序重排（没有就按 DEFAULT_ORDER） */
function applyCustomOrder(entries: QuickEntry[], customKeys: string[] | null): QuickEntry[] {
  if (!customKeys || customKeys.length === 0) return entries
  const map = new Map(entries.map((e) => [e.key, e]))
  const ordered: QuickEntry[] = []
  customKeys.forEach((k) => {
    const e = map.get(k)
    if (e) ordered.push(e)
  })
  // 自定义列表里没出现的（权限变化新增的）追加到末尾
  entries.forEach((e) => {
    if (!ordered.find((o) => o.key === e.key)) ordered.push(e)
  })
  return ordered
}

/** 高优先级图标（用作通知区） */
const HIGH_PRIORITY_ICONS = new Set(['🚨', '🔧', '⚠️'])

export default function MobileDashboard() {
  const navigate = useNavigate()
  const { hasPermission, currentUser } = useApp()
  const { pending } = useOfflineQueue()

  // === 待办数据 ===
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)

  // === 快捷操作 ===
  const [ordered, setOrdered] = useState<QuickEntry[]>([])

  // === 通知区（从 todos 中筛选高优先级）===
  const notices = useMemo(
    () => todos.filter((t) => HIGH_PRIORITY_ICONS.has(t.icon) || t.color === '#E91E63' || t.color === '#F44336').slice(0, 3),
    [todos],
  )

  // ========== 初始化：权限过滤 + 排序持久化 ==========
  useEffect(() => {
    const visible = DEFAULT_ORDER.filter((e) => !e.permCode || hasPermission(e.permCode))
    let customKeys: string[] | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) customKeys = JSON.parse(raw)
    } catch { /* ignore */ }
    setOrdered(applyCustomOrder(visible, customKeys))
  }, [hasPermission])

  // ========== 加载代办 ==========
  const loadTodos = useCallback(async () => {
    const items: TodoItem[] = []
    type TodoResp = { icon: string; text: string; count: number; path: string; color: string }

    const apis: Promise<TodoResp>[] = [
      // 下发 → 待开工
      api.get('/production/orders', { params: { page: 1, pageSize: 1, status: 1 } })
        .then((r: any) => ({ icon: '📋', text: '待开工订单', count: r.data?.total ?? r.total ?? 0, path: '/m/production-orders?tab=下发', color: '#2196F3' })),
      // 开工 → 生产中
      api.get('/production/orders', { params: { page: 1, pageSize: 1, status: 2 } })
        .then((r: any) => ({ icon: '🏃', text: '生产中订单', count: r.data?.total ?? r.total ?? 0, path: '/m/production-orders?tab=开工', color: '#4CAF50' })),
      // 待报工
      api.get('/production/report-orders', { params: { page: 1, pageSize: 1, status: '待报工' } })
        .then((r: any) => ({ icon: '📝', text: '待报工任务', count: r.data?.total ?? r.total ?? 0, path: '/m/process-reporting', color: '#FF9800' })),
    ]

    if (hasPermission('quality:incoming')) {
      apis.push(
        api.get('/incoming-inspections', { params: { page: 1, pageSize: 1, status: '待检验' } })
          .then((r: any) => ({ icon: '🔍', text: '待来料检验', count: r.data?.total ?? r.total ?? 0, path: '/m/incoming-inspection', color: '#9C27B0' })),
      )
    }
    if (hasPermission('device:inspection')) {
      apis.push(
        api.get('/device-inspections', { params: { page: 1, pageSize: 1, status: '待点检' } })
          .then((r: any) => ({ icon: '⚙️', text: '待设备点检', count: r.data?.total ?? r.total ?? 0, path: '/m/device-inspection', color: '#00BCD4' })),
      )
    }

    // 高优先级：异常/故障/校准（用不同 icon 标记 → 通知区）
    if (hasPermission('device:fault')) {
      apis.push(
        api.get('/device-faults', { params: { page: 1, pageSize: 1, status: '待处理' } })
          .then((r: any) => ({ icon: '🚨', text: '设备故障待处理', count: r.data?.total ?? r.total ?? 0, path: '/m/device-fault', color: '#F44336' })),
      )
    }
    if (hasPermission('device:calibration')) {
      apis.push(
        api.get('/device-calibrations', { params: { page: 1, pageSize: 1, status: '待校准' } })
          .then((r: any) => ({ icon: '⚠️', text: '校准到期提醒', count: r.data?.total ?? r.total ?? 0, path: '/m/calibration-reminder', color: '#FF5722' })),
      )
    }

    try {
      const results = await Promise.allSettled(apis)
      results.forEach((res) => {
        if (res.status === 'fulfilled') items.push(res.value)
      })
    } catch { /* ignore */ }

    // 离线暂存总是显示
    items.push({ icon: '📥', text: '离线暂存待同步', count: pending, path: '/m/offline-queue', color: '#E65100' })

    const filtered = items.filter((i) => i.count > 0 || i.path === '/m/offline-queue')
    setTodos(filtered)
  }, [hasPermission, pending])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  const onRefresh = async () => {
    setLoading(true)
    try {
      await loadTodos()
      Toast.show({ content: '已刷新', position: 'bottom', duration: 1000 })
    } finally {
      setLoading(false)
    }
  }

  const handleEntryClick = (entry: QuickEntry) => {
    if (entry.path) navigate(entry.path)
  }
  const handleTodoClick = (todo: TodoItem) => navigate(todo.path)

  // ========== 渲染 ==========
  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="mobile-page" style={{ padding: '12px 12px 80px', minHeight: '100vh', background: '#F5F7FA' }}>

        {/* ============ 顶部：欢迎 + 通知 ============ */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
            你好，{currentUser?.real_name || '同事'} 👋
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>

        {/* 🔔 通知区（15%） */}
        <div
          style={{
            borderRadius: 12,
            background: notices.length > 0
              ? 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)'
              : '#FAFAFA',
            borderLeft: notices.length > 0 ? '3px solid #FF9800' : '3px solid #E0E0E0',
            padding: '10px 14px',
            marginBottom: 12,
            minHeight: 56,
          }}
        >
          {notices.length > 0 ? (
            <div
              style={{ display: 'flex', gap: 14, alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 2 }}
            >
              {notices.map((n) => (
                <div
                  key={n.path}
                  onClick={() => handleTodoClick(n)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    flexShrink: 0, fontSize: 13, color: '#BF360C', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{n.icon}</span>
                  <span>{n.text}</span>
                  <span
                    style={{
                      background: '#F44336', color: '#fff', fontSize: 11,
                      padding: '0 6px', borderRadius: 10, fontWeight: 600,
                    }}
                  >
                    {n.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '4px 0' }}>
              ✨ 当前无紧急通知
            </div>
          )}
        </div>

        {/* ⚡ 快捷操作（35%，横向滑） */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 4px 12px 4px',
              scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
            }}
          >
            {ordered.map((entry) => (
              <div
                key={entry.key}
                onClick={() => handleEntryClick(entry)}
                style={{
                  flexShrink: 0, width: 72, textAlign: 'center', cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 56, height: 56, borderRadius: 16, margin: '0 auto 6px',
                    background: entry.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: entry.color,
                  }}
                >
                  {entry.icon}
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>{entry.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 📋 代办任务（50%） */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            📋 待办事项
            <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>（{todos.length} 项）</span>
          </div>

          {todos.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: 12, padding: '30px 16px',
              textAlign: 'center', color: '#bbb', fontSize: 13,
            }}>
              🎉 太棒了！暂无待办任务
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todos.map((t) => (
                <div
                  key={t.path + t.text}
                  onClick={() => handleTodoClick(t)}
                  style={{
                    background: '#fff', borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  <div
                    style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: t.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    {t.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{t.text}</div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>点击查看</div>
                  </div>
                  <div
                    style={{
                      background: t.color, color: '#fff', fontSize: 13,
                      fontWeight: 700, padding: '2px 10px', borderRadius: 12, flexShrink: 0,
                    }}
                  >
                    {t.count}
                  </div>
                  <span style={{ color: '#ccc', fontSize: 16 }}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  )
}
