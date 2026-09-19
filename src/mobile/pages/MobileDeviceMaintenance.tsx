/**
 * 设备保养执行移动端（Phase 5-A 激活）
 *
 * 对齐 PC DeviceMaintenanceUnified.tsx 的完整写动作：
 *   ✅ 生成记录  POST /basic/device-records/generate
 *   ✅ 开始保养  PUT  /basic/device-records/:id/start
 *   ✅ 跳过      PUT  /basic/device-records/:id/skip
 *   ✅ 提交结果  PUT  /basic/device-records/:id/submit
 *   ✅ 图片上传  POST /basic/device-records/:id/images (multipart)
 *   ✅ 删除      DELETE /basic/device-records/:id
 *
 * 状态机（与 PC 对齐）：
 *   待执行 → (start) → 进行中 → (skip/submit) → 已跳过/已完成
 *   待执行 → (skip)  → 已跳过
 *
 * 离线：所有写操作走 offlineApi；图片先缓存后上传或跳过
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, List, SearchBar, Toast, Dialog, TextArea, Radio, PullToRefresh, Tabs, ImageUploader, Space,
} from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import api from '../../utils/api'
import { offlinePost, offlinePut, offlineDelete } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'

interface DeviceRow { device_id: number; device_code?: string; device_name?: string }
interface RecordRow {
  record_id: number; device_id?: number; device_code?: string; device_name?: string
  status?: string; plan_date?: string; period_key?: string; trigger_mode?: string
  standard_name?: string; standard_id?: number; maintenance_images?: any[]
}

type Step = 0 | 1 | 2 | 3
type StatusTab = 'all' | '待执行' | '进行中' | '已完成' | '已跳过'

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '待执行', label: '待执行' },
  { key: '进行中', label: '进行中' },
  { key: '已完成', label: '已完成' },
  { key: '已跳过', label: '已跳过' },
]

// ========== 5-A 主组件 ==========

export default function MobileDeviceMaintenance() {
  const navigate = useNavigate()
  const { scan } = useBarcode()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [step, setStep] = useState<Step>(0)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusTab, setStatusTab] = useState<StatusTab>('待执行')

  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 保养表单
  const [actualValue, setActualValue] = useState('')
  const [result, setResult] = useState<'正常' | '异常'>('正常')
  const [content, setContent] = useState('')
  const [abnormalDesc, setAbnormalDesc] = useState('')
  const [remarks, setRemarks] = useState('')
  const [images, setImages] = useState<ImageUploadItem[]>([])

  // ===== 设备 =====
  const loadDevices = async (kw?: string): Promise<DeviceRow[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 50 }
      if (kw) params.device_code = kw
      const r: any = await api.get('/basic/devices', { params })
      const list: DeviceRow[] = r.success ? (r.data?.list || r.data || []) : []
      setDevices(list); return list
    } catch { return [] } finally { setLoading(false) }
  }

  useEffect(() => { loadDevices() }, [])

  // ===== 保养记录（按设备+状态）=====
  const loadRecords = async (
    device: DeviceRow,
    status?: StatusTab,
  ): Promise<RecordRow[]> => {
    setSelectedDevice(device)
    setSelectedRecord(null)
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        page: 1, pageSize: 50, device_id: device.device_id,
      }
      const s = (status || statusTab)
      if (s !== 'all') params.status = s
      const r: any = await api.get('/basic/device-records', { params })
      const list: RecordRow[] = r.success ? (r.data?.list || r.data || []) : []
      setRecords(list); return list
    } catch { setRecords([]); return [] } finally { setLoading(false) }
  }

  const refreshRecords = async () => {
    if (selectedDevice) await loadRecords(selectedDevice, statusTab)
  }

  // ===== 扫码 =====
  const handleScan = async () => {
    const r = await scan()
    if (!r) return
    setKeyword(r.code)
    const list = await loadDevices(r.code)
    const match = list.find((d) => d.device_code === r.code)
    if (!match) {
      Toast.show({ content: '未找到该设备', position: 'bottom' }); return
    }
    const recs = await loadRecords(match, '待执行')
    if (recs.length === 0) {
      Toast.show({ content: `${match.device_name} 暂无待执行保养`, position: 'bottom' })
      setStep(1); return
    }
    if (recs.length === 1) selectRecord(recs[0])
    else setStep(1)
  }

  const handleSearch = async () => {
    const kw = keyword.trim()
    const list = await loadDevices(kw)
    if (list.length === 0) Toast.show({ content: '未找到匹配设备', position: 'bottom' })
    else if (list.length === 1) {
      const recs = await loadRecords(list[0], '待执行')
      if (recs.length === 1) selectRecord(recs[0]); else setStep(1)
    }
  }

  // ===== 5-A 新：生成保养记录 =====
  const handleGenerate = async () => {
    const ok = await Dialog.confirm({
      content: selectedDevice
        ? `为「${selectedDevice.device_name}」生成保养执行记录？（周期：日/周/月/运行时长）`
        : '为全部设备生成保养执行记录？',
      confirmText: '生成',
      cancelText: '取消',
    })
    if (!ok) return
    try {
      const payload: any = { mode: ['daily', 'weekly', 'monthly', 'runtime'], target_date: todayStr() }
      if (selectedDevice) payload.device_id = selectedDevice.device_id
      const r: any = await offlinePost('/basic/device-records/generate', payload, { source: 'device-maintenance' })
      Toast.show({
        content: r.data?.queued ? '已暂存，恢复网络后自动生成' : (r.message || '生成成功'),
        icon: 'success', position: 'bottom',
      })
      await refreshRecords()
    } catch (e: any) {
      Toast.show({ content: e?.message || '生成失败', position: 'bottom' })
    }
  }

  // ===== 5-A 新：跳过 =====
  const handleSkip = async (rec: RecordRow) => {
    const ok = await Dialog.confirm({
      content: `确认跳过「${rec.standard_name || rec.record_id}」？跳过后不扣完成率。`,
      confirmText: '跳过',
      cancelText: '取消',
    })
    if (!ok) return
    try {
      await offlinePut(`/basic/device-records/${rec.record_id}/skip`, {}, { source: 'device-maintenance' })
      Toast.show({ content: '已跳过', icon: 'success', position: 'bottom' })
      await refreshRecords()
    } catch (e: any) {
      Toast.show({ content: e?.message || '操作失败', position: 'bottom' })
    }
  }

  // ===== 5-A 新：删除 =====
  const handleDelete = async (rec: RecordRow) => {
    const ok = await Dialog.confirm({
      content: `确认删除「${rec.standard_name || rec.record_id}」保养记录？`,
      confirmText: '删除',
      cancelText: '取消',
    })
    if (!ok) return
    try {
      await offlineDelete(`/basic/device-records/${rec.record_id}`, { source: 'device-maintenance' })
      Toast.show({ content: '已删除', icon: 'success', position: 'bottom' })
      await refreshRecords()
    } catch (e: any) {
      Toast.show({ content: e?.message || '删除失败', position: 'bottom' })
    }
  }

  // ===== 选记录进入 Step 2 =====
  const selectRecord = (rec: RecordRow) => {
    setSelectedRecord(rec)
    setActualValue(''); setResult('正常'); setContent('')
    setAbnormalDesc(''); setRemarks(''); setImages([])
    setStep(2)
  }

  // ===== 5-A 新：图片上传 =====
  const uploadImagesForRecord = async (recordId: number) => {
    if (images.length === 0) return 0
    try {
      const fd = new FormData()
      for (const item of images) {
        const file = (item as any).file
        if (file instanceof File) fd.append('images', file)
        else if (typeof file === 'string') {
          // Capacitor base64
          const blob = await (await fetch(file)).blob()
          fd.append('images', blob, 'image.jpg')
        }
      }
      const r: any = await api.post(`/basic/device-records/${recordId}/images`, fd, {
        timeout: 60000,
      })
      if (r.success) {
        Toast.show({ content: `已上传 ${fd.getAll('images').length} 张`, icon: 'success', position: 'bottom' })
        return fd.getAll('images').length
      }
      return 0
    } catch (e: any) {
      Toast.show({ content: `图片上传失败：${e?.message || ''}`, position: 'bottom' })
      return 0
    }
  }

  // ===== 5-A 新：开始/提交 =====
  const onSubmit = async () => {
    if (!selectedRecord) return
    if (result === '异常' && !abnormalDesc.trim()) {
      Toast.show({ content: '请填写异常描述', position: 'bottom' }); return
    }
    const ok = await Dialog.confirm({
      content: `确认提交 ${selectedDevice?.device_name || ''} 的保养记录？`,
      confirmText: '提交', cancelText: '取消',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      // 1) start（幂等，PC 也做 try/catch）
      try {
        await offlinePut(`/basic/device-records/${selectedRecord.record_id}/start`, {}, { source: 'device-maintenance' })
      } catch { /* 已开始 */ }
      // 2) submit
      const r: any = await offlinePut(
        `/basic/device-records/${selectedRecord.record_id}/submit`,
        {
          actual_value: actualValue, result,
          maintenance_content: content,
          abnormal_desc: result === '异常' ? abnormalDesc : '',
          remarks,
        },
        { source: 'device-maintenance' },
      )
      if (!r.success) { Toast.show({ content: r.message || '提交失败', position: 'bottom' }); return }
      // 3) 图片（必须在线直接 upload，不走 offline 队列）
      await uploadImagesForRecord(selectedRecord.record_id)

      Toast.show({
        content: r.data?.queued ? '已暂存，网络恢复后自动同步' : '提交成功',
        icon: 'success', position: 'bottom',
      })
      setStep(3)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setSelectedDevice(null); setSelectedRecord(null); setKeyword('')
    setActualValue(''); setResult('正常'); setContent('')
    setAbnormalDesc(''); setRemarks(''); setImages([])
    loadDevices()
  }

  // ===== Step 3: 完成 =====
  if (step === 3) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>保养完成</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => navigate(-1)}>返回</Button>
          <Button block color="primary" onClick={reset}>继续</Button>
        </div>
      </div>
    )
  }

  return (
    step === 0 ? (
      <div className="mobile-page-fixed-header">
        <div className="mobile-sticky-header">
          <SearchBar
            placeholder="扫设备编号 / 手输"
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}

            style={{ marginBottom: 12 }}
          />
          {/* 需求3: 扫码按钮已隐藏 */}
          {/* <Button size="mini" onClick={handleScan} style={{marginTop:8}}>扫码</Button> */}
        </div>
        <div className="mobile-page-scroll-list">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
          ) : devices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无设备<br /><span style={{ fontSize: 12 }}>请先在 PC 端创建设备档案</span>
            </div>
          ) : (
            <PullToRefresh onRefresh={async () => { await loadDevices(keyword.trim() || undefined) }}>
              <List>
                {devices.map((d) => (
                  <List.Item
                    key={d.device_id}
                    onClick={async () => {
                      // 默认先加载 "待执行"
                      const recs = await loadRecords(d, '待执行')
                      if (recs.length === 0) {
                        Toast.show({ content: '该设备暂无待执行保养', position: 'bottom' })
                        setStep(1)
                      } else if (recs.length === 1) selectRecord(recs[0])
                      else setStep(1)
                    }}
                    arrow
                    description={<div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{d.device_code}</div>}
                  >
                    <div style={{ fontWeight: 500 }}>{d.device_name}</div>
                  </List.Item>
                ))}
              </List>
            </PullToRefresh>
          )}
        </div>
      </div>
    ) : (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* ============ Step 1: 记录列表 ============ */}
      {step === 1 && selectedDevice && (
        <>
          <div style={{
            background: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
            border: '1px solid #eef0f3',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedDevice.device_name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{selectedDevice.device_code}</div>
              </div>
              <Space>
                <Button size="mini" color="primary" fill="outline" onClick={handleGenerate}>🧩 生成</Button>
                <Button size="mini" fill="outline" onClick={() => { setStep(0); setSelectedDevice(null) }}>换设备</Button>
              </Space>
            </div>
          </div>

          {/* 5-A 新增：状态 Tab（对齐 PC 端） */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '0 10px', marginBottom: 10 }}>
            <Tabs activeKey={statusTab} onChange={(k) => {
              const sk = k as StatusTab
              setStatusTab(sk); loadRecords(selectedDevice, sk)
            }}>
              {STATUS_TABS.map((t) => (
                <Tabs.Tab title={t.label} key={t.key} />
              ))}
            </Tabs>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无保养记录<br />
              <span style={{ fontSize: 12 }}>点击上方「🧩 生成」新建保养任务</span>
            </div>
          ) : (
            <PullToRefresh onRefresh={refreshRecords}>
              <List>
                {records.map((r) => {
                  const isPending = r.status === '待执行'
                  const isDoing = r.status === '进行中'
                  const badge = (() => {
                    if (isPending) return { txt: '待执行', c: '#FF9800' }
                    if (isDoing) return { txt: '进行中', c: '#2196F3' }
                    if (r.status === '已完成') return { txt: '已完成', c: '#4CAF50' }
                    if (r.status === '已跳过') return { txt: '已跳过', c: '#9E9E9E' }
                    return { txt: r.status || '', c: '#666' }
                  })()
                  return (
                    <List.Item
                      key={r.record_id}
                      description={
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                          {r.trigger_mode || ''} · {r.period_key || r.plan_date || '—'}
                        </div>
                      }
                      extra={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 11, padding: '2px 6px', borderRadius: 8,
                            background: badge.c + '22', color: badge.c,
                          }}>{badge.txt}</span>
                        </div>
                      }
                      onClick={() => {
                        // 已完成/已跳过 → 只查看，不允许进入 Step 2（或允许进入查看）
                        if (r.status === '已完成' || r.status === '已跳过') {
                          Toast.show({ content: `该记录已${r.status}`, position: 'bottom' }); return
                        }
                        selectRecord(r)
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{r.standard_name || '保养项'}</div>
                      {/* 5-A 新增：行内动作 */}
                      <div style={{ marginTop: 6, display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        {(isPending || isDoing) && (
                          <Button size="mini" color="primary" onClick={(e) => {
                            e.stopPropagation()
                            selectRecord(r)
                          }}>开始/继续</Button>
                        )}
                        {isPending && (
                          <Button size="mini" fill="outline" onClick={(e) => {
                            e.stopPropagation(); handleSkip(r)
                          }}>跳过</Button>
                        )}
                        {(isPending || isDoing) && (
                          <Button size="mini" fill="outline" onClick={(e) => {
                            e.stopPropagation(); handleDelete(r)
                          }}>删除</Button>
                        )}
                      </div>
                    </List.Item>
                  )
                })}
              </List>
            </PullToRefresh>
          )}

          <Button block fill="outline" onClick={() => setStep(0)} style={{ marginTop: 12 }}>上一步</Button>
        </>
      )}

      {/* ============ Step 2: 保养表单 ============ */}
      {step === 2 && selectedRecord && (
        <>
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, border: '1px solid #eef0f3' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {selectedRecord.standard_name || '保养项'}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selectedDevice?.device_name} · {selectedRecord.trigger_mode || ''} · {selectedRecord.period_key || selectedRecord.plan_date || '—'}
            </div>
          </div>

          <Card title="实测值（可选）">
            <TextArea value={actualValue} onChange={setActualValue} rows={2}
              placeholder="如：压力 0.4MPa" style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
          </Card>

          <Card title="保养内容">
            <TextArea value={content} onChange={setContent} rows={3}
              placeholder="保养作业内容、更换备件、清洁润滑等"
              style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
          </Card>

          <Card title="执行结果">
            <div style={{ display: 'flex', gap: 20 }}>
<Radio.Group value={result} onChange={(v) => setResult(v as any)}>

              <Radio value="正常">正常</Radio>
              <Radio value="异常">异常</Radio>
            </Radio.Group>            </div>

            {result === '异常' && (
              <div style={{ marginTop: 10 }}>
                <TextArea value={abnormalDesc} onChange={setAbnormalDesc} rows={2}
                  placeholder="请描述异常情况"
                  style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
              </div>
            )}
          </Card>

          <Card title="备注（可选）">
            <TextArea value={remarks} onChange={setRemarks} rows={2}
              placeholder="备注" style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
          </Card>

          {/* 5-A 新增：图片上传 */}
          <Card title="现场照片（可选）">
            <ImageUploader
              value={images}
              onChange={setImages}
              upload={async (file) => ({ url: URL.createObjectURL(file) })}
              maxCount={6}
            />
            <input type="file" multiple accept="image/*" hidden ref={fileInputRef} />
          </Card>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <Button block fill="outline" onClick={() => setStep(1)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={onSubmit}>提交保养</Button>
          </div>
        </>
      )}
    </div>
    )
  )
}

// ========== 小工具 ==========

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 14,
      border: '1px solid #eef0f3', marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
