/**
 * 移动端工作台（Dashboard）— 九宫格可排序版
 * - 顶部欢迎语 + 今日统计
 * - 中部 3×N 九宫格快捷入口（自动排布）
 * - 长按卡片进入「编辑模式」，可上下移动调整顺序
 * - 顺序持久化到 localStorage: mobile_home_order
 */
import { useCallback, useEffect, useRef, useState } from 'react'
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

interface TodoItem {
  icon: string
  text: string
  count: number
  path: string
  color: string
}

/**
 * 动态计算九宫格列数
 * —— 基于卡片最小宽度 + 容器 padding + Grid gap 算出能放几列
 * —— 结果 clamp 到 [3, 7]，竖屏 3-4 列、横屏宽屏最多 7 列
 *
 * 每张卡片最小占位 ≈ 80px（含 gap），容器左右 padding ≈ 28px
 * cols = floor((width - padding) / (minCardWidth + gap))
 */
const MIN_CARD_UNIT = 90 // 80px 卡片宽 + 10px gap
const CONTAINER_PADDING = 28
function computeColumns(width: number): number {
  const raw = Math.floor((width - CONTAINER_PADDING) / MIN_CARD_UNIT)
  return Math.max(3, Math.min(7, raw))
}

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
  const { pending, refresh: refreshQueue } = useOfflineQueue()

  // 待办条目
  const [todos, setTodos] = useState<TodoItem[]>([])
  // 九宫格列数（响应式）
  const [columns, setColumns] = useState(() => computeColumns(typeof window !== 'undefined' ? window.innerWidth : 360))

  // 是否处于编辑模式
  const [editing, setEditing] = useState(false)
  // 当前已排序的 entries（权限过滤后 + 用户自定义排序）
  const [ordered, setOrdered] = useState<QuickEntry[]>([])
  // 长按计时器 ref
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 滚动定时器 ref
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 滚动偏移
  const [scrollOffset, setScrollOffset] = useState(0)

  // 初始化：按权限过滤 + 应用自定义顺序
  useEffect(() => {
    const visible = DEFAULT_ORDER.filter((e) => !e.permCode || hasPermission(e.permCode))
    const customKeys = loadOrderKeys()
    setOrdered(applyCustomOrder(visible, customKeys))
  }, [hasPermission])

  // 响应式列数监听
  useEffect(() => {
    const onResize = () => setColumns(computeColumns(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 加载待办条目（轻量：各列表接口取 total）
  const loadTodos = useCallback(async () => {
    const items: TodoItem[] = []

    // 并行拉几个 total（page_size=1 只为拿 total，响应最小）
    type TodoResp = { icon: string; text: string; count: number; path: string; color: string }
    const apis: Promise<TodoResp>[] = [
      // 待下发/开工订单
      api.get('/production/orders', { params: { page: 1, page_size: 1, status: '已下发' } })
        .then((r: any) => ({ icon: '📋', text: '待下发订单', count: r.data?.total || r.total || 0, path: '/m/production-orders', color: '#2196F3' })),
      // 生产中订单
      api.get('/production/orders', { params: { page: 1, page_size: 1, status: '生产中' } })
        .then((r: any) => ({ icon: '🏃', text: '生产中订单', count: r.data?.total || r.total || 0, path: '/m/production-orders', color: '#4CAF50' })),
      // 待报工报工单
      api.get('/production/report-orders', { params: { page: 1, page_size: 1, status: '待报工' } })
        .then((r: any) => ({ icon: '📝', text: '待报工任务', count: r.data?.total || r.total || 0, path: '/m/process-reporting', color: '#FF9800' })),
    ]

    // 权限过滤：检验/设备接口只给有权限的用户
    if (hasPermission('quality:incoming')) {
      apis.push(
        api.get('/incoming-inspections', { params: { page: 1, page_size: 1, status: '待检验' } })
          .then((r: any) => ({ icon: '🔍', text: '待来料检验', count: r.data?.total || r.total || 0, path: '/m/incoming-inspection', color: '#9C27B0' })),
      )
    }
    if (hasPermission('device:inspection')) {
      apis.push(
        api.get('/device-inspections', { params: { page: 1, page_size: 1, status: '待点检' } })
          .then((r: any) => ({ icon: '⚙️', text: '待设备点检', count: r.data?.total || r.total || 0, path: '/m/device-inspection', color: '#00BCD4' })),
      )
    }

    try {
      const results = await Promise.allSettled(apis)
      results.forEach(res => {
        if (res.status !== 'fulfilled') return
        items.push(res.value)
      })
    } catch { /* ignore */ }

    // 离线暂存条数总是显示
    items.push({ icon: '📥', text: '离线暂存待同步', count: pending, path: '/m/offline-queue', color: '#E65100' })

    // 只显示 count > 0 的（但保留离线条目即使为 0 也显示）
    const filtered = items.filter(i => i.count > 0 || i.path === '/m/offline-queue')
    setTodos(filtered)
  }, [hasPermission, pending])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  // 自动滚动：每 2.5s 滚一行
  useEffect(() => {
    if (todos.length <= 3) {
      setScrollOffset(0)
      return
    }
    scrollTimerRef.current = setInterval(() => {
      setScrollOffset(prev => {
        const max = todos.length - 3
        return prev >= max ? 0 : prev + 1
      })
    }, 2500)
    return () => {
      if (scrollTimerRef.current) clearInterval(scrollTimerRef.current)
    }
  }, [todos.length])

  // 下拉刷新
  const onRefresh = async () => {
    await loadTodos()
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

      {/* 待办卡 — 玻璃拟态 + 渐变 */}
      <div style={{
        background: 'linear-gradient(135deg, #1976D2 0%, #2196F3 45%, #42A5F5 100%)',
        borderRadius: 16, padding: '16px 18px', color: '#fff', marginBottom: 20,
        boxShadow: '0 8px 24px rgba(33,150,243,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 顶部装饰光斑 */}
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 120, height: 120,
          borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
          filter: 'blur(8px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: -20, width: 80, height: 80,
          borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
          filter: 'blur(6px)', pointerEvents: 'none',
        }} />

        <div style={{
          fontSize: 13, opacity: 0.95, marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          position: 'relative', zIndex: 1,
        }}>
          <span style={{ fontSize: 16 }}>📌</span>
          <span style={{ fontWeight: 600, letterSpacing: 0.5 }}>待办事项</span>
          <span style={{ fontSize: 11, opacity: 0.65, marginLeft: 'auto' }}>下拉刷新</span>
        </div>

        {/* 固定 3 行高度的滚动容器 */}
        <div style={{
          height: 132, // 3 行 × 44px (加 padding 后更宽松)
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}>
          <div style={{
            transform: `translateY(-${scrollOffset * 44}px)`,
            transition: 'transform 0.5s cubic-bezier(.4,0,.2,1)',
          }}>
            {(todos.length > 0 ? todos : [
              { icon: '📋', text: '加载中...', count: 0, path: '', color: '#fff' },
            ]).map((t, i) => (
              <div
                key={`${t.path}-${i}`}
                onClick={() => t.path && navigate(t.path)}
                style={{
                  height: 44,
                  display: 'flex', alignItems: 'center',
                  padding: '0 8px',
                  marginBottom: 2,
                  cursor: t.path ? 'pointer' : 'default',
                  fontSize: 14,
                  borderRadius: 8,
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'background 0.15s',
                  ...(t.path ? {
                    // 点击态
                    ':active': { background: 'rgba(255,255,255,0.18)' },
                  } : {}),
                }}
                className={t.path ? 'mobile-dashboard-todo-item' : ''}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `rgba(255,255,255,0.15)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 10, fontSize: 15,
                }}>{t.icon}</span>
                <span style={{ flex: 1, fontWeight: 500, fontSize: 13.5 }}>{t.text}</span>
                <span style={{
                  background: t.count > 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  padding: '3px 12px', borderRadius: 12,
                  fontSize: 13, fontWeight: 700,
                  minWidth: 32, textAlign: 'center',
                  backdropFilter: 'blur(4px)',
                }}>
                  {t.count}
                </span>
              </div>
            ))}
          </div>

          {/* 渐变遮罩 */}
          {todos.length > 3 && (
            <>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 14,
                background: 'linear-gradient(to bottom, rgba(25,118,210,0.95), transparent)',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 14,
                background: 'linear-gradient(to top, rgba(25,118,210,0.95), transparent)',
                pointerEvents: 'none',
              }} />
            </>
          )}
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

      {/* 九宫格 — 动态列数（360以下3列、420以下4列、以上5列） */}
      <Grid columns={columns} gap={10}>
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

/** 图标渐变背景 — 根据 color 生成同色系渐变，让卡片更有质感 */
function gradientFromHex(hex: string): string {
  // 简单规则：主色 + 白色 tint + 深色 shadow
  return `linear-gradient(135deg, ${hex} 0%, ${hex}dd 40%, ${hex}99 100%)`
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
          borderRadius: 14,
          padding: '18px 6px 14px',
          textAlign: 'center',
          border: editing ? '2px solid #2196F3' : 'none',
          opacity: entry.disabled ? 0.55 : 1,
          cursor: editing ? 'move' : (entry.disabled ? 'not-allowed' : 'pointer'),
          transition: 'transform 0.15s cubic-bezier(.4,0,.2,1), box-shadow 0.2s',
          userSelect: 'none',
          boxShadow: editing
            ? '0 0 0 3px rgba(33,150,243,0.15)'
            : (entry.disabled ? 'none' : '0 2px 10px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)'),
          ...(editing ? {} : {
            // 按压反馈：active 缩小一点
            ':active': { transform: 'scale(0.94)' },
          } as any),
        }}
        className="mobile-clickable mobile-dashboard-card"
      >
        {/* 编辑模式：移动按钮 */}
        {editing && (
          <div style={{
            position: 'absolute', top: 4, right: 6, display: 'flex', gap: 2,
            fontSize: 14, lineHeight: 1, zIndex: 5,
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onMove(index, -1) }}
              disabled={index === 0}
              style={{
                width: 22, height: 22, borderRadius: 6, border: 'none',
                background: index === 0 ? '#eee' : '#2196F3',
                color: index === 0 ? '#bbb' : '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer',
                lineHeight: '22px', padding: 0, fontSize: 11, fontWeight: 700,
                boxShadow: index === 0 ? 'none' : '0 2px 4px rgba(33,150,243,0.3)',
              }}
            >▲</button>
            <button
              onClick={(e) => { e.stopPropagation(); onMove(index, 1) }}
              disabled={index >= total - 1}
              style={{
                width: 22, height: 22, borderRadius: 6, border: 'none',
                background: index >= total - 1 ? '#eee' : '#2196F3',
                color: index >= total - 1 ? '#bbb' : '#fff', cursor: index >= total - 1 ? 'not-allowed' : 'pointer',
                lineHeight: '22px', padding: 0, fontSize: 11, fontWeight: 700,
                boxShadow: index >= total - 1 ? 'none' : '0 2px 4px rgba(33,150,243,0.3)',
              }}
            >▼</button>
          </div>
        )}

        {/* 图标：加渐变圆形背景 */}
        <div style={{
          width: 44, height: 44, margin: '0 auto 8px',
          borderRadius: 14,
          background: gradientFromHex(entry.color),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          boxShadow: `0 4px 10px ${entry.color}55`,
        }}>
          {entry.icon}
        </div>

        <div style={{ fontSize: 12, fontWeight: 500, color: '#333', lineHeight: 1.3, padding: '0 2px' }}>
          {entry.title}
        </div>
        {entry.disabled && (
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>即将上线</div>
        )}
      </div>
    </Badge>
  )
}
