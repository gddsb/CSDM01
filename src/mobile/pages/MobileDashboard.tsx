/**
 * 移动端工作台（Dashboard）— 三栏式
 * ┌──────────────────────────────┐
 * │ 🔔 通知（15%）               │
 * ├──────────────────────────────┤
 * │ ⚡ 快捷操作（两行 × 四列 = 12格）│
 * ├──────────────────────────────┤
 * │ 📋 代办任务                   │
 * └──────────────────────────────┘
 *
 * 快捷操作：
 *   - 权限过滤 + localStorage 排序持久化
 *   - 长按进入编辑模式（拖拽排序），松手退出
 *   - 所有有权限的入口全展示（不截断）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  DEFAULT_ORDER, STORAGE_KEY, HIGH_PRIORITY_ICONS,
  type QuickEntry, type TodoItem,
} from './dashboard/constants.tsx'

/** 将 #RRGGBB 转为 rgba()，用于生成品牌色的半透明背景 */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 根据 localStorage 自定义顺序重排快捷操作；新增项（权限变化导致）追加到末尾 */
function applyCustomOrder(entries: QuickEntry[], customKeys: string[] | null): QuickEntry[] {
  if (!customKeys || customKeys.length === 0) return entries
  const map = new Map(entries.map((e) => [e.key, e]))
  const ordered: QuickEntry[] = []
  customKeys.forEach((k) => {
    const e = map.get(k)
    if (e) ordered.push(e)
  })
  entries.forEach((e) => {
    if (!ordered.find((o) => o.key === e.key)) ordered.push(e)
  })
  return ordered
}

