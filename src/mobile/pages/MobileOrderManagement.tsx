/**
 * 生产订单移动版 — 4 状态 Tab（开立/下发/开工/完工）+ 下发/开工报工/完工/关闭 操作
 *
 * 对齐 PC OrderManagement.tsx：
 *   GET    /production/orders                 列表（按状态 Tab）
 *   POST   /production/orders/:id/release     下发（开立→下发）
 *   POST   /production/orders/:id/finish      完工（开工→完工）
 *   POST   /production/orders/:id/close       关闭
 *   POST   /auto/sync-production-orders       订单同步（timeout 300s）
 *
 * 只显示开立/下发/开工/完工四状态订单，不支持新建
 * 点击订单 → 下属报工单列表 → 点击报工单 → 复用 ReportOrderDetail
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, List, SearchBar, Toast, Dialog, Tabs, PullToRefresh } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'
import { ReportOrderDetail, type ReportOrderMeta } from '../components/ReportOrderDetail'

interface OrderRow {
  order_id: number; order_no: string; status?: string
  material_code?: string; material_name?: string
  planned_qty?: number; finished_qty?: number; report_qty?: number
  line_name?: string; start_date?: string; end_date?: string
}

type StatusTab = '开立' | '下发' | '开工' | '完工'
const STATUS_TABS: { key: StatusTab; label: string; color: string }[] = [
  { key: '开立', label: '开立', color: '#9E9E9E' },
  { key: '下发', label: '下发', color: '#2196F3' },
  { key: '开工', label: '开工', color: '#FF9800' },
  { key: '完工', label: '完工', color: '#4CAF50' },
]

/** 移动端状态 tab → 后端数字 code（与 server/src/services/OrderService.ts ORDER_STATUS_MAP 对齐） */
const STATUS_CODE: Record<StatusTab, number> = {
  '开立': 0,
  '下发': 1,
  '开工': 2,
  '完工': 3,
}

/** 状态 → 徽章配色 */
const STATUS_COLOR: Record<string, string> = {
  '开立': '#9E9E9E',
  '下发': '#2196F3',
  '开工': '#FF9800',
  '完工': '#4CAF50',
  '关闭': '#757575',
}

