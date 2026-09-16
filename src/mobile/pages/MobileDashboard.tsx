/**
 * 移动端工作台（Dashboard）— 九宫格可排序版
 * - 顶部欢迎语 + 今日统计
 * - 中部 3×N 九宫格快捷入口（自动排布）
 * - 长按卡片进入「编辑模式」，可上下移动调整顺序
 * - 顺序持久化到 localStorage: mobile_home_order
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid, Badge, PullToRefresh, Toast, Button } from 'antd-mobile'
import {
  BillOutline, CheckOutline, TeamOutline, SetOutline, AppstoreOutline,
  FlagOutline, SearchOutline, CalendarOutline, PieOutline, FolderOutline,
  FileOutline, ChatAddOutline,
} from 'antd-mobile-icons'
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

/** 默认顺序（9宫格） */
const DEFAULT_ORDER: QuickEntry[] = [
  { key: 'reporting', title: '移动报工', icon: <BillOutline fontSize={28} />, color: '#2196F3', path: '/m/process-reporting', permCode: 'production:reporting' },
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

function loadOrderKeys(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.filter((k) => typeof k === 'string')
  } catch { /* ignore */ }
  return null
}

function saveOrderKeys(keys: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)) } catch { /* ignore */ }
}

/** 根据 localStorage 里的 key 顺序排列 entries；缺失/新增的 key 追加到末尾 */
function applyCustomOrder(entries: QuickEntry[], customKeys: string[] | null): QuickEntry[] {
  if (!customKeys || customKeys.length === 0) return entries
  const map = new Map(entries.map((e) => [e.key, e]))
  const ordered: QuickEntry[] = []
  customKeys.forEach((k) => {
    const e = map.get(k)
    if (e) {
      ordered.push(e)
      map.delete(k)
    }
  })
  // 追加剩余（新增的或没在 customKeys 里的）
  map.forEach((e) => ordered.push(e))
  return ordered
}

export default function MobileDashboard() {
  const { currentUser, hasPermission } = useApp()
  const navigate = useNavigate()
  const [stats, setStats] = useState<{ pendingOrders: number; todayReports: number } | null>(null)
  const { pending, refresh: refreshQueue } = useOfflineQueue()

  // 是否处于编辑模式
  const [editing, setEditing] = useState(false)
  // 当前已排序的 entries（权限过滤后 + 用户自定义排序）
  const [ordered, setOrdered] = useState<QuickEntry[]>([])
  // 长按计时器 ref
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 初始化：按权限过滤 + 应用自定义顺序
  useEffect(() => {
    const visible = DEFAULT_ORDER.filter((e) => !e.permCode || hasPermission(e.permCode))
    const customKeys = loadOrderKeys()
    setOrdered(applyCustomOrder(visible, customKeys))
  }, [hasPermission])

  // 轻量今日统计（可选，后续对接真实后端统计接口）
  const loadStats = useCallback(() => {
    let canceled = false
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

  // 下拉刷新
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

  // === 编辑模式：移动卡片 ===
  const moveCard = (index: number, direction: -1 | 1) => {
    setOrdered((prev) => {
      const nextIdx = index + direction
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const arr = [...prev]
      const [moved] = arr.splice(index, 1)
      arr.splice(nextIdx, 0, moved)
      return arr
    })
  }

  const saveEdit = () => {
    saveOrderKeys(ordered.map((e) => e.key))
    setEditing(false)
    Toast.show({ content: '顺序已保存', icon: 'success', position: 'bottom', duration: 800 })
  }

  const resetEdit = () => {
    setEditing(false)
  }

  const resetToDefault = () => {
    localStorage.removeItem(STORAGE_KEY)
    const visible = DEFAULT_ORDER.filter((e) => !e.permCode || hasPermission(e.permCode))
    setOrdered(visible)
    setEditing(false)
    Toast.show({ content: '已恢复默认顺序', icon: 'success', position: 'bottom', duration: 800 })
  }

  // === 长按处理 ===
  const handlePressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setEditing(true)
      Toast.show({ content: '进入编辑模式：点击 ▲▼ 调整顺序', position: 'bottom', duration: 1500 })
    }, 600)
  }
  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
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

      {/* 快捷入口 标题 + 编辑操作栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>快捷操作</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="mini" fill="outline" onClick={resetToDefault}>恢复默认</Button>
            <Button size="mini" fill="outline" onClick={resetEdit}>取消</Button>
            <Button size="mini" color="primary" onClick={saveEdit}>保存</Button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#999' }}>长按可调整顺序</span>
        )}
      </div>

      {/* 九宫格 — 3 列自动排布 */}
      <Grid columns={3} gap={10}>
        {ordered.map((entry, idx) => (
          <Grid.Item key={entry.key}>
            <QuickCard
              entry={entry}
              index={idx}
              total={ordered.length}
              editing={editing}
              onMove={moveCard}
              onClick={() => {
                if (editing) return // 编辑模式下禁止跳转
                if (entry.disabled) return
                if (entry.path) navigate(entry.path)
              }}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
            />
          </Grid.Item>
        ))}
      </Grid>

      {/* 底部空出 TabBar + safe-area */}
      <div style={{ height: 20 }} />
    </PullToRefresh>
  )
}