export default function MobileDashboard() {
  const navigate = useNavigate()
  const { hasPermission, currentUser } = useApp()
  const { pending } = useOfflineQueue()

  // === 待办数据 ===
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)

  // === 快捷操作 ===
  const [ordered, setOrdered] = useState<QuickEntry[]>([])
  /** 是否处于编辑模式（长按进入） */
  const [isEditing, setIsEditing] = useState(false)
  /** 当前拖拽中的 key */
  const dragKeyRef = useRef<string | null>(null)
  /** 当前拖拽悬停的目标 key（用于高亮插入位置） */
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // === 通知区（从 todos 中筛选高优先级）===
  const notices = useMemo(
    () => todos.filter((t) => HIGH_PRIORITY_ICONS.has(t.icon)).slice(0, 3),
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
      api.get('/production/orders', { params: { page: 1, pageSize: 1, status: 1 } })
        .then((r: any) => ({ icon: '📋', text: '待开工订单', count: r.data?.total ?? r.total ?? 0, path: '/m/production-orders?tab=下发', color: 'var(--brand-color)' })),
      api.get('/production/orders', { params: { page: 1, pageSize: 1, status: 2 } })
        .then((r: any) => ({ icon: '🏃', text: '生产中订单', count: r.data?.total ?? r.total ?? 0, path: '/m/production-orders?tab=开工', color: 'var(--brand-color-success)' })),
      api.get('/production/report-orders', { params: { page: 1, pageSize: 1, status: '待报工' } })
        .then((r: any) => ({ icon: '📝', text: '待报工任务', count: r.data?.total ?? r.total ?? 0, path: '/m/process-reporting', color: 'var(--brand-color-warning)' })),
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
    if (hasPermission('device:fault')) {
      apis.push(
        api.get('/device-faults', { params: { page: 1, pageSize: 1, status: '待处理' } })
          .then((r: any) => ({ icon: '🚨', text: '设备故障待处理', count: r.data?.total ?? r.total ?? 0, path: '/m/device-fault', color: 'var(--brand-color-danger)' })),
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

  // ========== 长按 / 点击 分流 ==========
  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null
      setIsEditing(true)
      Toast.show({ content: '拖动排序，松手完成', position: 'bottom', duration: 1500 })
    }, 600)
  }
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  // ========== 编辑模式下的拖拽排序（HTML5 Drag API） ==========
  const onGridDragStart = (key: string) => (e: React.DragEvent) => {
    dragKeyRef.current = key
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  }
  const onGridDragOver = (key: string) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverKey(key)
  }
  const onGridDragLeave = () => setDragOverKey(null)
  const onGridDrop = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault()
    const srcKey = dragKeyRef.current
    dragKeyRef.current = null
    setDragOverKey(null)
    if (!srcKey || srcKey === targetKey) return

    const srcIdx = ordered.findIndex((o) => o.key === srcKey)
    const tgtIdx = ordered.findIndex((o) => o.key === targetKey)
    if (srcIdx < 0 || tgtIdx < 0) return

    const next = [...ordered]
    const [moved] = next.splice(srcIdx, 1)
    next.splice(tgtIdx, 0, moved)
    setOrdered(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map((e) => e.key))) } catch { /* ignore */ }
  }
  const onGridDragEnd = () => {
    setDragOverKey(null)
    setIsEditing(false)
    dragKeyRef.current = null
  }

  // ========== 渲染 ==========
  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="mobile-page" style={{ padding: '12px 12px 80px', minHeight: '100vh', background: 'var(--m-bg)' }}>

        {/* ============ 顶部：欢迎 + 通知 ============ */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--m-text)', marginBottom: 4 }}>
            你好，{currentUser?.real_name || '同事'} 👋
          </div>
          <div style={{ fontSize: 12, color: 'var(--m-text-3)' }}>
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>

        {/* 🔔 通知区 */}
        <div
          style={{
            borderRadius: 12,
            background: notices.length > 0 ? 'var(--m-notice-grad)' : 'var(--m-surface-2)',
            borderLeft: notices.length > 0 ? '3px solid var(--brand-color-warning)' : '3px solid var(--m-border)',
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
                      background: 'var(--brand-color-danger)', color: 'var(--m-surface)', fontSize: 11,
                      padding: '0 6px', borderRadius: 10, fontWeight: 600,
                    }}
                  >
                    {n.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--m-text-3)', textAlign: 'center', padding: '4px 0' }}>
              ✨ 当前无紧急通知
            </div>
          )}
        </div>

        {/* ⚡ 快捷操作（所有权限可见 × 长按排序） */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--m-text)' }}>⚡ 快捷操作</span>
            <span style={{ fontSize: 11, color: isEditing ? 'var(--brand-color)' : 'var(--m-text-3)', fontWeight: isEditing ? 600 : 400 }}>
              {isEditing ? '拖动排序' : '长按排序'}
            </span>
          </div>
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6, padding: '4px 2px 8px',
              background: isEditing ? 'var(--m-surface-2)' : 'transparent',
              borderRadius: 12,
            }}
            onTouchStart={startPress} onTouchEnd={cancelPress} onTouchCancel={cancelPress}
            onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
            onDragEnd={onGridDragEnd}
          >
            {ordered.map((entry) => {
              const isDragOver = isEditing && dragOverKey === entry.key
              return (
                <div
                  key={entry.key}
                  draggable={isEditing}
                  onDragStart={isEditing ? onGridDragStart(entry.key) : undefined}
                  onDragOver={isEditing ? onGridDragOver(entry.key) : undefined}
                  onDragLeave={isEditing ? onGridDragLeave : undefined}
                  onDrop={isEditing ? onGridDrop(entry.key) : undefined}
                  onClick={() => !isEditing && handleEntryClick(entry)}
                  onTouchStart={startPress} onTouchEnd={cancelPress} onTouchCancel={cancelPress}
                  onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
                  style={{
                    textAlign: 'center', cursor: isEditing ? 'grab' : 'pointer',
                    padding: isDragOver ? '4px 0' : 0,
                    background: isDragOver ? 'var(--m-border)' : 'transparent',
                    borderRadius: 8,
                    transform: isDragOver ? 'scale(1.05)' : 'scale(1)',
                    transition: 'transform 0.1s, background 0.1s',
                    opacity: isEditing ? 0.85 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: 12, margin: '0 auto 4px',
                      background: hexToRgba(entry.color, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: entry.color,
                    }}
                  >
                    {entry.icon}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--m-text-3)' }}>{entry.title}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 📋 代办任务 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--m-text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            📋 待办事项
            <span style={{ fontSize: 11, color: 'var(--m-text-3)', fontWeight: 400 }}>（{todos.length} 项）</span>
          </div>

          {todos.length === 0 ? (
            <div style={{
              background: 'var(--m-surface)', borderRadius: 'var(--m-radius-lg)', padding: '30px 16px',
              textAlign: 'center', color: 'var(--m-text-3)', fontSize: 13,
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
                    background: 'var(--m-surface)', borderRadius: 'var(--m-radius-lg)', padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  <div
                    style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: hexToRgba(t.color, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    {t.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--m-text)', fontWeight: 500 }}>{t.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>点击查看</div>
                  </div>
                  <div
                    style={{
                      background: t.color, color: 'var(--m-surface)', fontSize: 13,
                      fontWeight: 700, padding: '2px 10px', borderRadius: 12, flexShrink: 0,
                    }}
                  >
                    {t.count}
                  </div>
                  <span style={{ color: 'var(--m-text-3)', fontSize: 16 }}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  )
}