export default function MobileOrderManagement() {
  const navigate = useNavigate()
  const { scan } = useBarcode()
  const [tab, setTab] = useState<StatusTab>('开立')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [reports, setReports] = useState<ReportOrderMeta[]>([])
  const [activeReportId, setActiveReportId] = useState<number | null>(null)

  const load = async (t?: StatusTab, kw?: string) => {
    setLoading(true)
    try {
      const tt = t ?? tab
      const params: Record<string, unknown> = {
        page: 1,
        pageSize: 50,
        status: STATUS_CODE[tt],  // 数字 code，避免中文编码问题
      }
      if (kw) params.keyword = kw
      const r: any = await api.get('/production/orders', { params })
      const list: OrderRow[] = r.success ? (r.data?.list || r.data || []) : []
      setOrders(list)
    } catch { setOrders([]) } finally { setLoading(false) }
  }
  // 需求3: Tab 预加载缓存 — 进入时一次性拉所有状态，Tab 切换只读缓存
  const [cache, setCache] = useState<Record<string, OrderRow[]>>({})
  const [cacheLoaded, setCacheLoaded] = useState(false)

  // 初次进入预加载全部4个状态（统一用数字 code 请求）
  useEffect(() => {
    let cancelled = false
    const preload = async () => {
      const tabs = (['开立','下发','开工','完工'] as const)
      const results: Record<string, OrderRow[]> = {}
      await Promise.all(tabs.map(async (t) => {
        try {
          const r: any = await api.get('/production/orders', {
            params: { status: STATUS_CODE[t], page: 1, pageSize: 50 }
          })
          results[t] = r.success ? (r.data?.list || r.data || []) : []
        } catch { results[t] = [] }
      }))
      if (!cancelled) {
        setCache(results)
        setCacheLoaded(true)
        setOrders(results[tab] || [])
        setLoading(false)
      }
    }
    preload()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab 切换直接读缓存
  useEffect(() => {
    if (cacheLoaded && cache[tab]) {
      setOrders(cache[tab])
    } else {
      load(tab, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cacheLoaded])

  // ====== 订单同步 —— 完全对齐 PC 端 ======
  const onSync = async () => {
    const ok = await Dialog.confirm({
      content: '从 ERP 同步生产订单？',
      confirmText: '同步',
      cancelText: '取消',
    })
    if (!ok) return
    setSyncing(true)
    try {
      const res: any = await api.post('/auto/sync-production-orders', {}, { timeout: 300000 })
      const d = res.data || {}
      const collected = d.collected ?? 0
      const m = d.migrated || {}
      Toast.show({
        content: res.message || `订单同步完成：采集 ${collected} 条，业务表新增 ${m.inserted ?? 0} 条、更新 ${m.updated ?? 0} 条`,
        icon: 'success',
        position: 'bottom',
        duration: 2500,
      })
      await load(tab, keyword.trim())
    } catch (e: any) {
      Toast.show({ content: e?.message || '订单同步失败', position: 'bottom' })
    } finally { setSyncing(false) }
  }

  const onScan = async () => {
    const r = await scan(); if (!r) return
    setKeyword(r.code); await load(tab, r.code)
  }

  // ====== 订单操作 ======
  const onRelease = async (o: OrderRow) => {
    const ok = await Dialog.confirm({ content: `下发订单 ${o.order_no}？下发后自动创建报工单。`, confirmText: '下发', cancelText: '取消' })
    if (!ok) return
    try {
      const r: any = await offlinePost(`/production/orders/${o.order_id}/release`, {}, { source: 'production-order' })
      Toast.show({ content: r.message || '已下发', icon: 'success', position: 'bottom' })
      await load()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }

  const onFinish = async (o: OrderRow) => {
    const ok = await Dialog.confirm({ content: `订单 ${o.order_no} 生产完工？`, confirmText: '完工', cancelText: '取消' })
    if (!ok) return
    try {
      const r: any = await offlinePost(`/production/orders/${o.order_id}/finish`, {}, { source: 'production-order' })
      Toast.show({ content: r.message || '已完工', icon: 'success', position: 'bottom' })
      await load()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }

  const onClose = async (o: OrderRow) => {
    const ok = await Dialog.confirm({ content: `关闭订单 ${o.order_no}？关闭后不可再报工。`, confirmText: '关闭', cancelText: '取消' })
    if (!ok) return
    try {
      const r: any = await offlinePost(`/production/orders/${o.order_id}/close`, {}, { source: 'production-order' })
      Toast.show({ content: r.message || '已关闭', icon: 'success', position: 'bottom' })
      await load()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
  }

  // ====== 订单详情（下属报工单）======
  const openDetail = async (o: OrderRow) => {
    setSelected(o); setActiveReportId(null)
    try {
      const r: any = await api.get('/production/report-orders', { params: { page: 1, page_size: 50, order_id: o.order_id } })
      const list: any[] = r.success ? (r.data?.list || r.data || []) : []
      setReports(list.map((x) => ({
        report_order_id: x.report_order_id, report_no: x.report_no,
        order_id: x.order_id, order_no: o.order_no,
        line_name: x.line_name, material_code: x.material_code, material_name: x.material_name,
        report_qty: x.report_qty, status: x.status,
      })))
    } catch { setReports([]) }
  }

  // ====== 渲染 ======
  if (activeReportId && selected) {
    const m = reports.find((r) => r.report_order_id === activeReportId)
    if (m) {
      return (
        <div className="mobile-page" style={{ paddingTop: 6 }}>
          <ReportOrderDetail meta={m} onClose={() => setActiveReportId(null)} />
        </div>
      )
    }
  }

  return (
    <div className="mobile-page-fixed-header">
      {/* 需求1: 搜索+同步+Tab — 顶部固定 */}
      <div className="mobile-sticky-header">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar
            placeholder="输入工单号"
            value={keyword}
            onChange={setKeyword}
            onSearch={() => load(tab, keyword.trim())}
          />
        </div>
        <Button color="primary" fill="solid" loading={syncing} onClick={onSync} style={{ height: 40, borderRadius: 10 }}>
          <span style={{ marginRight: 4 }}>🔄</span>同步
        </Button>
      </div>

        {/* 状态 Tab */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '4px 10px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as StatusTab)}
        >
          {STATUS_TABS.map((t) => (
            <Tabs.Tab
              title={
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 6px',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: t.color,
                  }} />
                  {t.label}
                </span>
              }
              key={t.key}
            />
          ))}
        </Tabs>
      </div>

      </div>{/* mobile-sticky-header end */}

      {/* 订单列表 — 独立滚动 */}
      <div className="mobile-page-scroll-list">
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
      ) : orders.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#bbb',
          background: '#fff', borderRadius: 12, margin: '0 4px',
        }}>
          <div style={{ fontSize: 48, color: '#e0e0e0', marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, color: '#999', marginBottom: 4 }}>暂无订单</div>
          <div style={{ fontSize: 12 }}>点上方同步按钮拉取 ERP 订单</div>
        </div>
      ) : (
        <PullToRefresh onRefresh={() => load(tab, keyword.trim())}>
          <List>
            {orders.map((o) => {
              const statusColor = STATUS_COLOR[o.status || ''] || '#FF9800'
              const statusText = o.status || ''
              /* 需求5: 状态操作 — 严格对齐 PC 端 */
              const isCreated = o.status === '开立'
              const isReleased = o.status === '下发'
              const isStarted = o.status === '开工'
              const isDone = o.status === '完工'

              return (
                <div
                  key={o.order_id}
                  onClick={() => openDetail(o)}
                  style={{
                    background: '#fff', borderRadius: 14, padding: '14px 14px 14px 18px',
                    marginBottom: 10, cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)',
                    borderLeft: `3px solid ${statusColor}`,
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}
                  onTouchStart={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'
                  }}
                  onTouchEnd={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                  }}
                >
                  {/* 需求4: 第一行 — 订单号 + 报工数量 + 状态 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#222', flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.order_no}
                      {(o.planned_qty ?? 0) > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 8 }}>
                          报工 <b style={{ color: statusColor, fontSize: 14 }}>{o.finished_qty ?? 0}</b>
                          <span style={{ color: '#bbb' }}> / {o.planned_qty}</span>
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 12, flexShrink: 0,
                      background: statusColor + '15', color: statusColor,
                      fontWeight: 600, border: `1px solid ${statusColor}44`,
                      letterSpacing: 0.5,
                    }}>
                      {statusText}
                    </span>
                  </div>

                  {/* 进度条（保持在顶部两行之间） */}
                  {(o.planned_qty ?? 0) > 0 && (o.finished_qty ?? 0) > 0 && (
                    <div style={{ marginTop: 8, marginBottom: 2 }}>
                      <div style={{
                        background: '#f0f2f5', borderRadius: 6, height: 5, overflow: 'hidden',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                      }}>
                        <div style={{
                          background: `linear-gradient(90deg, ${statusColor}, ${statusColor}cc)`,
                          height: '100%',
                          width: `${Math.min(100, ((o.finished_qty ?? 0) / Math.max(1, o.planned_qty ?? 1)) * 100)}%`,
                          transition: 'width 0.3s',
                          borderRadius: 6,
                        }} />
                      </div>
                    </div>
                  )}

                  {/* 需求2: 料品 + 操作按钮 同一行 */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* 左侧: 料品信息 + 地点日期（flex:1 占满剩余空间） */}
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                      <div style={{ fontSize: 13, color: '#555', wordBreak: 'break-all' }}>
                        <span style={{ color: '#888' }}>{o.material_code}</span>
                        {o.material_name && (
                          <span style={{ marginLeft: 6 }}>· {o.material_name}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                        📍 {o.line_name || '—'} {o.start_date?.slice(0, 10) || ''}
                      </div>
                    </div>

                    {/* 右侧: 操作按钮（右对齐，不换行） */}
                    <div style={{ flexShrink: 0, display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      {isCreated && (
                        <Button size="mini" color="primary" onClick={() => onRelease(o)}>下发</Button>
                      )}
                      {isReleased && (
                        <Button
                          size="mini" color="primary"
                          onClick={() => navigate(`/m/process-reporting?orderId=${o.order_id}`)}
                        >开工</Button>
                      )}
                      {isStarted && (
                        <>
                          <Button
                            size="mini" color="primary" fill="solid"
                            onClick={() => navigate(`/m/process-reporting?orderId=${o.order_id}`)}
                          >继续报工</Button>
                          <Button size="mini" color="warning" onClick={() => onFinish(o)}>完工</Button>
                        </>
                      )}
                      {isDone && (
                        <Button size="mini" fill="outline" onClick={() => onClose(o)}>关闭</Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </List>
        </PullToRefresh>
      )}
      </div>

      {/* ===== 订单详情（下属报工单）===== */}
      {selected && activeReportId === null && (
        <Dialog
          visible
          content={
            <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '10px 6px' }}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 15 }}>
                {selected.order_no} 下属报工单
                <span style={{ fontSize: 12, color: '#999', fontWeight: 400, marginLeft: 8 }}>
                  （{reports.length} 条）
                </span>
              </div>
              {reports.length === 0 ? (
                <div style={{ fontSize: 12, color: '#999', padding: 30, textAlign: 'center' }}>
                  暂无报工单 · 请先在 PC 端下发或在移动报工录入
                </div>
              ) : (
                reports.map((r) => (
                  <div
                    key={r.report_order_id}
                    onClick={() => setActiveReportId(r.report_order_id)}
                    style={{
                      padding: 12, borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                      background: '#fafbfc', borderRadius: 8, marginBottom: 6,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.report_no}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 3, display: 'flex', gap: 10 }}>
                      <span>🏭 {r.line_name}</span>
                      <span>📦 ×{r.report_qty}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 4,
                        background: r.status === '完工' ? '#4CAF5015' : '#2196F315',
                        color: r.status === '完工' ? '#4CAF50' : '#2196F3',
                        fontSize: 10, fontWeight: 600,
                      }}>{r.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          }
          actions={[{ key: 'close', text: '返回列表', onClick: () => setSelected(null) }]}
        />
      )}
    </div>
  )
}
