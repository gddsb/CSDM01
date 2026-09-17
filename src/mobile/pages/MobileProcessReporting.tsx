/**
 * 移动报工（Batch B）
 * 3 步流程：
 *   Step 1: 选/扫生产订单
 *   Step 2: 选产线 + 填数量
 *   Step 3: 提交 → 创建报工单 → 自动完工
 *
 * 后端接口:
 *   GET  /api/production/orders?status=已下发&keyword=xxx     订单列表（待报工）
 *   GET  /api/basic/lines                                    产线列表
 *   POST /api/production/report-orders                       创建报工单
 *   POST /api/production/report-orders/:id/finish            完工
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, List, SearchBar, Stepper, Toast, Dialog, Tabs, PullToRefresh, InfiniteScroll, ActionSheet } from 'antd-mobile'
import api from '../../utils/api'
import { useBarcode } from '../hooks/useBarcode'
import { MobileOrderDetail, MobileOrderData } from '../components/MobileOrderDetail'
import { ReportOrderDetail, type ReportOrderMeta } from '../components/ReportOrderDetail'

interface OrderRow {
  order_id: number
  order_no: string
  barcode?: string
  material_code?: string
  material_name?: string
  planned_qty?: number
  status?: string
}

interface LineRow {
  line_id: number
  line_code?: string
  line_name?: string
  status?: string
}

type Step = 0 | 1 | 2 // 选订单 / 填数据 / 提交结果

interface HistoryRow {
  report_order_id: number
  report_no?: string
  order_no?: string
  material_name?: string
  report_qty?: number
  line_name?: string
  material_code?: string
  status?: string
  created_at?: string
}

export default function MobileProcessReporting() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { scan, isScanning } = useBarcode()
  const orderIdFromUrl = searchParams.get('orderId')

  const [tab, setTab] = useState<'report' | 'history'>('report')
  const [step, setStep] = useState<Step>(0)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [lines, setLines] = useState<LineRow[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [selectedLine, setSelectedLine] = useState<LineRow | null>(null)
  const [reportQty, setReportQty] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [createdReportNo, setCreatedReportNo] = useState<string | null>(null)

  // P-A: 工单详情抽屉
  const [detailOrder, setDetailOrder] = useState<MobileOrderData | null>(null)

  // 6-A: 报工单详情抽屉（工序/不良/报废/异常/人工/投料/图片）
  const [activeReport, setActiveReport] = useState<ReportOrderMeta | null>(null)

  // 上次扫码命中的订单列表（给"扫码后自动选中"逻辑用）
  const lastScanMatches = useRef<OrderRow[]>([])

  // 订单状态数字→中文映射（与 PC 端 ProcessReporting.tsx STATUS_MAP 保持一致）
  const STATUS_MAP: Record<string, string> = {
    '0': '开立', '1': '下发', '2': '开工', '3': '完工',
    '开立': '开立', '下发': '下发', '开工': '开工', '完工': '完工',
  }

  /** 订单是否属于"可报工"状态（与 PC 端 getOrderOptions 过滤逻辑一致） */
  const isReportable = (o: OrderRow): boolean => {
    const s = STATUS_MAP[String(o.status)] || String(o.status)
    if (s === '下发' || s === '开工') return true
    if (s === '完工') {
      // 完工但未全部完成的也可报工
      const planned = Number((o as any).planned_qty || 0)
      const finished = Number((o as any).finished_qty || 0)
      return finished < planned
    }
    return false
  }

  // Step 1: 加载待报工订单（返回列表供调用方直接使用，避免 state 异步问题）
  // —— 与 PC 端一致：status='1,2,3' 拉下发/开工/完工，前端再按 STATUS_MAP 过滤可报工
  const loadOrders = async (kw?: string): Promise<OrderRow[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 200, status: '1,2,3' }
      if (kw) params.keyword = kw
      const r: any = await api.get('/production/orders', { params })
      const all: OrderRow[] = r.success ? (r.data?.list || r.data?.rows || r.data || []) : []
      // 只显示"可报工"的订单
      const list = all.filter(isReportable)
      setOrders(list)
      return list
    } catch {
      return []
    } finally { setLoading(false) }
  }

  // 产线列表 —— 与 PC 端一致用 /basic/production-lines + pageSize（驼峰）
  // —— 只加载「运行中」的产线，避免用户选到已停用/停机产线
  const loadLines = async () => {
    try {
      const r: any = await api.get('/basic/production-lines', { params: { page: 1, pageSize: 1000 } })
      if (!r.success) return
      const all = r.data?.list || r.data?.rows || r.data || []
      // 字段兼容：部分产线可能 status 为 null/undefined，也放进来（兜底）
      const running = (all as LineRow[]).filter((l) => !l.status || l.status === '运行中')
      setLines(running)
    } catch { /* 静默 */ }
  }

  useEffect(() => {
    loadLines()
    loadOrders()
  }, [])

  // ========== 智能路由：URL带orderId or 唯一开工订单 → 自动进入 ==========
  const smartRoutedRef = useRef(false)
  useEffect(() => {
    if (smartRoutedRef.current) return
    if (orders.length === 0) return

    // 1) URL 带 orderId → 找到后自动进入
    if (orderIdFromUrl) {
      const target = orders.find(o => String(o.order_id) === String(orderIdFromUrl))
      if (target) {
        goToFill(target)
        smartRoutedRef.current = true
        setSearchParams({}, { replace: true }) // 清掉 URL 参数，避免刷新重复触发
        return
      }
      // URL orderId 没匹配到也不强行拦截，让用户在列表里选
    }

    // 2) 过滤出"开工中"的订单（status=开工 or status=2）
    const running = orders.filter(o => {
      const s = STATUS_MAP[String(o.status)] || String(o.status)
      return s === '开工'
    })

    if (running.length === 1) {
      // 唯一开工订单 → 自动进入
      Toast.show({ content: `已自动选中: ${running[0].order_no}`, position: 'bottom', duration: 1200 })
      goToFill(running[0])
      smartRoutedRef.current = true
    } else if (running.length > 1) {
      // 多个开工订单 → ActionSheet 让用户选
      ActionSheet.show({
        actions: running.map(o => ({
          text: `${o.order_no} · ${o.material_name || o.material_code || ''}`,
          key: String(o.order_id),
        })),
        cancelText: '手动选择',
        onAction: (action) => {
          const picked = running.find(o => String(o.order_id) === action.key)
          if (picked) {
            goToFill(picked)
            smartRoutedRef.current = true
          }
        },
      })
      smartRoutedRef.current = true // 不管选没选都不重复弹
    }
  }, [orders.length, orderIdFromUrl])

  // 加载报工历史 —— 增量加载单页（P3.3 InfiniteScroll 配套）
  const loadHistoryPage = useCallback(async (page: number, append: boolean) => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const r: any = await api.get('/production/report-orders', {
        params: { page, page_size: 20, start_date: today, end_date: today },
      })
      if (!r.success) {
        if (!append) { setHistory([]); setHistoryHasMore(false) }
        return
      }
      const list: HistoryRow[] = r.data?.list || r.data?.rows || []
      setHistory(prev => append ? [...prev, ...list] : list)
      const total = r.data?.total || r.total || 0
      setHistoryHasMore(page * 20 < total && list.length > 0)
      setHistoryPage(page)
    } catch {
      if (!append) setHistoryHasMore(false)
    }
  }, [])

  // 加载报工历史（重置到第 1 页，给"切换到 history tab"用）
  const loadHistory = useCallback(async () => {
    await loadHistoryPage(1, false)
  }, [loadHistoryPage])

  // InfiniteScroll 触发加载下一页
  const loadMoreHistory = async () => {
    if (!historyHasMore) return
    await loadHistoryPage(historyPage + 1, true)
  }

  // 下拉刷新报工列表
  const onRefreshOrders = async () => {
    await loadOrders(keyword.trim() || undefined)
    Toast.show({ content: '已刷新', icon: 'success', position: 'bottom', duration: 600 })
  }

  // 下拉刷新历史列表
  const onRefreshHistory = async () => {
    await loadHistory()
  }

  // Step 1 → Step 2: 选订单
  const goToFill = (order: OrderRow) => {
    setSelectedOrder(order)
    setReportQty(Number(order.planned_qty) || 0)
    setStep(1)
  }

  // 扫码入口（搜索框右侧扫码按钮）
  const handleScanOrder = async () => {
    const result = await scan()
    if (!result) return
    const kw = result.code
    setKeyword(kw)
    const list = await loadOrders(kw)
    lastScanMatches.current = list
    // 命中唯一结果 → 自动选中并打开详情
    if (list.length === 1) {
      const hit = list[0]
      goToFill(hit)
      setDetailOrder(hit as MobileOrderData)
    } else if (list.length > 1) {
      Toast.show({ content: `命中 ${list.length} 条，请手动选择`, position: 'bottom', duration: 1500 })
    } else {
      Toast.show({ content: '未找到匹配订单', position: 'bottom' })
    }
  }

  // 手动搜索
  const onSearch = async () => { await loadOrders(keyword.trim()) }

  // Step 2 → Step 3: 提交
  const onSubmit = async () => {
    if (!selectedOrder || !selectedLine) {
      Toast.show({ content: '请先选订单和产线', position: 'bottom' }); return
    }
    if (reportQty <= 0) {
      Toast.show({ content: '报工数量需大于 0', position: 'bottom' }); return
    }

    const ok = await Dialog.confirm({
      content: `确认提交：${selectedOrder.order_no} × ${reportQty} @ ${selectedLine.line_name || selectedLine.line_code} ?`,
      confirmText: '提交',
      cancelText: '取消',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      // 1) 创建报工单
      const createRes: any = await api.post('/production/report-orders', {
        order_id: selectedOrder.order_id,
        line_id: selectedLine.line_id,
        report_qty: reportQty,
      })
      if (!createRes.success) {
        Toast.show({ content: createRes.message || '创建失败', position: 'bottom' })
        return
      }
      const reportId = createRes.data?.report_order_id || createRes.data?.id
      const reportNo = createRes.data?.report_no

      // 2) 完工
      if (reportId) {
        try {
          await api.post(`/production/report-orders/${reportId}/finish`)
        } catch {
          // 完工失败不阻塞（可能已由后端自动处理）
        }
      }

      setCreatedReportNo(reportNo || '')
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '网络错误', position: 'bottom' })
    } finally {
      setSubmitting(false)
    }
  }

  // 完成后重置
  const resetAll = () => {
    setStep(0); setSelectedOrder(null); setSelectedLine(null)
    setReportQty(0); setCreatedReportNo(null); setKeyword('')
    loadOrders()
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 12 }}>
      <Tabs
        activeKey={tab}
        onChange={(k) => {
          setTab(k as any)
          if (k === 'history') loadHistory()
        }}
        style={{ marginBottom: 8 }}
      >
        <Tabs.Tab title="📝 报工录入" key="report" />
        <Tabs.Tab title={`📋 今日历史(${history.length})`} key="history" />
      </Tabs>

      {tab === 'history' ? (
        <PullToRefresh onRefresh={onRefreshHistory}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--m-text-3, #999)' }}>
              今日暂无报工记录
            </div>
          ) : (
            <List>
              {history.map(h => (
                <List.Item key={h.report_order_id}
                  onClick={() => setActiveReport({
                    report_order_id: h.report_order_id, report_no: h.report_no,
                    order_no: h.order_no, material_code: h.material_code,
                    material_name: h.material_name, line_name: h.line_name,
                    report_qty: h.report_qty, status: h.status,
                  })}
                  description={
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {h.material_name || ''} · {h.line_name || '—'}
                      <span style={{ marginLeft: 12, color: '#4CAF50' }}>{h.status}</span>
                    </div>
                  }>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>
                    {h.report_no || h.order_no} · ×{h.report_qty}
                  </div>
                  {h.created_at && (
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                      {new Date(h.created_at).toLocaleTimeString('zh-CN', { hour12: false })}
                    </div>
                  )}
                </List.Item>
              ))}
              <InfiniteScroll loadMore={loadMoreHistory} hasMore={historyHasMore} />
            </List>
          )}
        </PullToRefresh>
      ) : (
        <>
      {step === 0 && (
        <>
          <SearchBar
            placeholder="扫订单号 / 手输关键词"
            value={keyword}
            onChange={setKeyword}
            onSearch={onSearch}

            style={{ marginBottom: 12 }}
          />
          {/* 需求3: 扫码按钮已隐藏 */}
          {/* <Button size="mini" onClick={handleScanOrder} style={{marginTop:8}}>扫码</Button> */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无待报工订单<br />
              <span style={{ fontSize: 12 }}>请先在 PC 端下发生产订单</span>
            </div>
          ) : (
            <PullToRefresh onRefresh={onRefreshOrders}>
              <List>
                {orders.map((o) => (
                  <List.Item
                    key={o.order_id}
                    onClick={() => goToFill(o)}
                    arrow
                    description={
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {o.material_code} {o.material_name || ''}
                        <span style={{ marginLeft: 12 }}>计划: {o.planned_qty ?? '—'}</span>
                      </div>
                    }
                  >
                    <div style={{
                      fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>{o.order_no}</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); setDetailOrder(o as MobileOrderData) }}
                        style={{
                          fontSize: 11, color: '#2196F3', fontWeight: 400,
                          border: '1px solid #2196F3', borderRadius: 10,
                          padding: '1px 7px', cursor: 'pointer',
                        }}
                      >详情</span>
                    </div>
                  </List.Item>
                ))}
              </List>
            </PullToRefresh>
          )}
        </>
      )}

      {step === 1 && selectedOrder && (
        <div>
          {/* 订单信息卡 */}
          <div
            onClick={() => setDetailOrder(selectedOrder as MobileOrderData)}
            style={{
              background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14,
              border: '1px solid #eef0f3', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedOrder.order_no}</div>
              <span style={{ fontSize: 11, color: '#2196F3', border: '1px solid #2196F3', borderRadius: 10, padding: '1px 7px' }}>
                查看详情 ›
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selectedOrder.material_code} {selectedOrder.material_name || ''}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              计划数量: {selectedOrder.planned_qty ?? '—'}
            </div>
          </div>

          {/* 产线选择 */}
          <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>选择产线</div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20,
          }}>
            {lines.length === 0 && <span style={{ color: '#bbb', fontSize: 12 }}>加载产线中...</span>}
            {lines.map((l) => {
              const active = selectedLine?.line_id === l.line_id
              return (
                <div
                  key={l.line_id}
                  onClick={() => setSelectedLine(l)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    background: active ? '#E3F2FD' : '#f4f5f7',
                    color: active ? '#1976D2' : '#666',
                    fontSize: 13,
                    border: active ? '1px solid #2196F3' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {l.line_name || l.line_code}
                </div>
              )
            })}
          </div>

          {/* 数量输入 */}
          <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>报工数量</div>
          <div style={{
            background: '#fff', borderRadius: 10, padding: 16, marginBottom: 20,
            border: '1px solid #eef0f3', display: 'flex', justifyContent: 'center',
          }}>
            <Stepper
              value={reportQty}
              min={0}
              onChange={(v) => setReportQty(Number(v) || 0)}
              style={{ '--width': '120px' } as any}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={onSubmit}>
              提交报工
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 56 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>提交成功</div>
          {createdReportNo && (
            <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
              报工单号: {createdReportNo}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Button block fill="outline" onClick={() => navigate(-1)}>返回</Button>
            <Button block color="primary" onClick={resetAll}>再来一单</Button>
          </div>
        </div>
      )}
        </>
      )}

      {/* P-A: 工单详情抽屉 */}
      <MobileOrderDetail
        order={detailOrder}
        orderId={detailOrder?.order_id ?? null}
        visible={!!detailOrder}
        onClose={() => setDetailOrder(null)}
      />

      {/* 6-A: 报工单详情抽屉 */}
      <Dialog visible={!!activeReport} content={
        activeReport ? <ReportOrderDetail meta={activeReport} onClose={() => setActiveReport(null)} /> : null
      }
        actions={[{ key: 'close', text: '关闭', onClick: () => setActiveReport(null) }]}
      />
    </div>
  )
}
