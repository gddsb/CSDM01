/**
 * 移动端工作台（Dashboard）— 九宫格可排序版
 * - 顶部欢迎语 + 今日统计
 * - 中部 3×N 九宫格快捷入口（自动排布）
 * - 长按卡片进入「编辑模式」，可上下移动调整顺序
 * - 顺序持久化到 localStorage: mobile_home_order
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid, Badge, PullToRefresh, Toast, Button, ActionSheet } from 'antd-mobile'
import {
  BillOutline, CheckOutline, TeamOutline, SetOutline, AppstoreOutline,
  FlagOutline, SearchOutline, CalendarOutline, PieOutline, FolderOutline,
  FileOutline, ChatAddOutline,
} from 'antd-mobile-icons'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  const { hasPermission } = useApp()
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

  // ====== DnD 传感器：触摸 + 鼠标都支持，编辑模式下才启用 ======
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 0, tolerance: 5 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  // DndContext onDragEnd：交换 arrayMove
  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrdered((items) => {
      const oldIndex = items.findIndex((i) => i.key === active.id)
      const newIndex = items.findIndex((i) => i.key === over.id)
      if (oldIndex === -1 || newIndex === -1) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }

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
      // 下发状态订单
      api.get('/production/orders', { params: { page: 1, page_size: 1, status: '下发' } })
        .then((r: any) => ({ icon: '📋', text: '待开工订单', count: r.data?.total || r.total || 0, path: '/m/production-orders', color: '#2196F3' })),
      // 开工状态订单
      api.get('/production/orders', { params: { page: 1, page_size: 1, status: '开工' } })
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

  // === 编辑模式：拖拽排序（已由 DndContext 接管）===

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
    Toast.show({ content: '已恢复默认顺序（点保存生效）', icon: 'success', position: 'bottom', duration: 1200 })
  }

  // === 编辑模式：删除某个快捷操作 ===
  const removeEntry = (key: string) => {
    if (ordered.length <= 1) {
      Toast.show({ content: '至少保留 1 个快捷操作', position: 'bottom' })
      return
    }
    setOrdered((items) => items.filter((e) => e.key !== key))
  }

  // === 编辑模式：从全量列表添加一个（弹 ActionSheet 选） ===
  const addEntry = () => {
    const existingKeys = new Set(ordered.map((e) => e.key))
    const candidates = DEFAULT_ORDER.filter(
      (e) => !existingKeys.has(e.key) && (!e.permCode || hasPermission(e.permCode)),
    )
    if (candidates.length === 0) {
      Toast.show({ content: '全部功能已在快捷操作中', position: 'bottom' })
      return
    }
    ActionSheet.show({
      actions: candidates.map((e) => ({
        text: `${e.title}`,
        key: e.key,
      })),
      cancelText: '取消',
      onAction: (action) => {
        const pick = candidates.find((e) => e.key === action.key)
        if (pick) setOrdered((items) => [...items, pick])
      },
    })
  }

  // === 长按 600ms → 进入编辑模式 ===
  const handlePressStart = () => {
    if (editing) return // 已在编辑模式下不重复触发
    longPressTimer.current = setTimeout(() => {
      setEditing(true)
      Toast.show({ content: '已进入编辑模式：拖动图标排序', position: 'bottom', duration: 1500 })
    }, 600)
  }
  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // 非编辑模式下点击 → 跳转；编辑模式下点击不跳转
  const handleCardClick = (entry: QuickEntry) => {
    if (editing) return
    if (entry.disabled) return
    if (entry.path) navigate(entry.path)
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
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
            <Button size="mini" color="primary" onClick={addEntry}>+ 添加</Button>
            <Button size="mini" fill="outline" onClick={resetToDefault}>恢复默认</Button>
            <Button size="mini" fill="outline" onClick={resetEdit}>取消</Button>
            <Button size="mini" color="primary" onClick={saveEdit}>保存</Button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#999' }}>长按可调整顺序</span>
        )}
      </div>

      {/* 九宫格 — 拖拽排序（编辑模式下可用） */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={ordered.map((e) => e.key)}
          strategy={rectSortingStrategy}
        >
          <Grid columns={columns} gap={10} style={{ paddingLeft: 10, paddingRight: 4 }}>
            {ordered.map((entry) => (
              <Grid.Item key={entry.key}>
                <SortableCard
                  entry={entry}
                  editing={editing}
                  onClick={() => handleCardClick(entry)}
                  onPressStart={handlePressStart}
                  onPressEnd={handlePressEnd}
                  onRemove={() => removeEntry(entry.key)}
                />
              </Grid.Item>
            ))}
          </Grid>
        </SortableContext>
      </DndContext>

      {/* 底部空出 TabBar + safe-area */}
      <div style={{ height: 20 }} />
    </PullToRefresh>
  )
}

