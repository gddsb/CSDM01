/**
 * 设备点检移动端
 * - 扫设备 → 展示待提交的保养/点检记录 → 提交
 * 后端：
 *   GET  /api/basic/device-records?status=待执行&device_code=xxx
 *   PUT  /api/basic/device-records/:id/start
 *   PUT  /api/basic/device-records/:id/submit
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, List, SearchBar, Stepper, Toast, Dialog, Checkbox } from 'antd-mobile'
import api from '../../utils/api'
import { useBarcode } from '../hooks/useBarcode'

interface DeviceRow {
  device_id: number
  device_code?: string
  device_name?: string
}

interface RecordRow {
  record_id: number
  device_id?: number
  device_code?: string
  device_name?: string
  status?: string
  plan_date?: string
  standard_name?: string
}

export default function MobileDeviceInspection() {
  const navigate = useNavigate()
  const { scan } = useBarcode()
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null)
  const [loading, setLoading] = useState(false)

  // 点检结果表单（简化版）
  const [okCount, setOkCount] = useState(0)
  const [fail, setFail] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)

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

  const loadRecords = async (device: DeviceRow) => {
    setSelectedDevice(device)
    try {
      const r: any = await api.get('/basic/device-records', {
        params: { page: 1, page_size: 20, status: '待执行', device_id: device.device_id },
      })
      if (r.success) setRecords(r.data?.list || r.data || [])
      else setRecords([])
    } catch {}
    setOkCount(0); setFail([]); setSubmitted(null)
  }

  const handleScan = async () => {
    const r = await scan()
    if (!r) return
    setKeyword(r.code)
    const list = await loadDevices(r.code)
    const match = list.find((d) => d.device_code === r.code)
    if (match) {
      await loadRecords(match)
    } else {
      Toast.show({ content: '未找到该设备，请确认设备编号', position: 'bottom' })
    }
  }

  const onSubmit = async () => {
    const ok = await Dialog.confirm({
      content: `提交 ${selectedDevice?.device_name || selectedDevice?.device_code} 的点检结果？`,
    })
    if (!ok) return
    setSubmitting(true)
    try {
      // 提交第一条待执行记录
      const rec = records.find((r) => r.status === '待执行') || records[0]
      if (!rec) { Toast.show({ content: '没有待提交的点检记录', position: 'bottom' }); return }
      try { await api.put(`/basic/device-records/${rec.record_id}/start`) } catch {}
      await api.put(`/basic/device-records/${rec.record_id}/submit`, {
        result: fail.length === 0 ? '合格' : '不合格',
        remarks: fail.length > 0 ? `不合格项: ${fail.join(', ')}` : '',
      })
      setSubmitted(`${rec.standard_name || rec.device_name || selectedDevice?.device_name} 点检完成`)
      Toast.show({ content: '提交成功', icon: 'success', position: 'bottom' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setSelectedDevice(null); setRecords([]); setKeyword(''); setSubmitted(null)
    setOkCount(0); setFail([]); loadDevices()
  }

  if (submitted) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 24px' }}>{submitted}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => navigate(-1)}>返回</Button>
          <Button block color="primary" onClick={reset}>继续点检</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 12 }}>
      {!selectedDevice ? (
        <>
          <SearchBar
            placeholder="扫设备编号 / 手输"
            value={keyword}
            onChange={setKeyword}
            onSearch={loadDevices}

            style={{ marginBottom: 12 }}
          />
          <Button size="mini" onClick={handleScan} style={{marginTop:8}}>扫码</Button>
          {loading ? <EmptyHint text="加载中..." /> : devices.length === 0 ? (
            <EmptyHint text="暂无设备" sub="请先在 PC 端创建设备档案" />
          ) : (
            <List>
              {devices.map((d) => (
                <List.Item
                  key={d.device_id}
                  onClick={() => loadRecords(d)}
                  arrow
                  description={<div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{d.device_code}</div>}
                >
                  <div style={{ fontWeight: 500 }}>{d.device_name}</div>
                </List.Item>
              ))}
            </List>
          )}
        </>
      ) : (
        <>
          <div style={{
            background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14,
            border: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedDevice.device_name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{selectedDevice.device_code}</div>
            </div>
            <span style={{ fontSize: 12, color: '#2196F3', cursor: 'pointer' }} onClick={() => setSelectedDevice(null)}>更换</span>
          </div>

          {records.length === 0 ? (
            <EmptyHint text="该设备暂无可执行的点检/保养任务" />
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>待执行记录（{records.length}）</div>
              {records.map((r) => (
                <div key={r.record_id} style={{
                  background: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #eef0f3',
                }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{r.standard_name || '点检项'}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>状态: {r.status} · 计划日期: {r.plan_date || '—'}</div>
                </div>
              ))}

              {/* 点检表单（简化：合格项数 + 不合格项列表）*/}
              <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginTop: 14, border: '1px solid #eef0f3' }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>点检结果</div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>合格项数（简化）</div>
                <Stepper value={okCount} min={0} onChange={(v) => setOkCount(Number(v) || 0)} style={{ '--width': '140px' } as any} />
                <div style={{ fontSize: 12, color: '#666', marginTop: 14, marginBottom: 6 }}>
                  不合格项（勾选）
                </div>
                <Checkbox.Group value={fail} onChange={(v) => setFail(v as string[])}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Checkbox value="外观损伤">外观损伤</Checkbox>
                    <Checkbox value="异响振动">异响振动</Checkbox>
                    <Checkbox value="紧固件松动">紧固件松动</Checkbox>
                    <Checkbox value="润滑不足">润滑不足</Checkbox>
                    <Checkbox value="电气异常">电气异常</Checkbox>
                  </div>
                </Checkbox.Group>
              </div>

              <Button
                block color="primary" loading={submitting} onClick={onSubmit}
                style={{ marginTop: 20, height: 46, fontSize: 15, borderRadius: 10 }}
              >
                提交点检结果
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
      {text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}
