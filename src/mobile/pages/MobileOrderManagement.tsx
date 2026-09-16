/**
 * 生产订单移动版 — 4 状态 Tab + release/finish/close 三按钮 + 下属报工单跳转
 *
 * 对齐 PC OrderManagement.tsx：
 *   GET    /production/orders                列表（按状态 Tab）
 *   POST   /production/orders                新建
 *   POST   /production/orders/:id/release    一键下发
 *   POST   /production/orders/:id/finish     生产完工
 *   POST   /production/orders/:id/close     订单关闭
 *   DELETE /production/orders/:id            删除
 *   GET    /production/report-orders?order_id=:id  下属报工单
 *
 * 点击订单 → 下属报工单列表 → 点击报工单 → 复用 ReportOrderDetail
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, List, SearchBar, Toast, Dialog, Tabs, PullToRefresh, Input, Radio , TextArea} from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost, offlineDelete } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'
import { ReportOrderDetail, type ReportOrderMeta } from '../components/ReportOrderDetail'

interface OrderRow {
  order_id: number; order_no: string; status?: string
  material_code?: string; material_name?: string
  planned_qty?: number; finished_qty?: number; report_qty?: number
  line_name?: string; start_date?: string; end_date?: string
}

type StatusTab = 'all' | '开立' | '已下发' | '生产中' | '已完工' | '已关闭'
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '已下发', label: '待开工' },
  { key: '生产中', label: '生产中' },
  { key: '已完工', label: '已完工' },
  { key: '已关闭', label: '已关闭' },
]

export default function MobileOrderManagement() {
  const navigate = useNavigate()
  const { scan } = useBarcode()
  const [tab, setTab] = useState<StatusTab>('已下发')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [selected, setSelected] = useState<OrderRow | null>(null)
  const [reports, setReports] = useState<ReportOrderMeta[]>([])
  const [activeReportId, setActiveReportId] = useState<number | null>(null)

  // 新建订单表单
  const [showCreate, setShowCreate] = useState(false)
  const [newOrder, setNewOrder] = useState({
    order_no: '', material_code: '', material_name: '',
    planned_qty: 0, line_id: null, line_name: '',
    start_date: '', end_date: '', product_type: '饮料', remark: '',
  })
  const [lines, setLines] = useState<any[]>([])

  const load = async (t?: StatusTab, kw?: string) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 50 }
      const tt = t ?? tab
      if (tt !== 'all') params.status = tt
      if (kw) params.order_no = kw
      const r: any = await api.get('/production/orders', { params })
      const list: OrderRow[] = r.success ? (r.data?.list || r.data || []) : []
      setOrders(list)
    } catch { setOrders([]) } finally { setLoading(false) }
  }
  useEffect(() => { load(tab) }, [tab])

  // ====== 订单同步（ERP→本地）======
  const onSync = async () => {
    const ok = await Dialog.confirm({ content: '从 ERP 同步生产订单？', confirmText: '同步', cancelText: '取消' })
    if (!ok) return
    setSyncing(true)
    try {
      const r: any = await api.post('/auto/sync-production-orders')
      if (r.success) {
        const d = r.data || {}
        Toast.show({
          content: `同步成功：新增 ${d.inserted || 0}，更新 ${d.updated || 0}`,
          icon: 'success', position: 'bottom', duration: 1500,
        })
        await load(tab, keyword.trim())
      } else {
        Toast.show({ content: r.message || '同步失败', position: 'bottom' })
      }
    } catch (e: any) {
      Toast.show({ content: e?.message || '网络错误', position: 'bottom' })
    } finally { setSyncing(false) }
  }

  useEffect(() => {
    api.get('/basic/lines', { params: { page: 1, page_size: 100 } }).then((r: any) => {
      setLines(r.success ? (r.data?.list || r.data || []) : [])
    }).catch(() => {})
  }, [])

  const onScan = async () => {
    const r = await scan(); if (!r) return
    setKeyword(r.code); await load(tab, r.code)
  }

  // ====== 订单三按钮 ======
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

  const onDelete = async (o: OrderRow) => {
    const ok = await Dialog.confirm({ content: `删除订单 ${o.order_no}？`, confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      await offlineDelete(`/production/orders/${o.order_id}`, { source: 'production-order' })
      Toast.show({ content: '已删除', icon: 'success', position: 'bottom' })
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

  const createOrder = async () => {
    if (!newOrder.order_no.trim()) { Toast.show({ content: '请填工单号', position: 'bottom' }); return }
    try {
      const r: any = await offlinePost('/production/orders', newOrder, { source: 'production-order' })
      Toast.show({ content: r.message || '已创建', icon: 'success', position: 'bottom' })
      setShowCreate(false)
      setNewOrder({ order_no: '', material_code: '', material_name: '', planned_qty: 0, line_id: null, line_name: '', start_date: '', end_date: '', product_type: '饮料', remark: '' })
      await load()
    } catch (e: any) { Toast.show({ content: e?.message || '失败', position: 'bottom' }) }
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
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 30 }}>
      {/* 搜索 + 同步 + 新建 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar placeholder="扫/输工单号" value={keyword} onChange={setKeyword}
            onSearch={() => load(tab, keyword.trim())} />
        </div>
        <Button size="mini" fill="outline" loading={syncing} onClick={onSync}>同步</Button>
        <Button color="primary" onClick={() => setShowCreate(true)} style={{ height: 40 }}>+ 新建</Button>
      </div>

      {/* 状态 Tab（对齐 PC） */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '0 8px', marginBottom: 10 }}>
        <Tabs activeKey={tab} onChange={(k) => setTab(k as StatusTab)}>
          {STATUS_TABS.map((t) => <Tabs.Tab title={t.label} key={t.key} />)}
        </Tabs>
      </div>

      {/* 订单列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          暂无订单<br /><span style={{ fontSize: 12 }}>或点右上角 + 新建</span>
        </div>
      ) : (
        <PullToRefresh onRefresh={() => load(tab, keyword.trim())}>
          <List>
            {orders.map((o) => {
              const isReleased = /已下发|开立/.test(o.status || '')
              const isRunning = /生产中/.test(o.status || '')
              const isDone = /已完工/.test(o.status || '')
              const isClosed = /已关闭/.test(o.status || '')
              const badge = (() => {
                if (isReleased) return { c: '#2196F3', t: '待开工' }
                if (isRunning) return { c: '#4CAF50', t: '生产中' }
                if (isDone) return { c: '#9C27B0', t: '已完工' }
                if (isClosed) return { c: '#9E9E9E', t: '已关闭' }
                return { c: '#FF9800', t: o.status || '' }
              })()
              return (
                <div key={o.order_id} onClick={() => openDetail(o)} style={{
                  background: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
                  border: '1px solid #eef0f3', cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{o.order_no}</div>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: badge.c + '22', color: badge.c }}>
                      {badge.t}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    {o.material_code} {o.material_name?.slice(0, 18)} · {o.planned_qty}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                    📍 {o.line_name || '—'} · {o.start_date?.slice(0, 10) || ''} → {o.end_date?.slice(0, 10) || ''}
                  </div>

                  {/* 进度条 + 剩余判断 */}
                  {(o.planned_qty ?? 0) > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>
                        已报 {o.finished_qty ?? 0} / {o.planned_qty}
                        {(o.finished_qty ?? 0) > 0 && (
                          <span style={{ float: 'right' }}>
                            {Math.round(((o.finished_qty ?? 0) / (o.planned_qty ?? 1)) * 100)}%
                          </span>
                        )}
                      </div>
                      <div style={{ background: '#f0f2f5', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                        <div style={{
                          background: (o.finished_qty ?? 0) >= (o.planned_qty ?? 0) ? '#4CAF50' : '#2196F3',
                          height: '100%',
                          width: `${Math.min(100, ((o.finished_qty ?? 0) / Math.max(1, o.planned_qty ?? 1)) * 100)}%`,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* 行内按钮 */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    {isReleased && (
                      <>
                        <Button size="mini" color="primary" onClick={() => onRelease(o)}>下发</Button>
                        <Button size="mini" color="primary" fill="outline" onClick={() => navigate(`/m/process-reporting?orderId=${o.order_id}`)}>开工报工</Button>
                      </>
                    )}
                    {isRunning && (
                      <Button size="mini" color="primary" onClick={() => navigate(`/m/process-reporting?orderId=${o.order_id}`)}>继续报工</Button>
                    )}
                    {isDone && (o.finished_qty ?? 0) < (o.planned_qty ?? 0) && (
                      <Button size="mini" color="warning" onClick={() => navigate(`/m/process-reporting?orderId=${o.order_id}`)}>补报剩余</Button>
                    )}
                    {(isReleased || isRunning) && (
                      <Button size="mini" fill="outline" onClick={() => onFinish(o)}>完工</Button>
                    )}
                    {!isClosed && (
                      <Button size="mini" fill="outline" onClick={() => onClose(o)}>关闭</Button>
                    )}
                    {(isReleased || /开立/.test(o.status || '')) && (
                      <Button size="mini" fill="outline" onClick={() => onDelete(o)}>删除</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </List>
        </PullToRefresh>
      )}

      {/* ===== 新建订单 ===== */}
      {showCreate && (
        <Dialog visible content={<OrderCreateForm value={newOrder} setValue={setNewOrder} lines={lines} />}
          actions={[
            { key: 'cancel', text: '取消', onClick: () => setShowCreate(false) },
            { key: 'ok', text: '创建', bold: true, onClick: createOrder },
          ]}
        />
      )}

      {/* ===== 订单详情（下属报工单）===== */}
      {selected && activeReportId === null && (
        <Dialog visible content={
          <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '10px 6px' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{selected.order_no} 下属报工单</div>
            {reports.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999', padding: 20, textAlign: 'center' }}>
                暂无报工单 · 请先在 PC 端下发或在移动报工录入
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.report_order_id} onClick={() => setActiveReportId(r.report_order_id)} style={{
                  padding: 10, borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{r.report_no}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {r.line_name} · ×{r.report_qty} · {r.status}
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

function OrderCreateForm({ value, setValue, lines }: {
  value: any; setValue: (v: any) => void; lines: any[]
}) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ marginBottom: 6, color: '#666' }}>工单号 *</div>
      <Input value={value.order_no} onChange={(v) => setValue({ ...value, order_no: v })} placeholder="如 PO20260915001" />
      <div style={{ margin: '8px 0 6px', color: '#666' }}>物料编码</div>
      <Input value={value.material_code} onChange={(v) => setValue({ ...value, material_code: v })} placeholder="物料编码" />
      <div style={{ margin: '8px 0 6px', color: '#666' }}>物料名称</div>
      <Input value={value.material_name} onChange={(v) => setValue({ ...value, material_name: v })} placeholder="物料名称" />
      <div style={{ margin: '8px 0 6px', color: '#666' }}>计划数量</div>
      <Input type="number" value={String(value.planned_qty)} onChange={(v) => setValue({ ...value, planned_qty: Number(v) || 0 })} />
      <div style={{ margin: '8px 0 6px', color: '#666' }}>产线</div>
      <select value={value.line_id || ''} onChange={(e) => {
        const id = e.target.value ? Number(e.target.value) : null
        const ln = lines.find((l) => l.line_id === id)
        setValue({ ...value, line_id: id, line_name: ln?.line_name || '' })
      }} style={selStyle}>
        <option value="">选择产线</option>
        {lines.map((l) => <option key={l.line_id} value={l.line_id}>{l.line_name}</option>)}
      </select>
      <div style={{ margin: '8px 0 6px', color: '#666' }}>产品类型</div>
      <div style={{ display: 'flex', gap: 14 }}>
<Radio.Group value={value.product_type} onChange={(v) => setValue({ ...value, product_type: v })}>

        <Radio value="饮料">饮料</Radio>
        <Radio value="奶粉">奶粉</Radio>
        <Radio value="其他">其他</Radio>
      </Radio.Group>      </div>

      <div style={{ margin: '8px 0 6px', color: '#666' }}>开工日期</div>
      <Input type="date" value={value.start_date} onChange={(v) => setValue({ ...value, start_date: v })} />
      <div style={{ margin: '8px 0 6px', color: '#666' }}>完工日期</div>
      <Input type="date" value={value.end_date} onChange={(v) => setValue({ ...value, end_date: v })} />
      <div style={{ margin: '8px 0 6px', color: '#666' }}>备注</div>
      <TextArea  rows={2} value={value.remark} onChange={(v) => setValue({ ...value, remark: v })} />
    </div>
  )
}

const selStyle: React.CSSProperties = { padding: 6, borderRadius: 6, border: '1px solid #ddd', width: '100%', background: '#fff' }
