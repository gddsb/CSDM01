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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PullToRefresh, Toast, Modal } from 'antd-mobile'
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

export default function MobileDashboard() {
  const navigate = useNavigate()
  const { hasPermission, currentUser } = useApp()
  const { pending } = useOfflineQueue()

  // === 待办数据 ===
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)

  // === 快捷操作 ===
  const [ordered, setOrdered] = useState<QuickEntry[]>([])
  // === 快捷操作编辑 ===
  const [showEditor, setShowEditor] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // === 通知区（从 todos 中筛选高优先级）===
  const notices = useMemo(
    () => todos.filter((t) => HIGH_PRIORITY_ICONS.has(t.icon) || t.color === 'var(--brand-color-danger)' || t.color === 'var(--brand-color-danger)').slice(0, 3),
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
        .then((r: any) => ({ icon: '📋', text: '待开工订单', count: r.data?.total ?? r.total ?? 0, path: '/m/production-orders?tab=下发', color: 'var(--brand-color)' })),
      // 开工 → 生产中
      api.get('/production/orders', { params: { page: 1, pageSize: 1, status: 2 } })
        .then((r: any) => ({ icon: '🏃', text: '生产中订单', count: r.data?.total ?? r.total ?? 0, path: '/m/production-orders?tab=开工', color: 'var(--brand-color-success)' })),
      // 待报工
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

    // 高优先级：异常/故障/校准（用不同 icon 标记 → 通知区）
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

  // ========== 长按 / 点击 分流 ==========
  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null
      openEditor()
    }, 600)
  }
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  // ========== 编辑操作（拖拽版） ==========
  /** 编辑区的两部分 state：上=已显示（最多12），下=未显示 */
  const [editShownKeys, setEditShownKeys] = useState<string[]>([])
  const [editHiddenKeys, setEditHiddenKeys] = useState<string[]>([])
  /** 当前拖拽中的 key */
  const dragKeyRef = useRef<string | null>(null)
  /** 当前拖拽悬停的目标 key（用于高亮） */
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  /** 当前拖拽悬停的目标区（shown / hidden） */
  const [dragOverZone, setDragOverZone] = useState<'shown' | 'hidden' | null>(null)

  const openEditor = () => {
    const visible = DEFAULT_ORDER.filter(e => !e.permCode || hasPermission(e.permCode))
    const visibleKeys = visible.map(e => e.key)
    const orderedKeys = ordered.map(e => e.key)
    setEditShownKeys(orderedKeys.filter(k => visibleKeys.includes(k)))
    // 未显示 = 有可见权限 但 不在 ordered 里的
    setEditHiddenKeys(visibleKeys.filter(k => !orderedKeys.includes(k)))
    setShowEditor(true)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setDragOverKey(null); setDragOverZone(null); dragKeyRef.current = null
  }

  const applyEditor = () => {
    const keyToEntry = new Map(ordered.map(e => [e.key, e]))
    const allVisible = DEFAULT_ORDER.filter(e => !e.permCode || hasPermission(e.permCode))
    allVisible.forEach(e => keyToEntry.set(e.key, e))
    const merged = [
      ...editShownKeys.map(k => keyToEntry.get(k)).filter(Boolean) as QuickEntry[],
      ...editHiddenKeys.map(k => keyToEntry.get(k)).filter(Boolean) as QuickEntry[],
    ]
    saveOrder(merged)
    closeEditor()
  }

  const saveOrder = (entries: QuickEntry[]) => {
    setOrdered(entries)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.map(e => e.key))) } catch { /* ignore */ }
  }

  const resetOrder = () => {
    const visible = DEFAULT_ORDER.filter(e => !e.permCode || hasPermission(e.permCode))
    saveOrder(visible)
    closeEditor()
  }

  /** 拖拽开始 */
  const onDragStart = (key: string) => (e: React.DragEvent) => {
    dragKeyRef.current = key
    e.dataTransfer.effectAllowed = 'move'
    // 必须设置一个 data 才能让 Firefox 识别为可拖拽
    e.dataTransfer.setData('text/plain', key)
  }

  /** 拖拽悬停在某个 item 上（用于插入到该位置之前） */
  const onItemDragOver = (key: string) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverKey(key)
  }
  const onItemDragLeave = () => setDragOverKey(null)

  /** 拖拽悬停在某区（不放在具体 item 上时，追加到该区末尾） */
  const onZoneDragOver = (zone: 'shown' | 'hidden') => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverZone(zone)
  }
  const onZoneDragLeave = () => setDragOverZone(null)

  /** 放下：source zone + source key 挪到 target zone + target key 位置 */
  const onDrop = (targetKey?: string) => (e: React.DragEvent) => {
    e.preventDefault()
    const srcKey = dragKeyRef.current
    if (!srcKey) return
    setDragOverKey(null); setDragOverZone(null); dragKeyRef.current = null

    const srcInShown = editShownKeys.includes(srcKey)
    const srcInHidden = editHiddenKeys.includes(srcKey)
    if (!srcInShown && !srcInHidden) return

    let newShown = [...editShownKeys]
    let newHidden = [...editHiddenKeys]

    // 先从源区移除
    if (srcInShown) newShown = newShown.filter(k => k !== srcKey)
    else newHidden = newHidden.filter(k => k !== srcKey)

    // 目标区和位置
    let targetInShown: boolean
    if (!targetKey) {
      // 没指定 target key → 追加到 dragOverZone 或原区
      targetInShown = dragOverZone === 'shown' || (!dragOverZone && srcInShown)
    } else {
      targetInShown = editShownKeys.includes(targetKey)
    }

    if (targetInShown && newShown.length >= 12 && !srcInShown) {
      // 移到 shown 但已满 12 且源不在 shown → 拒绝
      return
    }

    const targetList = targetInShown ? newShown : newHidden
    const targetIdx = targetKey ? targetList.indexOf(targetKey) : -1
    if (targetIdx >= 0) {
      targetList.splice(targetIdx, 0, srcKey)
    } else {
      targetList.push(srcKey)
    }

    setEditShownKeys(newShown)
    setEditHiddenKeys(newHidden)
  }

  const allAvailable = useMemo(
    () => DEFAULT_ORDER.filter(e => (!e.permCode || hasPermission(e.permCode)) && !ordered.find(o => o.key === e.key)),
    [ordered, hasPermission],
  )

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

        {/* 🔔 通知区（15%） */}
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
            <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '4px 0' }}>
              ✨ 当前无紧急通知
            </div>
          )}
        </div>

        {/* ⚡ 快捷操作（两行固定 8 个 + 长按编辑） */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--m-text)' }}>⚡ 快捷操作</span>
            <span style={{ fontSize: 11, color: 'var(--m-text-3)' }}>长按编辑</span>
          </div>
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6, padding: '4px 2px 8px',
            }}
            onTouchStart={startPress} onTouchEnd={cancelPress} onTouchCancel={cancelPress}
            onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
          >
            {ordered.slice(0, 8).map((entry) => (
              <div
                key={entry.key}
                onClick={() => handleEntryClick(entry)}
                onTouchStart={startPress} onTouchEnd={cancelPress} onTouchCancel={cancelPress}
                onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
                style={{ textAlign: 'center', cursor: 'pointer' }}
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
            ))}
          </div>
        </div>

        {/* 📋 代办任务（50%） */}
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

      {/* 快捷操作编辑 Modal */}
      <Modal
        visible={showEditor}
        onClose={() => setShowEditor(false)}
        contentStyle={{ maxHeight: '80vh', overflowY: 'auto', borderRadius: 12 }}
        title="⚙️ 编辑快捷操作"
        footer={[
          { key: 'reset', text: '重置', onClick: () => resetOrder() },
          { key: 'ok', text: '完成', primary: true, onClick: () => { applyEditor(); setShowEditor(false); } },
        ]}
      >
        {/* 已显示的（可排序 + 删除） */}
        <div style={{ fontSize: 12, color: 'var(--m-text-2)', fontWeight: 600, marginBottom: 8 }}>
          已显示（{ordered.length}）
        </div>
        {ordered.map((entry, idx) => (
          <div key={entry.key} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
            borderBottom: '1px solid #f5f5f5',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: hexToRgba(entry.color, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: entry.color,
            }}>{entry.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--m-text)' }}>{entry.title}</div>
            </div>
            <button onClick={() => moveEntry(entry.key, -1)} disabled={idx === 0}
              style={{ border: 'none', background: 'var(--m-surface-2)', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
            <button onClick={() => moveEntry(entry.key, 1)} disabled={idx === ordered.length - 1}
              style={{ border: 'none', background: 'var(--m-surface-2)', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: idx === ordered.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === ordered.length - 1 ? 0.4 : 1 }}>↓</button>
            <button onClick={() => removeEntry(entry.key)}
              style={{ border: 'none', background: '#ffebee', color: '#f44336', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>删除</button>
          </div>
        ))}

        {/* 可用但未显示的 */}
        {allAvailable.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--m-text-2)', fontWeight: 600, marginTop: 14, marginBottom: 8 }}>
              可添加（{allAvailable.length}）
            </div>
            {allAvailable.map((entry) => (
              <div key={entry.key} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', opacity: 0.7,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: hexToRgba(entry.color, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: entry.color, fontSize: 14,
                }}>{entry.icon}</div>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--m-text-2)' }}>{entry.title}</div>
                <button onClick={() => addEntry(entry.key)}
                  style={{ border: 'none', background: '#e3f2fd', color: 'var(--brand-color)', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>+ 添加</button>
              </div>
            ))}
          </>
        )}
      </Modal>
    </PullToRefresh>
  )
}
