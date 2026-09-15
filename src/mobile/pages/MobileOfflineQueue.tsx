/**
 * 离线暂存 / 离线队列详情（Phase 3 · R-B）
 *
 * 功能：
 *  - 展示 Dexie 离线队列中所有暂存请求的明细
 *  - 按 source（业务）或 status（状态）筛选
 *  - 点击展开请求体详情 + 最后错误
 *  - 单条：手动重试 / 删除
 *  - 批量：重试全部失败 / 清空（带确认）
 *  - 监听网络状态变化，恢复时自动触发同步 + Toast
 *
 * 依赖：queue.ts (listAll / retryOne / deleteOne / retryFailed / clearAll / drain)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, List, Badge, Toast, Dialog, Empty, PullToRefresh, Tag } from 'antd-mobile'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import {
  listAll, deleteOne, retryOne, retryFailed, clearAll, drain,
  QueuedRequest,
} from '../offline/queue'

type Filter = 'all' | 'pending' | 'failed' | 'done' | 'syncing'

// source 业务标签 → 友好展示
const SOURCE_META: Record<string, { label: string; icon: string; color: string }> = {
  'process-reporting': { label: '移动报工', icon: '📝', color: '#2196F3' },
  'exception-report': { label: '异常上报', icon: '⚠️', color: '#F44336' },
  'process-inspection': { label: '过程检验', icon: '🔍', color: '#3F51B5' },
  'product-inspection': { label: '成品检验', icon: '🏷️', color: '#FF9800' },
  'incoming-inspection': { label: '来料检验', icon: '📦', color: '#4CAF50' },
  'device-inspection': { label: '设备点检', icon: '🔧', color: '#FF9800' },
  'device-maintenance': { label: '设备保养', icon: '🛠️', color: '#00BCD4' },
  'device-fault': { label: '设备故障', icon: '⚙️', color: '#E91E63' },
  'microbe-inspection': { label: '微生物检验', icon: '🔬', color: '#673AB7' },
  'complaint-report': { label: '投诉上报', icon: '📢', color: '#FF4081' },
}

function sourceLabel(source?: string) {
  if (!source) return { label: '未知来源', icon: '❓', color: '#999' }
  return SOURCE_META[source] || { label: source, icon: '📄', color: '#888' }
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function fmtBody(body?: string | null): string {
  if (!body) return '(无请求体)'
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function statusTag(s: QueuedRequest['status']) {
  const map: Record<QueuedRequest['status'], { text: string; bg: string; color: string }> = {
    pending: { text: '待同步', bg: '#E3F2FD', color: '#2196F3' },
    syncing: { text: '同步中', bg: '#FFF3E0', color: '#FF9800' },
    failed: { text: '失败', bg: '#FFEBEE', color: '#F44336' },
    done: { text: '已完成', bg: '#E8F5E9', color: '#4CAF50' },
  }
  const m = map[s]
  return (
    <span style={{
      fontSize: 11, padding: '1px 8px', borderRadius: 8,
      background: m.bg, color: m.color, fontWeight: 500,
    }}>{m.text}</span>
  )
}

export default function MobileOfflineQueue() {
  const { online, syncing, triggerSync } = useOfflineQueue()
  const [items, setItems] = useState<QueuedRequest[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [syncingOneId, setSyncingOneId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listAll()
      setItems(list)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // 网络恢复时自动触发同步 + Toast
  useEffect(() => {
    if (online && items.some((i) => i.status === 'pending' || i.status === 'failed')) {
      Toast.show({ content: '网络已恢复，自动同步中...', icon: 'success', duration: 1500, position: 'bottom' })
      triggerSync()
      // 延迟刷新看结果
      const t = setTimeout(() => refresh(), 3000)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  // 状态计数
  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, failed: 0, done: 0, syncing: 0 }
    items.forEach((i) => { c[i.status]++; if (i.status === 'pending' || i.status === 'failed' || i.status === 'syncing') c.all++ })
    return c
  }, [items])

  // 可选的 source 列表（从现有 items 提取 + 预定义全集）
  const sourceFilters = useMemo(() => {
    const sources = new Set<string>()
    items.forEach((i) => i.source && sources.add(i.source))
    Object.keys(SOURCE_META).forEach((k) => sources.add(k))
    return Array.from(sources)
  }, [items])

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  const handleRetryOne = async (id: number) => {
    setSyncingOneId(id)
    try {
      const r = await retryOne(id)
      if (r.ok) Toast.show({ content: '已同步', icon: 'success', position: 'bottom', duration: 1200 })
      else Toast.show({ content: r.error || '重试失败', position: 'bottom' })
    } finally {
      setSyncingOneId(null)
      await refresh()
    }
  }

  const handleDeleteOne = async (id: number) => {
    const ok = await Dialog.confirm({
      content: '确认删除这条离线请求？删除后数据将丢失。',
      confirmText: '删除', cancelText: '取消',
    })
    if (!ok) return
    await deleteOne(id)
    Toast.show({ content: '已删除', icon: 'success', position: 'bottom', duration: 800 })
    await refresh()
  }

  const handleRetryAllFailed = async () => {
    if (counts.failed === 0) { Toast.show({ content: '暂无失败项', position: 'bottom' }); return }
    setLoading(true)
    try {
      const n = await retryFailed()
      Toast.show({ content: `已重置 ${n} 条失败项`, icon: 'success', position: 'bottom', duration: 1200 })
      // 立即 drain
      if (navigator.onLine) await drain()
      await refresh()
    } finally { setLoading(false) }
  }

  const handleClearAll = async () => {
    if (items.length === 0) { Toast.show({ content: '队列为空', position: 'bottom' }); return }
    const ok = await Dialog.confirm({
      content: `确认清空全部 ${items.length} 条离线请求？此操作不可恢复。`,
      confirmText: '清空', cancelText: '取消',
    })
    if (!ok) return
    await clearAll()
    Toast.show({ content: '已清空', icon: 'success', position: 'bottom', duration: 800 })
    await refresh()
  }

  // 当前筛选后的列表
  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  return (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* 顶部状态栏 */}
      <div style={{
        background: online ? '#E8F5E9' : '#FFEBEE',
        borderRadius: 10, padding: '10px 14px', marginBottom: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        border: `1px solid ${online ? '#A5D6A7' : '#EF9A9A'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 4, background: online ? '#4CAF50' : '#F44336',
          }} />
          <span style={{ fontSize: 13, color: online ? '#2E7D32' : '#C62828', fontWeight: 500 }}>
            {online ? (syncing ? '在线 · 同步中' : '在线 · 自动同步') : '离线 · 已暂存本地'}
          </span>
        </div>
        <Button
          size="mini" fill="outline" color={online ? 'primary' : 'default'}
          disabled={!online || syncing || counts.all === 0}
          onClick={triggerSync}
        >
          立即同步
        </Button>
      </div>

      {/* 统计条 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
        marginBottom: 10,
      }}>
        <Stat label="全部" value={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        <Stat label="待同步" value={counts.pending} color="#2196F3" active={filter === 'pending'} onClick={() => setFilter('pending')} />
        <Stat label="同步中" value={counts.syncing} color="#FF9800" active={filter === 'syncing'} onClick={() => setFilter('syncing')} />
        <Stat label="失败" value={counts.failed} color="#F44336" active={filter === 'failed'} onClick={() => setFilter('failed')} />
        <Stat label="已完成" value={counts.done} color="#4CAF50" active={filter === 'done'} onClick={() => setFilter('done')} />
      </div>

      {/* 批量操作 */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <Button size="small" fill="outline" disabled={counts.failed === 0} onClick={handleRetryAllFailed}>
            重试全部失败 ({counts.failed})
          </Button>
          <Button size="small" fill="outline" color="danger" onClick={handleClearAll}>
            清空
          </Button>
        </div>
      )}

      {/* 列表 */}
      {loading && items.length === 0 ? (
        <EmptyHint text="加载中..." />
      ) : items.length === 0 ? (
        <Empty description="离线队列为空" />
      ) : filtered.length === 0 ? (
        <EmptyHint text={`当前筛选下无数据`} sub={`共 ${items.length} 条，试试其他筛选`} />
      ) : (
        <PullToRefresh onRefresh={refresh}>
          <List>
            {filtered.map((item) => {
              const sm = sourceLabel(item.source)
              const isOpen = expanded.has(item.id!)
              const isSyncingOne = syncingOneId === item.id
              const canRetry = item.status === 'pending' || item.status === 'failed'
              const shortPath = item.url.replace(/^\/api/, '').slice(0, 40)

              return (
                <div key={item.id} style={{ marginBottom: 2 }}>
                  <List.Item
                    onClick={() => toggleExpand(item.id!)}
                    description={
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Tag color={item.method === 'POST' ? 'green' : item.method === 'PUT' ? 'orange' : 'blue'} style={{ margin: 0 }}>
                            {item.method}
                          </Tag>
                          <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{shortPath}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
                          {fmtTime(item.enqueuedAt)}
                          {item.retries > 0 && <span style={{ marginLeft: 8, color: '#FF9800' }}>已重试 {item.retries} 次</span>}
                        </div>
                      </div>
                    }
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{sm.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: sm.color }}>{sm.label}</div>
                      </div>
                      {statusTag(item.status)}
                    </div>
                  </List.Item>

                  {/* 展开：详情 + 操作 */}
                  {isOpen && (
                    <div style={{
                      background: '#fafbfc', borderLeft: '3px solid #e0e0e0',
                      padding: '10px 14px', margin: '0 0 2px 0', fontSize: 12,
                    }}>
                      {/* 错误信息 */}
                      {item.lastError && (
                        <div style={{
                          background: '#FFEBEE', borderRadius: 6, padding: '6px 10px',
                          color: '#C62828', fontSize: 11, marginBottom: 8,
                        }}>⚠️ {item.lastError}</div>
                      )}

                      {/* 请求体 */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>请求体：</div>
                        <pre style={{
                          background: '#fff', border: '1px solid #eee', borderRadius: 6,
                          padding: 8, overflowX: 'auto', fontSize: 11,
                          maxHeight: 200, lineHeight: 1.5,
                        }}>{fmtBody(item.body)}</pre>
                      </div>

                      {/* 操作按钮 */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="mini" color="primary" disabled={!canRetry || !online || isSyncingOne}
                          loading={isSyncingOne}
                          onClick={(e) => { e.stopPropagation(); handleRetryOne(item.id!) }}
                        >立即同步</Button>
                        <Button
                          size="mini" fill="outline" color="danger"
                          onClick={(e) => { e.stopPropagation(); handleDeleteOne(item.id!) }}
                        >删除</Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </List>
        </PullToRefresh>
      )}
    </div>
  )
}

// ==================== 小工具组件 ====================

function Stat({ label, value, color = '#333', active, onClick }: {
  label: string; value: number; color?: string; active?: boolean; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? color : '#fff',
        color: active ? '#fff' : color,
        borderRadius: 8, padding: '8px 4px', textAlign: 'center',
        border: `1px solid ${active ? color : '#eef0f3'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .2s',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: active ? 0.9 : 0.85 }}>{label}</div>
    </div>
  )
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}</div>
}
