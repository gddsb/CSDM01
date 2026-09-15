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
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Steps, Button, List, SearchBar, Stepper, Toast, Dialog } from 'antd-mobile'
import api from '../../utils/api'
import { useBarcode } from '../hooks/useBarcode'

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
}

type Step = 0 | 1 | 2 // 选订单 / 填数据 / 提交结果

export default function MobileProcessReporting() {
  const navigate = useNavigate()
  const { scan, isScanning } = useBarcode()

  const [step, setStep] = useState<Step>(0)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [lines, setLines] = useState<LineRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [selectedLine, setSelectedLine] = useState<LineRow | null>(null)
  const [reportQty, setReportQty] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [createdReportNo, setCreatedReportNo] = useState<string | null>(null)

  // Step 1: 加载待报工订单
  const loadOrders = async (kw?: string) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 30, status: '已下发' }
      if (kw) params.keyword = kw
      const r: any = await api.get('/production/orders', { params })
      if (r.success) setOrders(r.data?.list || r.data?.rows || r.data || [])
    } catch {} finally { setLoading(false) }
  }

  // 产线列表（全量加载一次）
  useEffect(() => {
    api.get('/basic/lines', { params: { page_size: 200 } }).then((r: any) => {
      if (r.success) setLines(r.data?.list || r.data || [])
    }).catch(() => {})
    loadOrders()
  }, [])

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
    await loadOrders(kw)
    // 命中唯一结果 → 自动选中
    if (orders.length === 1) goToFill(orders[0])
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
      <Steps
        current={step}
        direction="vertical"
        style={{ marginBottom: 16 }}
      >
        <Steps.Step title="选订单" description={step > 0 ? selectedOrder?.order_no : ''} />
        <Steps.Step title="填数据" description={step > 1 ? `${reportQty} × ${selectedLine?.line_name}` : ''} />
        <Steps.Step title="提交" />
      </Steps>

      {step === 0 && (
        <>
          <SearchBar
            placeholder="扫订单号 / 手输关键词"
            value={keyword}
            onChange={setKeyword}
            onSearch={onSearch}
            onRightIconClick={handleScanOrder}
            right={<span style={{ fontSize: 12, color: '#2196F3' }}>扫码</span>}
            style={{ marginBottom: 12 }}
          />
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无待报工订单<br />
              <span style={{ fontSize: 12 }}>请先在 PC 端下发生产订单</span>
            </div>
          ) : (
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
                  <div style={{ fontWeight: 500 }}>{o.order_no}</div>
                </List.Item>
              ))}
            </List>
          )}
        </>
      )}

      {step === 1 && selectedOrder && (
        <div>
          {/* 订单信息卡 */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14,
            border: '1px solid #eef0f3',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedOrder.order_no}</div>
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
    </div>
  )
}