interface SortableCardProps {
  entry: QuickEntry
  editing: boolean
  onClick: () => void
  onPressStart: () => void
  onPressEnd: () => void
  onRemove: () => void
}

/** 图标渐变背景 — 根据 color 生成同色系渐变 */
function gradientFromHex(hex: string): string {
  return `linear-gradient(135deg, ${hex} 0%, ${hex}dd 40%, ${hex}99 100%)`
}

/** 可拖拽卡片 — @dnd-kit useSortable + 1:1 宽高比 */
function SortableCard({ entry, editing, onClick, onPressStart, onPressEnd, onRemove }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.key })

  const style: React.CSSProperties = {
    position: 'relative',
    background: entry.disabled ? '#f5f6f8' : '#fff',
    borderRadius: 14,
    // 核心：始终 1:1 正方形
    aspectRatio: '1 / 1',
    // 内容居中垂直
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '10px 6px',
    boxSizing: 'border-box',
    border: editing ? '2px solid #2196F3' : 'none',
    opacity: entry.disabled ? 0.55 : 1,
    cursor: editing ? 'grab' : (entry.disabled ? 'not-allowed' : 'pointer'),
    transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(.4,0,.2,1), box-shadow 0.2s',
    userSelect: 'none',
    // 拖拽时的视觉反馈
    boxShadow: isDragging
      ? '0 12px 32px rgba(33,150,243,0.35)'
      : (editing
          ? '0 0 0 3px rgba(33,150,243,0.15)'
          : (entry.disabled ? 'none' : '0 2px 10px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)')),
    transform: CSS.Transform.toString(transform),
    zIndex: isDragging ? 999 : undefined,
    touchAction: 'none', // 禁用浏览器触摸默认行为
  }

  return (
    <Badge content={entry.badge || null}>
      <div
        ref={setNodeRef}
        style={style}
        onClick={onClick}
        // 长按进入编辑（仅非编辑模式下触发）
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onMouseLeave={onPressEnd}
        onTouchStart={onPressStart}
        onTouchEnd={onPressEnd}
        onTouchCancel={onPressEnd}
        // 编辑模式下：useSortable 接管拖拽事件
        {...(editing ? { ...attributes, ...listeners } : {})}
        className="mobile-clickable mobile-dashboard-card"
      >
        {/* 编辑模式：左上 × 删除按钮 + 右上拖动提示点 */}
        {editing && (
          <>
            <div
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              style={{
                position: 'absolute', top: -6, left: -6,
                width: 22, height: 22, borderRadius: '50%',
                background: '#F44336', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, lineHeight: 1,
                boxShadow: '0 2px 6px rgba(244,67,54,0.4)',
                cursor: 'pointer', zIndex: 10,
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >×</div>
            <div style={{
              position: 'absolute', top: 6, right: 6,
              width: 10, height: 10, borderRadius: 5,
              background: entry.color,
              boxShadow: `0 2px 4px ${entry.color}66`,
            }} />
          </>
        )}

        {/* 渐变圆角图标 */}
        <div style={{
          width: 44, height: 44,
          borderRadius: 14,
          background: gradientFromHex(entry.color),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          boxShadow: `0 4px 10px ${entry.color}55`,
          flexShrink: 0,
        }}>
          {entry.icon}
        </div>

        <div style={{
          fontSize: 12, fontWeight: 500, color: '#333',
          lineHeight: 1.3, padding: '6px 2px 0',
          textAlign: 'center',
        }}>
          {entry.title}
        </div>
        {entry.disabled && (
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>即将上线</div>
        )}
      </div>
    </Badge>
  )
}
