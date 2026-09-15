/**
 * 设备故障上报移动端（Phase 2 · Q-A）
 *
 * 3 步流程：
 *   Step 1: 扫/选设备（从 /api/basic/devices 列表）
 *   Step 2: 填故障信息（等级 / 类型 / 描述 / 时间）
 *   Step 3: 提交 → POST /api/basic/device-faults → 成功展示工单号
 *
 * 后端接口：
 *   GET  /api/basic/devices?device_code=xxx          设备列表
 *   POST /api/basic/device-faults                     创建故障（自动生成 fault_no）
 *   POST /api/basic/device-faults/:id/images          上传故障图片（可选扩展）
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, List, SearchBar, Toast, Dialog, TextArea, Picker, Steps, PullToRefresh, Radio } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'

interface DeviceRow {
  device_id: number
  device_code?: string
  device_name?: string
  location?: string
  line_name?: string
  status?: string | number
}

type Step = 0 | 1 | 2

const FAULT_LEVELS = [
  { label: '一般', value: '1' },
  { label: '严重', value: '2' },
  { label: '紧急', value: '3' },
]

const FAULT_TYPES = [
  '机械故障',
  '电气故障',
  '液压故障',
  '气动故障',
  '程序/传感器',
  '外观/安全门',
  '其它',
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

export default function MobileDeviceFault() {
  const navigate = useNavigate()
  const { scan } = useBarcode()

  const [step, setStep] = useState<Step>(0)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null)

  // 故障表单
  const [faultLevel, setFaultLevel] = useState('1')
  const [faultType, setFaultType] = useState('')
  const [faultTime, setFaultTime] = useState(nowLocalDateTimeInput())
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  const loadDevices = async (kw?: string): Promise<DeviceRow[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 50 }
      const k = kw ?? keyword
      if (k) params.device_code = k
      const r: any = await api.get('/basic/devices', { params })
      const list: DeviceRow[] = r.success ? (r.data?.list || r.data || []) : []
      setDevices(list)
      return list
    } catch {
      return []
    } finally { setLoading(false) }
  }

  useEffect(() => { loadDevices() }, [])

  const handleScan = async () => {
    const r = await scan()
    if (!r) return
    setKeyword(r.code)
    const list = await loadDevices(r.code)
    const match = list.find((d) => d.device_code === r.code)
    if (match) {
      setSelectedDevice(match); setStep(1)
    } else {
      Toast.show({ content: '未找到该设备，请确认设备编号', position: 'bottom' })
    }
  }

  const onPickType = async () => {
    const ok = await Picker.prompt({
      columns: [FAULT_TYPES.map((t) => ({ label: t, value: t }))],
    })
    if (ok && ok[0]) setFaultType(ok[0] as string)
  }

  const onSubmit = async () => {
    if (!selectedDevice) return
    if (!description.trim()) {
      Toast.show({ content: '请填写故障描述', position: 'bottom' }); return
    }

    const ok = await Dialog.confirm({
      content: `确认上报故障：${selectedDevice.device_name}？`,
      confirmText: '提交',
      cancelText: '取消',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      const r: any = await offlinePost('/basic/device-faults', {
        device_id: selectedDevice.device_id,
        fault_level: Number(faultLevel),
        fault_type: faultType,
        fault_time: toIso(faultTime),
        description,
      }, { source: 'device-fault' })

      if (!r.success) {
        Toast.show({ content: r.message || '提交失败', position: 'bottom' })
        return
      }

      if (r.data?.queued) {
        Toast.show({ content: '已暂存，网络恢复后自动同步', icon: 'success', position: 'bottom' })
      }

      setSuccessNo(r.data?.fault_no || String(r.data?.fault_id || ''))
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setSelectedDevice(null)
    setFaultLevel('1'); setFaultType(''); setFaultTime(nowLocalDateTimeInput())
    setDescription(''); setSuccessNo(''); setKeyword('')
    loadDevices()
  }

  // =========== Render ===========

  if (step === 2 && selectedDevice) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>故障上报成功</div>
        {successNo && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
            故障单号：{successNo}
          </div>
        )}
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
          {selectedDevice.device_code} · {selectedDevice.device_name}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => navigate(-1)}>返回</Button>
          <Button block color="primary" onClick={reset}>继续上报</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 12 }}>
      <Steps current={step} direction="vertical" style={{ marginBottom: 16 }}>
        <Steps.Step title="选设备" description={step > 0 ? selectedDevice?.device_code : ''} />
        <Steps.Step title="填故障" description={step > 1 ? `等级${['','一般','严重','紧急'][Number(faultLevel)]}` : ''} />
        <Steps.Step title="提交" />
      </Steps>

      {/* Step 0: 选设备 */}
      {step === 0 && (
        <>
          <SearchBar
            placeholder="扫设备编号 / 手输"
            value={keyword}
            onChange={setKeyword}
            onSearch={() => loadDevices(keyword.trim())}
            onRightIconClick={handleScan}
            right={<span style={{ fontSize: 12, color: '#2196F3' }}>扫码</span>}
            style={{ marginBottom: 12 }}
          />
          {loading ? (
            <EmptyHint text="加载中..." />
          ) : devices.length === 0 ? (
            <EmptyHint text="未找到设备" sub="请先在 PC 端创建设备档案" />
          ) : (
            <PullToRefresh onRefresh={async () => { await loadDevices(keyword.trim() || undefined) }}>
              <List>
                {devices.map((d) => (
                  <List.Item
                    key={d.device_id}
                    onClick={() => { setSelectedDevice(d); setStep(1) }}
                    arrow
                    description={
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {d.location || '—'} · {d.line_name || '—'}
                        {d.status && <span style={{ marginLeft: 8, color: '#4CAF50' }}>{d.status}</span>}
                      </div>
                    }
                  >
                    <div style={{ fontWeight: 500 }}>
                      {d.device_code} · {d.device_name}
                    </div>
                  </List.Item>
                ))}
              </List>
            </PullToRefresh>
          )}
        </>
      )}

      {/* Step 1: 填故障 */}
      {step === 1 && selectedDevice && (
        <>
          {/* 设备信息卡 */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #eef0f3' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedDevice.device_code}</div>
            <div style={{ fontSize: 13, color: '#444', marginTop: 2 }}>{selectedDevice.device_name}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selectedDevice.location || '—'} · {selectedDevice.line_name || '—'}
            </div>
          </div>

          {/* 故障等级 */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>故障等级</div>
            <Radio.Group value={faultLevel} onChange={(v) => setFaultLevel(v as any)}
              style={{ display: 'flex', gap: 20 }}>
              <Radio value="1" style={{ color: '#4CAF50' }}>一般</Radio>
              <Radio value="2" style={{ color: '#FF9800' }}>严重</Radio>
              <Radio value="3" style={{ color: '#F44336' }}>紧急</Radio>
            </Radio.Group>
          </div>

          {/* 故障类型 */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <List.Item
              onClick={onPickType}
              extra={faultType || '请选择'}
              arrow
            >故障类型</List.Item>
          </div>

          {/* 故障时间 */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>发生时间</div>
            <input
              type="datetime-local"
              value={faultTime}
              onChange={(e) => setFaultTime(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 14,
                border: '1px solid #eef0f3', borderRadius: 8, background: '#fff',
              }}
            />
          </div>

          {/* 故障描述 */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
              故障描述 <span style={{ color: '#F44336' }}>*</span>
            </div>
            <TextArea
              placeholder="请详细描述故障现象、发生时的工况、是否影响生产..."
              value={description}
              onChange={setDescription}
              rows={4}
              style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, paddingBottom: 24 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={onSubmit}>
              提交故障
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}</div>
}