interface QuickCardProps {
  entry: QuickEntry
  index: number
  total: number
  editing: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onClick: () => void
  onPressStart: () => void
  onPressEnd: () => void
}

function QuickCard({ entry, index, total, editing, onMove, onClick, onPressStart, onPressEnd }: QuickCardProps) {
  return (
    <Badge content={entry.badge || null}>
      <div
        onClick={onClick}
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onMouseLeave={onPressEnd}
        onTouchStart={onPressStart}
        onTouchEnd={onPressEnd}
        onTouchCancel={onPressEnd}
        style={{
          position: 'relative',
          background: entry.disabled ? '#f5f6f8' : '#fff',
          borderRadius: 12,
          padding: '16px 8px 14px',
          textAlign: 'center',
          border: editing ? '2px solid #2196F3' : '1px solid #eef0f3',
          opacity: entry.disabled ? 0.6 : 1,
          cursor: editing ? 'move' : (entry.disabled ? 'not-allowed' : 'pointer'),
          transition: 'transform 0.12s, border-color 0.12s',
          userSelect: 'none',
        }}
        className="mobile-clickable"
      >
        {/* 编辑模式：移动按钮 */}
        {editing && (
          <div style={{
            position: 'absolute', top: 2, right: 4, display: 'flex', gap: 2,
            fontSize: 14, lineHeight: 1, zIndex: 5,
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onMove(index, -1) }}
              disabled={index === 0}
              style={{
                width: 22, height: 22, borderRadius: 4, border: '1px solid #ddd',
                background: index === 0 ? '#f5f5f5' : '#fff',
                color: index === 0 ? '#bbb' : '#2196F3', cursor: index === 0 ? 'not-allowed' : 'pointer',
                lineHeight: '20px', padding: 0, fontSize: 12,
              }}
            >▲</button>
            <button
              onClick={(e) => { e.stopPropagation(); onMove(index, 1) }}
              disabled={index >= total - 1}
              style={{
                width: 22, height: 22, borderRadius: 4, border: '1px solid #ddd',
                background: index >= total - 1 ? '#f5f5f5' : '#fff',
                color: index >= total - 1 ? '#bbb' : '#2196F3', cursor: index >= total - 1 ? 'not-allowed' : 'pointer',
                lineHeight: '20px', padding: 0, fontSize: 12,
              }}
            >▼</button>
          </div>
        )}

        <div style={{ color: entry.color, marginBottom: 6 }}>{entry.icon}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#333', lineHeight: 1.2 }}>
          {entry.title}
        </div>
        {entry.disabled && (
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>即将上线</div>
        )}
      </div>
    </Badge>
  )
}
