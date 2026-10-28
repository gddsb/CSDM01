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
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, List, SearchBar, Toast, Dialog, Tabs, PullToRefresh } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost } from '../offline/offlineApi'
import { useDebounceEffect } from '../hooks/useDebounceEffect'
import { ReportOrderDetail, type ReportOrderMeta } from '../components/ReportOrderDetail'
import { fmtInt } from '../utils/format'

interface OrderRow {
  order_id: number; order_no: string; status?: string
  material_code?: string; material_name?: string; specification?: string
  planned_qty?: number; finished_qty?: number; report_qty?: number
  line_name?: string; line_id?: number | string
  release_time?: string | null; close_time?: string | null
  plan_start_time?: string | null; plan_end_time?: string | null
}

type StatusTab = '开立' | '下发' | '开工' | '完工'
const STATUS_TABS: { key: StatusTab; label: string; color: string }[] = [
  { key: '开立', label: '开立', color: '#9E9E9E' },
  { key: '下发', label: '下发', color: 'var(--brand-color)' },
  { key: '开工', label: '开工', color: 'var(--brand-color-warning)' },
  { key: '完工', label: '完工', color: 'var(--brand-color-success)' },
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
  '下发': 'var(--brand-color)',
  '开工': 'var(--brand-color-warning)',
  '完工': 'var(--brand-color-success)',
  '关闭': '#757575',
}

