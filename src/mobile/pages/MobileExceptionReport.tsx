/**
 * 异常工时上报移动端（P1.3）
 *
 * 3 步流程：
 *   Step 1: 选/扫报工单（来源：开工态报工单）
 *   Step 2: 填异常类型 / 起止时间 / 描述 / 设备（可选）
 *   Step 3: 提交 → 创建异常工时记录
 *
 * 后端接口：
 *   GET  /api/production/report-orders?status=开工&keyword=xxx  开工报工单列表
 *   GET  /api/basic/devices?keyword=xxx                        设备列表（可选）
 *   POST /api/production/process-exceptions                     异常工时上报
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, List, SearchBar, Toast, Dialog, TextArea, Picker, Card, PullToRefresh } from 'antd-mobile'
import { RightOutline } from 'antd-mobile-icons'
import api from '../../utils/api'
import { offlinePost } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'
import { MobileOrderDetail, MobileOrderData } from '../components/MobileOrderDetail'

interface ReportOrderRow {
  report_order_id: number
  order_id?: number
  report_no?: string
  order_no?: string
  material_name?: string
  material_code?: string
  line_name?: string
  status?: string
}

interface DeviceRow {
  device_id: number
  device_code?: string
  device_name?: string
}

type Step = 0 | 1 | 2

// 预设异常类型
const EXCEPTION_TYPES = [
  { label: '设备故障', value: '设备故障' },
  { label: '质量异常', value: '质量异常' },
  { label: '物料短缺', value: '物料短缺' },
  { label: '人员缺岗', value: '人员缺岗' },
  { label: '换型换线', value: '换型换线' },
  { label: '工艺异常', value: '工艺异常' },
  { label: '其它', value: '其它' },
]

// 停机类型
const STOP_TYPES = [
  { label: '计划停机', value: '计划停机' },
  { label: '非计划停机', value: '非计划停机' },
  { label: '不停机', value: '不停机' },
]

function nowLocalDateTimeInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIso(s: string): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

export default function MobileExceptionReport() {
  const navigate = useNavigate()
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [orders, setOrders] = useState<ReportOrderRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ReportOrderRow | null>(null)

  // 表单
  const [exceptionType, setExceptionType] = useState('')
  const [stopType, setStopType] = useState('')
  const [startTime, setStartTime] = useState(nowLocalDateTimeInput())
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [deviceId, setDeviceId] = useState<number | null>(null)
  const [deviceLabel, setDeviceLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  // 设备选择相关
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [devicePickerVisible, setDevicePickerVisible] = useState(false)

  // P-A: 工单详情抽屉
  const [detailOrder, setDetailOrder] = useState<MobileOrderData | null>(null)

  const loadOrders = async (kw?: string): Promise<ReportOrderRow[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 30, status: '开工' }
      if (kw) params.keyword = kw
      const r: any = await api.get('/production/report-orders', { params })
      const list: ReportOrderRow[] = r.success ? (r.data?.list || r.data?.rows || []) : []
      setOrders(list)
      return list
    } catch { return [] } finally { setLoading(false) }
  }

  useEffect(() => { loadOrders() }, [])

  // 加载设备列表
  const loadDevices = async () => {
    if (devices.length > 0) return
    try {
      const r: any = await api.get('/basic/devices', { params: { page: 1, pageSize: 200 } })
      if (r.success) setDevices(r.data?.list || r.data || [])
    } catch { /* 静默降级 */ }
  }

  const handleScan = async () => {
    const r = await scan()
    if (!r) return
    setKeyword(r.code)
    const list = await loadOrders(r.code)
    if (list.length === 1) {
      setSelected(list[0]); setStep(1)
    } else if (list.length > 1) {
      Toast.show({ content: `命中 ${list.length} 条，请手动选择`, position: 'bottom', duration: 1500 })
    } else {
      Toast.show({ content: '未找到匹配报工单', position: 'bottom' })
    }
  }

  const onSearch = () => { loadOrders(keyword.trim()) }

  const onSubmit = async () => {
    if (!selected) return
    if (!exceptionType) {
      Toast.show({ content: '请选择异常类型', position: 'bottom' }); return
    }
    if (!startTime) {
      Toast.show({ content: '请填写开始时间', position: 'bottom' }); return
    }
    if (endTime && toIso(endTime) && toIso(endTime)! < toIso(startTime)!) {
      Toast.show({ content: '结束时间不能早于开始时间', position: 'bottom' }); return
    }

    const ok = await Dialog.confirm({
      content: `确认上报异常工时：${selected.report_no || selected.order_no} - ${exceptionType}？`,
      confirmText: '提交',
      cancelText: '取消',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      const r: any = await offlinePost('/production/process-exceptions', {
        report_order_id: selected.report_order_id,
        exception_type: exceptionType,
        stop_type: stopType,
        device_id: deviceId || undefined,
        start_time: toIso(startTime),
        end_time: endTime ? toIso(endTime) : undefined,
        description,
      }, { source: 'exception-report' })
      if (!r.success) {
        Toast.show({ content: r.message || '提交失败', position: 'bottom' })
        return
      }
      if (r.data?.queued) {
        Toast.show({ content: '已暂存，网络恢复后自动同步', icon: 'success', position: 'bottom' })
      } else {
        Toast.show({ content: '上报成功', icon: 'success', position: 'bottom' })
      }
      setSuccessNo(String(r.data?.exception_id || (r.data?.queued ? '（离线暂存）' : '')))
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep(0); setSelected(null)
    setExceptionType(''); setStopType('')
    setStartTime(nowLocalDateTimeInput()); setEndTime('')
    setDescription(''); setDeviceId(null); setDeviceLabel('')
    setSuccessNo(''); setKeyword('')
    loadOrders()
  }

  // Step 2: 完成
  if (step === 2 && selected) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>异常已上报</div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
          {exceptionType} · {selected.report_no || selected.order_no}
        </div>
        {successNo && (
          <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
            记录 ID：{successNo}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => navigate(-1)}>返回</Button>
          <Button block color="primary" onClick={reset}>继续上报</Button>
        </div>
      </div>
    )
  }

  return (
    step === 0 ? (
      <div className="mobile-page-fixed-header">
        <div className="mobile-sticky-header">
          <SearchBar
            placeholder="扫报工单号 / 手输"
            value={keyword}
            onChange={setKeyword}
            onSearch={onSearch}
          />
          <Button size="mini" onClick={handleScan} style={{marginTop:8}}>扫码</Button>
        </div>
        <div className="mobile-page-scroll-list">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无开工报工单<br />
              <span style={{ fontSize: 12 }}>请先在 PC 端下发订单并报工</span>
            </div>
          ) : (
            <PullToRefresh onRefresh={async () => { await loadOrders(keyword.trim() || undefined) }}>
              <List>
                {orders.map((o) => (
                  <List.Item
                    key={o.report_order_id}
                    onClick={() => { setSelected(o); setStep(1) }}
                    arrow
                    description={
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {o.material_name || ''} · {o.line_name || '—'}
                        <span style={{ marginLeft: 8, color: '#4CAF50' }}>{o.status}</span>
                      </div>
                    }
                  >
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{o.report_no || o.order_no}</span>
                      {o.order_id && (
                        <span
                          onClick={(e) => { e.stopPropagation(); setDetailOrder({ order_id: o.order_id!, order_no: o.order_no || o.report_no } as MobileOrderData) }}
                          style={{
                            fontSize: 11, color: '#2196F3', fontWeight: 400,
                            border: '1px solid #2196F3', borderRadius: 10,
                            padding: '1px 7px', cursor: 'pointer',
                          }}
                        >详情</span>
                      )}
                    </div>
                  </List.Item>
                ))}
              </List>
            </PullToRefresh>
          )}
        </div>

        {/* P-A: 工单详情抽屉 */}
        <MobileOrderDetail
          order={detailOrder}
          orderId={detailOrder?.order_id ?? null}
          visible={!!detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      </div>
    ) : (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {step === 1 && selected && (
        <>
          <div
            onClick={() => selected.order_id && setDetailOrder({ order_id: selected.order_id!, order_no: selected.order_no || selected.report_no } as MobileOrderData)}
            style={{
              background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14,
              border: '1px solid #eef0f3',
              cursor: selected.order_id ? 'pointer' : 'default',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.report_no || selected.order_no}</div>
              {selected.order_id && (
                <span style={{ fontSize: 11, color: '#2196F3', border: '1px solid #2196F3', borderRadius: 10, padding: '1px 7px' }}>
                  查看工单详情 ›
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selected.material_name || ''} · {selected.line_name || ''}
            </div>
          </div>

          <Card
            title="异常信息"
            style={{
              '--border-radius': '10px',
              marginBottom: 14,
            } as any}
          >
            <List>
              <List.Item
                onClick={() => {
                  Picker.prompt({
                    columns: [EXCEPTION_TYPES],
                    onConfirm: (v) => { if (v && v[0]) setExceptionType(v[0] as string) },
                  })
                }}
                extra={exceptionType || '请选择'}
                arrow
              >
                异常类型
              </List.Item>
              <List.Item
                onClick={() => {
                  Picker.prompt({
                    columns: [STOP_TYPES],
                    onConfirm: (v) => { if (v && v[0]) setStopType(v[0] as string) },
                  })
                }}
                extra={stopType || '请选择（可选）'}
                arrow
              >
                停机类型
              </List.Item>
              <List.Item
                onClick={async () => {
                  await loadDevices()
                  if (devices.length === 0) {
                    Toast.show({ content: '暂无可选设备', position: 'bottom' })
                    return
                  }
                  setDevicePickerVisible(true)
                }}
                extra={deviceLabel || '请选择（可选）'}
                arrow
              >
                关联设备
              </List.Item>
            </List>
          </Card>

          <Card
            title="时间"
            style={{ '--border-radius': '10px', marginBottom: 14 } as any}
          >
            <div style={{ padding: '0 12px' }}>
              <div style={{ fontSize: 13, color: '#666', margin: '8px 0 6px' }}>开始时间</div>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: 14,
                  border: '1px solid #eef0f3', borderRadius: 8, background: '#fff',
                }}
              />
              <div style={{ fontSize: 13, color: '#666', margin: '12px 0 6px' }}>结束时间（可选）</div>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: 14,
                  border: '1px solid #eef0f3', borderRadius: 8, background: '#fff',
                }}
              />
            </div>
          </Card>

          <Card
            title="异常描述"
            style={{ '--border-radius': '10px', marginBottom: 14 } as any}
          >
            <div style={{ padding: '0 12px' }}>
              <TextArea
                placeholder="请描述异常情况、影响及处理过程"
                value={description}
                onChange={setDescription}
                rows={4}
                style={{ background: '#f7f8fa', borderRadius: 8, padding: 8, marginTop: 8 }}
              />
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={onSubmit}>提交上报</Button>
          </div>
        </>
      )}

      {/* 设备选择 Picker */}
      <Picker
        visible={devicePickerVisible}
        columns={[
          devices.map((d) => ({
            label: `${d.device_name || ''} (${d.device_code || ''})`,
            value: String(d.device_id),
          })),
        ]}
        onClose={() => setDevicePickerVisible(false)}
        onConfirm={(v) => {
          const idStr = v?.[0] as string
          if (!idStr) return
          const id = Number(idStr)
          setDeviceId(id)
          const dev = devices.find((d) => d.device_id === id)
          setDeviceLabel(dev ? `${dev.device_name} (${dev.device_code})` : '')
          setDevicePickerVisible(false)
        }}
      />

      {/* P-A: 工单详情抽屉 */}
      <MobileOrderDetail
        order={detailOrder}
        orderId={detailOrder?.order_id ?? null}
        visible={!!detailOrder}
        onClose={() => setDetailOrder(null)}
      />
    </div>
    )
  )
}
