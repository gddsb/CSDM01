/**
 * 设备保养执行移动端（P1.2）
 *
 * 3 步流程：
 *   Step 1: 选/扫设备 → 加载该设备待执行的保养记录
 *   Step 2: 选某条保养记录 → 开始保养 → 填保养内容 / 实测值 / 结果
 *   Step 3: 提交 → 完成保养
 *
 * 后端接口：
 *   GET  /api/basic/devices?device_code=xxx           设备列表
 *   GET  /api/basic/device-records?status=待执行&device_id=xxx  待保养记录
 *   PUT  /api/basic/device-records/:id/start           开始保养
 *   PUT  /api/basic/device-records/:id/submit          提交保养（含 result/abnormal_desc/actual_value/maintenance_content）
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, List, SearchBar, Toast, Dialog, TextArea, Radio, Steps, PullToRefresh } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePut } from '../offline/offlineApi'
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
  period_key?: string
  trigger_mode?: string
  standard_name?: string
  standard_id?: number
}

type Step = 0 | 1 | 2

export default function MobileDeviceMaintenance() {
  const navigate = useNavigate()
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  // 保养表单
  const [actualValue, setActualValue] = useState('')
  const [result, setResult] = useState<'正常' | '异常'>('正常')
  const [content, setContent] = useState('')
  const [abnormalDesc, setAbnormalDesc] = useState('')
  const [remarks, setRemarks] = useState('')

  const loadDevices = async (kw?: string) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 50 }
      if (kw) params.device_code = kw
      const r: any = await api.get('/basic/devices', { params })
      if (r.success) setDevices(r.data?.list || r.data || [])
    } catch { /* 静默降级 */ } finally { setLoading(false) }
  }

  useEffect(() => { loadDevices() }, [])

  const loadRecords = async (device: DeviceRow) => {
    setSelectedDevice(device)
    setSelectedRecord(null)
    setLoading(true)
    try {
      const r: any = await api.get('/basic/device-records', {
        params: { page: 1, page_size: 30, status: '待执行', device_id: device.device_id },
      })
      if (r.success) setRecords(r.data?.list || r.data || [])
      else setRecords([])
    } catch { /* 静默降级 */ } finally { setLoading(false) }
  }

  const handleScan = async () => {
    const r = await scan()
    if (!r) return
    setKeyword(r.code)
    await loadDevices(r.code)
    // 自动选中匹配设备
    const match = devices.find((d) => d.device_code === r.code)
    if (match) {
      await loadRecords(match)
      setStep(1)
    } else {
      Toast.show({ content: '未找到该设备，请确认设备编号', position: 'bottom' })
    }
  }

  // Step 1 → Step 2: 选保养记录
  const selectRecord = async (rec: RecordRow) => {
    setSelectedRecord(rec)
    setActualValue(''); setResult('正常'); setContent('')
    setAbnormalDesc(''); setRemarks('')
    setStep(2)
  }

  // Step 2 → Step 3: 提交
  const onSubmit = async () => {
    if (!selectedRecord) return
    if (result === '异常' && !abnormalDesc.trim()) {
      Toast.show({ content: '请填写异常描述', position: 'bottom' })
      return
    }
    const ok = await Dialog.confirm({
      content: `确认提交 ${selectedDevice?.device_name || ''} 的保养记录？`,
      confirmText: '提交',
      cancelText: '取消',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      // 1) 开始保养（若未开始；离线时入队等同步）
      try {
        await offlinePut(`/basic/device-records/${selectedRecord.record_id}/start`, {}, { source: 'device-maintenance' })
      } catch { /* 可能已开始 */ }
      // 2) 提交保养
      const r: any = await offlinePut(`/basic/device-records/${selectedRecord.record_id}/submit`, {
        actual_value: actualValue,
        result,
        maintenance_content: content,
        abnormal_desc: result === '异常' ? abnormalDesc : '',
        remarks,
      }, { source: 'device-maintenance' })
      if (!r.success) {
        Toast.show({ content: r.message || '提交失败', position: 'bottom' })
        return
      }
      if (r.data?.queued) {
        Toast.show({ content: '已暂存，网络恢复后自动同步', icon: 'success', position: 'bottom' })
      } else {
        Toast.show({ content: '提交成功', icon: 'success', position: 'bottom' })
      }
      setSuccessNo(r.data?.record_no || (r.data?.queued ? '（离线暂存）' : String(selectedRecord.record_id)))
      setStep(3)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep(0); setSelectedDevice(null); setSelectedRecord(null)
    setActualValue(''); setResult('正常'); setContent('')
    setAbnormalDesc(''); setRemarks(''); setSuccessNo(''); setKeyword('')
    loadDevices()
  }

  // Step 3: 完成
  if (step === 3) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>保养完成</div>
        {successNo && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
            记录编号：{successNo}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => navigate(-1)}>返回</Button>
          <Button block color="primary" onClick={reset}>继续</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 12 }}>
      <Steps current={step} direction="vertical" style={{ marginBottom: 16 }}>
        <Steps.Step title="选设备" description={step > 0 ? selectedDevice?.device_name : ''} />
        <Steps.Step title="选保养项" description={step > 1 ? selectedRecord?.standard_name : ''} />
        <Steps.Step title="提交" />
      </Steps>

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
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
          ) : devices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无设备<br />
              <span style={{ fontSize: 12 }}>请先在 PC 端创建设备档案</span>
            </div>
          ) : (
            <PullToRefresh onRefresh={async () => { await loadDevices(keyword.trim() || undefined) }}>
              <List>
                {devices.map((d) => (
                  <List.Item
                    key={d.device_id}
                    onClick={() => { loadRecords(d); setStep(1) }}
                    arrow
                    description={<div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{d.device_code}</div>}
                  >
                    <div style={{ fontWeight: 500 }}>{d.device_name}</div>
                  </List.Item>
                ))}
              </List>
            </PullToRefresh>
          )}
        </>
      )}

      {step === 1 && selectedDevice && (
        <>
          <div style={{
            background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14,
            border: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedDevice.device_name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{selectedDevice.device_code}</div>
            </div>
            <span style={{ fontSize: 12, color: '#2196F3', cursor: 'pointer' }}
              onClick={() => { setStep(0); setSelectedDevice(null); setRecords([]) }}>更换</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              该设备暂无待执行的保养任务<br />
              <span style={{ fontSize: 12 }}>请先在 PC 端生成保养执行记录</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                待保养记录（{records.length}）
              </div>
              <List>
                {records.map((r) => (
                  <List.Item
                    key={r.record_id}
                    onClick={() => selectRecord(r)}
                    arrow
                    description={
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {r.trigger_mode || ''} · {r.period_key || r.plan_date || '—'}
                      </div>
                    }
                  >
                    <div style={{ fontWeight: 500 }}>{r.standard_name || '保养项'}</div>
                  </List.Item>
                ))}
              </List>
            </>
          )}

          <Button block fill="outline" onClick={() => setStep(0)} style={{ marginTop: 16 }}>上一步</Button>
        </>
      )}

      {step === 2 && selectedRecord && (
        <>
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #eef0f3' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {selectedRecord.standard_name || '保养项'}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selectedRecord.device_name} · {selectedRecord.trigger_mode || ''} · {selectedRecord.period_key || selectedRecord.plan_date || '—'}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>实测值（可选）</div>
            <TextArea
              placeholder="实测数值，如：压力 0.4MPa"
              value={actualValue}
              onChange={setActualValue}
              rows={2}
              style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }}
            />
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>保养内容</div>
            <TextArea
              placeholder="保养作业内容、更换备件、清洁润滑等"
              value={content}
              onChange={setContent}
              rows={3}
              style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }}
            />
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>执行结果</div>
            <Radio.Group value={result} onChange={(v) => setResult(v as any)} style={{ display: 'flex', gap: 20 }}>
              <Radio value="正常">正常</Radio>
              <Radio value="异常">异常</Radio>
            </Radio.Group>
            {result === '异常' && (
              <div style={{ marginTop: 10 }}>
                <TextArea
                  placeholder="请描述异常情况"
                  value={abnormalDesc}
                  onChange={setAbnormalDesc}
                  rows={2}
                  style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }}
                />
              </div>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>备注（可选）</div>
            <TextArea
              placeholder="备注"
              value={remarks}
              onChange={setRemarks}
              rows={2}
              style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(1)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={onSubmit}>提交保养</Button>
          </div>
        </>
      )}
    </div>
  )
}