export default function MobileOrderManagement() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()

  // URL tab 参数 → 初始 tab（Dashboard 待办跳转带来的筛选）
  const urlTab = sp.get('tab') as StatusTab | null
  const VALID_TABS: StatusTab[] = ['开立', '下发', '开工', '完工']
  const initialTab: StatusTab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : '开立'

  const [tab, setTab] = useState<StatusTab>(initialTab)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [reports, setReports] = useState<ReportOrderMeta[]>([])
  const [activeReportId, setActiveReportId] = useState<number | null>(null)

  // 预拉产线（仅运行中）
  const [lines, setLines] = useState<{ line_id: number; line_name: string }[]>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r: any = await api.get('/basic/production-lines', { params: { pageSize: 100 } })
        const list: any[] = r.success ? (r.data?.rows || r.data?.list || r.data || []) : []
        if (!cancelled) setLines(
          list.filter(l => String(l.status) === '运行中' || String(l.status) === '1' || l.status === 1)
            .map(l => ({ line_id: l.line_id, line_name: l.line_name }))
        )
      } catch { /* 静默 */ }
    })()
    return () => { cancelled = true }
  }, [])

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

  // 搜索框 debounce：停下 500ms 自动查
  useDebounceEffect(keyword, (v) => {
    load(tab, v.trim())
  }, 500)

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

  // 订单完工：预检 → 弹窗展示 → 确认执行
  const onFinish = async (o: OrderRow) => {
    let pre: any
    try {
      pre = await api.get(`/production/orders/${o.order_id}/pre-check`)
    } catch (e: any) {
      Dialog.show({ content: '预检失败：' + (e?.message || e), closeOnAction: true })
      return
    }
    const data = pre?.data || pre
    const items: Array<{ level: 'pass' | 'warn' | 'block'; label: string; detail?: string }> = data.items || []
    const passCount = items.filter(i => i.level === 'pass').length
    const warnCount = items.filter(i => i.level === 'warn').length
    const blockCount = items.filter(i => i.level === 'block').length
    const hasBlock = blockCount > 0
    const iconMap: Record<string, string> = { pass: '✅', warn: '⚠️', block: '❌' }
    const colorMap: Record<string, string> = { pass: '#52c41a', warn: '#faad14', block: '#ff4d4f' }

    Dialog.show({
      content: (
        <div style={{ padding: '8px 4px', maxHeight: '60vh', overflowY: 'auto', minWidth: 260 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>订单完工前检查</div>
          {items.map((it, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 13, color: colorMap[it.level] }}>
                {iconMap[it.level]} {it.label}
              </div>
              {it.detail && (
                <div style={{ fontSize: 11, color: '#999', marginTop: 2, lineHeight: 1.4 }}>{it.detail}</div>
              )}
            </div>
          ))}
          <div style={{
            marginTop: 10, padding: '6px 8px',
            background: hasBlock ? '#fff1f0' : '#f6ffed',
            borderRadius: 6, fontSize: 12,
            color: hasBlock ? '#ff4d4f' : '#52c41a',
          }}>
            {hasBlock
              ? `❌ ${passCount} 通过 · ${warnCount} 警告 · ${blockCount} 阻断，不能完工`
              : `✅ ${passCount} 通过 · ${warnCount} 警告，可以完工`}
          </div>
        </div>
      ),
      actions: [
        { key: 'back', text: '取消', style: { color: '#999' } },
        { key: 'ok', text: '确认完工', disabled: hasBlock, danger: true },
      ],
      closeOnAction: true,
      onAction: async (action) => {
        if (action.key !== 'ok') return
        try {
          Toast.show({ content: '正在完工...', icon: 'loading' })
          const r: any = await offlinePost(`/production/orders/${o.order_id}/finish`, {}, { source: 'production-order' })
          Toast.show({ content: r.message || '✅ 已完工', icon: 'success' })
          await load()
        } catch (e: any) {
          Toast.show({ content: e?.message || '完工失败', position: 'bottom' })
        }
      },
    })
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

  // ====== 开工：选产线 → 创建报工单 → 跳转 ======
  const onStart = async (o: OrderRow) => {
    if (lines.length === 0) {
      Toast.show({ content: '暂无可选产线（全部产线均未运行）', icon: 'fail', position: 'bottom' })
      return
    }
    const actions = lines.map(l => ({
      key: String(l.line_id),
      text: l.line_name,
    }))
    Dialog.show({
      content: (
        <div style={{ padding: '10px 8px', minWidth: 260 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
            为 {o.order_no} 选择产线
          </div>
          <div style={{
            fontSize: 12, color: 'var(--m-text-3)', marginBottom: 12,
            background: 'var(--m-surface-2)', padding: '8px 10px', borderRadius: 6, lineHeight: 1.6,
          }}>
            {o.material_code} {o.material_name}
            {o.specification && <div style={{ fontSize: 11, opacity: 0.7 }}>{o.specification}</div>}
            <div style={{ fontSize: 11, marginTop: 2 }}>计划 {fmtInt(o.planned_qty)} · 已完工 {fmtInt(o.finished_qty)}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 8 }}>运行中产线：</div>
        </div>
      ),
      actions: [
        ...actions.map(a => ({ ...a, style: { fontSize: 13 } })),
        { key: 'cancel', text: '取消', style: { color: '#999' } },
      ],
      closeOnAction: true,
      onAction: async (action) => {
        if (action.key === 'cancel') return
        const lineId = Number(action.key)
        try {
          Toast.show({ content: '正在开工...', icon: 'loading' })
          const r: any = await api.post('/production/report-orders', {
            order_id: o.order_id,
            line_id: lineId,
            report_qty: Number(o.planned_qty || 0),
          })
          if (!r?.success) throw new Error(r?.message || '创建报工单失败')
          Toast.show({ content: '已开工', icon: 'success' })
          await load()
          // 带刚创建的 report_order_id 跳转，直接进入对应报工单
          const rid = r.data?.report_order_id || r.data?.report_order?.report_order_id
          navigate(`/m/process-reporting?orderId=${o.order_id}`)
        } catch (e: any) {
          Toast.show({ content: e?.message || '开工失败', icon: 'fail', position: 'bottom' })
        }
      },
    })
  }

  // ====== 订单详情（先调 detail 补完整字段 + 下属报工单）======
  const openDetail = async (o: OrderRow) => {
    setSelected({ ...o }); setActiveReportId(null)
    try {
      // 并行：详情接口补完整字段 + 下属报工单列表
      const [detailRes, reportRes]: any[] = await Promise.all([
        api.get(`/production/orders/${o.order_id}`).catch(() => null),
        api.get('/production/report-orders', { params: { page: 1, pageSize: 50, order_id: o.order_id } }).catch(() => null),
      ])
      if (detailRes?.success && detailRes.data) {
        const d = detailRes.data
        setSelected(prev => prev ? {
          ...prev,
          specification: d.specification,
          release_time: d.release_time,
          close_time: d.close_time,
          plan_start_time: d.plan_start_time,
          plan_end_time: d.plan_end_time,
          line_name: d.line_name || prev.line_name,
        } : prev)
      }
      const list: any[] = reportRes?.success ? (reportRes.data?.list || reportRes.data || []) : []
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
          <SearchBar
            placeholder="输入工单号"
            value={keyword}
            onChange={setKeyword}
            onSearch={() => load(tab, keyword.trim())}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Button color="primary" fill="solid" loading={syncing} onClick={onSync} style={{ flexShrink: 0, height: 40, borderRadius: 10 }}>
            <span style={{ marginRight: 4 }}>🔄</span>同步
          </Button>
        </div>

        {/* 状态 Tab */}
        <div style={{
          background: 'var(--m-surface)', borderRadius: 12, padding: '4px 10px',
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
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>加载中...</div>
      ) : orders.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: 'var(--m-text-3)',
          background: 'var(--m-surface)', borderRadius: 12, margin: '0 4px',
        }}>
          <div style={{ fontSize: 48, color: 'var(--m-text-3)', marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, color: 'var(--m-text-3)', marginBottom: 4 }}>暂无订单</div>
          <div style={{ fontSize: 12 }}>点上方同步按钮拉取 ERP 订单</div>
        </div>
      ) : (
        <PullToRefresh onRefresh={() => load(tab, keyword.trim())}>
          <List>
            {orders.map((o) => {
              const statusColor = STATUS_COLOR[o.status || ''] || 'var(--brand-color-warning)'
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
                    background: 'var(--m-surface)', borderRadius: 14, padding: '14px 14px 14px 18px',
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
                      <span style={{ fontSize: 14, color: 'var(--m-text-3)', marginRight: 4 }}>📍</span>
                      {o.line_name && (
                        <span style={{ fontSize: 13, color: 'var(--m-text-3)', fontWeight: 400, marginRight: 4 }}>（{o.line_name}）</span>
                      )}
                      {o.order_no}
                      {(o.planned_qty ?? 0) > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--m-text-3)', marginLeft: 8 }}>
                          报工 <b style={{ color: statusColor, fontSize: 14 }}>{fmtInt(o.finished_qty)}</b>
                          <span style={{ color: 'var(--m-text-3)' }}> / {fmtInt(o.planned_qty)}</span>
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
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                      <div style={{ fontSize: 13, color: 'var(--m-text-2)', wordBreak: 'break-all' }}>
                        <span style={{ color: 'var(--m-text-3)' }}>{o.material_code}</span>
                        {o.material_name && (
                          <span style={{ marginLeft: 6 }}>· {o.material_name}</span>
                        )}
                        {o.specification && (
                          <span style={{ marginLeft: 4, color: 'var(--m-text-3)', fontSize: 12 }}>（{o.specification}）</span>
                        )}
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
                          onClick={() => onStart(o)}
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

      {/* ===== 订单详情（订单信息 + 下属报工单）===== */}
      {selected && activeReportId === null && (
        <Dialog
          visible
          content={
            <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '10px 6px' }}>
              {/* 订单基础信息卡片 */}
              <div style={{
                padding: 12, background: 'var(--m-surface-2)', borderRadius: 10,
                marginBottom: 12, border: '1px solid #eee',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                  {selected.order_no}
                  <span style={{
                    marginLeft: 8, padding: '1px 8px', borderRadius: 10,
                    fontSize: 11, fontWeight: 600,
                    background: STATUS_COLOR[selected.status || ''] + '15',
                    color: STATUS_COLOR[selected.status || ''] || '#666',
                    border: `1px solid ${(STATUS_COLOR[selected.status || ''] || '#666')}44`,
                  }}>{selected.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--m-text-2)', lineHeight: 1.8 }}>
                  <div><span style={{ color: 'var(--m-text-3)' }}>料品：</span>
                    <b>{selected.material_code}</b> · {selected.material_name}
                  </div>
                  {selected.specification && (
                    <div><span style={{ color: 'var(--m-text-3)' }}>规格：</span>{selected.specification}</div>
                  )}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span><span style={{ color: 'var(--m-text-3)' }}>计划：</span>{fmtInt(selected.planned_qty)}</span>
                    <span><span style={{ color: 'var(--m-text-3)' }}>已完工：</span>{fmtInt(selected.finished_qty)}</span>
                  </div>
                  <div><span style={{ color: 'var(--m-text-3)' }}>产线：</span>{selected.line_name || '—'}</div>
                  {(selected.release_time || selected.plan_start_time) && (
                    <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 4 }}>
                      {selected.release_time && <>下发 {String(selected.release_time).slice(0, 16).replace("T", " ")} &nbsp; </>}
                      {selected.plan_start_time && <>计划 {String(selected.plan_start_time).slice(0, 10)}{selected.plan_end_time ? ` ~ ${String(selected.plan_end_time).slice(0, 10)}` : ''}</>}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 15 }}>
                下属报工单
                <span style={{ fontSize: 12, color: 'var(--m-text-3)', fontWeight: 400, marginLeft: 8 }}>
                  （{reports.length} 条）
                </span>
              </div>
              {reports.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--m-text-3)', padding: 30, textAlign: 'center' }}>
                  暂无报工单 · 请先在 PC 端下发或在移动报工录入
                </div>
              ) : (
                reports.map((r) => (
                  <div
                    key={r.report_order_id}
                    onClick={() => setActiveReportId(r.report_order_id)}
                    style={{
                      padding: 12, borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                      background: 'var(--m-surface-2)', borderRadius: 8, marginBottom: 6,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.report_no}</div>
                    <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 3, display: 'flex', gap: 10 }}>
                      <span>🏭 {r.line_name}</span>
                      <span>📦 ×{fmtInt(r.report_qty)}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 4,
                        background: r.status === '完工' ? '#4CAF5015' : '#2196F315',
                        color: r.status === '完工' ? 'var(--brand-color-success)' : 'var(--brand-color)',
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
