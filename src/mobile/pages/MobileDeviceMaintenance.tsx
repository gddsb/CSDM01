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
  Button, List, SearchBar, Toast, Dialog, TextArea, Radio, PullToRefresh, Tabs, Space,
} from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import api from '../../utils/api'
import { offlinePost, offlinePut, offlineDelete } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'
import { MobileImageUploader } from '../components/MobileImageUploader'
import { registerBackHandler } from '../utils/backInterceptor'

function getCurrentUsername(): string {
  try {
    const raw = localStorage.getItem('mes_user')
    if (!raw) return ''
    return JSON.parse(raw)?.username || ''
  } catch { return '' }
}

interface DeviceRow { device_id: number; device_code?: string; device_name?: string }

/** 保养标准详情（后端 DeviceMaintenanceStandard Sequelize 模型） */
interface MaintenanceStandard {
  standard_id?: number
  item_name?: string          // 保养项名称
  mechanism?: string          // 机构
  component?: string          // 部件
  location?: string           // 部位
  maintenance_method?: string // 保养方法
  maintenance_content?: string // 保养内容
  judge_type?: string         // 判定类型（定性/定量）
  standard_value?: string     // 判定基准
  unit?: string
}

interface RecordRow {
  record_id: number; device_id?: number; device_code?: string; device_name?: string
  status?: string; plan_date?: string; period_key?: string; trigger_mode?: string
  standard_name?: string; standard_id?: number; maintenance_images?: any[]
  actual_value?: string; result?: string; abnormal_desc?: string
  maintenance_content?: string; remarks?: string
  standard?: MaintenanceStandard | null  // 后端 JOIN DeviceMaintenanceStandard 返回
}

/** 维保类型 Tab → trigger_mode 过滤值 */
const TRIGGER_MODES = {
  '日点检': 'daily',
  '周保养': 'weekly',
  '月保养': 'monthly',
}

type Step = 0 | 1 | 2 | 3
type StatusTab = 'all' | '待执行' | '进行中' | '已完成' | '已跳过'

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '待执行', label: '待执行' },
  { key: '进行中', label: '进行中' },
  { key: '已完成', label: '已完成' },
]

// ========== 5-A 主组件 ==========

export default function MobileDeviceMaintenance() {
  const navigate = useNavigate()
  const { scan } = useBarcode()

  const [step, setStep] = useState<Step>(0)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [typeTab, setTypeTab] = useState<'日点检' | '周保养' | '月保养'>('日点检')
  const [statusTab, setStatusTab] = useState<StatusTab>('待执行')

  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const recordsRef = useRef<RecordRow[]>([])
  useEffect(() => { recordsRef.current = records }, [records])
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** 每个 trigger_mode Tab 的 {total, done} 计数 */
  const [tabCounts, setTabCounts] = useState<Record<string, { total: number; done: number }>>({})

  // 保养表单
  const [actualValue, setActualValue] = useState('')
  const [result, setResult] = useState<'正常' | '异常'>('正常')
  const [content, setContent] = useState('')
  const [abnormalDesc, setAbnormalDesc] = useState('')
  const [remarks, setRemarks] = useState('')
  const [images, setImages] = useState<string[]>([])

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

  // ===== NavBar 返回拦截：SPA step 状态机逐级降级 =====
  useEffect(() => {
    const unregister = registerBackHandler(() => {
      if (step === 3) { setStep(1); setSelectedRecord(null); return true }
      if (step === 2) { setStep(1); setSelectedRecord(null); return true }
      if (step === 1) { setStep(0); setSelectedDevice(null); return true }
      return false
    })
    return unregister
  }, [step])

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
        trigger_mode: TRIGGER_MODES[typeTab],
        period_key: buildPeriodKey(typeTab),
      }
      const s = (status || statusTab)
      if (s !== 'all') params.status = s
      const r: any = await api.get('/basic/device-records', { params })
      const list: RecordRow[] = r.success ? (r.data?.list || r.data || []) : []
      setRecords(list)
      loadTabCounts(device)  // 每次切 device/Tab 顺便刷新计数
      return list
    } catch { setRecords([]); return [] } finally { setLoading(false) }
  }

  const refreshRecords = async () => {
    if (selectedDevice) {
      await loadRecords(selectedDevice, statusTab)
      loadTabCounts(selectedDevice)
    }
  }

  // ===== 每个 Tab 的完成数/总数（额外请求一次全量不加 status 过滤）=====
  const loadTabCounts = async (device: DeviceRow) => {
    const MODES: Record<string, string> = { '日点检': 'daily', '周保养': 'weekly', '月保养': 'monthly' }
    const result: Record<string, { total: number; done: number }> = {}
    for (const [label, mode] of Object.entries(MODES)) {
      try {
        const r: any = await api.get('/basic/device-records', {
          params: {
            page: 1, pageSize: 1000, device_id: device.device_id,
            trigger_mode: mode,
            period_key: buildPeriodKey(label),
          },
        })
        const list: any[] = r.success ? (r.data?.list || r.data || []) : []
        const total = list.length
        const done = list.filter((x) => x.status === '已完成' || x.status === '已跳过').length
        result[label] = { total, done }
      } catch {
        result[label] = { total: 0, done: 0 }
      }
    }
    setTabCounts(result)
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
  const handleGenerate = () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const currentYm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const nextYm = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01`
      : `${now.getFullYear()}-${pad(now.getMonth() + 2)}`

    // Step 1 → 选月份（纯回调，Dialog.show 不返回 Promise）
    Dialog.show({ closeOnAction: true, closeOnMaskClick: true,
      content: '请选择生成月份',
      actions: [
        { key: 'current', text: `本月 ${currentYm}（跳过已过去日期）` },
        { key: 'next', text: `下月 ${nextYm}` },
        { key: 'cancel', text: '取消' },
      ],
      onAction: (action) => {
        if (action.key === 'cancel') return
        const target_month = action.key === 'current' ? currentYm : nextYm
        const skip_past = action.key === 'current'
        showDevicePicker(target_month, skip_past)
      },
    })
  }

  /** Step 2 → 选设备范围 */
  const showDevicePicker = (target_month: string, skip_past: boolean) => {
    const deviceActions = [
      { key: 'all', text: '所有生效设备' },
    ]
    if (selectedDevice) {
      deviceActions.push({ key: 'single', text: `仅当前设备 (${selectedDevice.device_name})` })
    }
    deviceActions.push({ key: 'cancel', text: '取消' })

    Dialog.show({ closeOnAction: true, closeOnMaskClick: true,
      content: selectedDevice
        ? '为「哪些设备」生成？'
        : '为哪些设备生成？',
      actions: deviceActions,
      onAction: async (action) => {
        if (action.key === 'cancel') return
        const payload: any = { target_month, skip_past }
        if (selectedDevice && action.key === 'single') {
          payload.device_id = selectedDevice.device_id
        }
        try {
          const r: any = await offlinePost('/basic/device-records/generate', payload, { source: 'device-maintenance' })
          const msg = r.message || (r.data?.created != null
            ? `成功生成 ${r.data.created} 条${r.data.skipped ? `，跳过 ${r.data.skipped} 条已存在` : ''}`
            : '生成成功')
          Toast.show({ content: msg, icon: 'success', position: 'bottom' })
          await refreshRecords()
        } catch (e: any) {
          Toast.show({ content: e?.message || '生成失败', position: 'bottom' })
        }
      },
    })
  }

  // ===== 选记录进入 Step 2 =====
  const selectRecord = (rec: RecordRow) => {
    setSelectedRecord(rec)
    setActualValue(rec.actual_value || '')
    setResult((rec.result as '正常' | '异常') || '正常')
    setContent(rec.maintenance_content || '')
    setAbnormalDesc(rec.abnormal_desc || '')
    setRemarks(rec.remarks || '')
    setImages([])  // 先清，loadRecords 不 include 图片表，必须单独拉
    setStep(2)
    loadRecordImages(rec.record_id)
  }

  /** 单独拉取保养记录的图片（listRecords 不 include DeviceImage） */
  const loadRecordImages = async (recordId: number) => {
    try {
      const r: any = await api.get(`/basic/device-records/${recordId}/images`)
      const list: any[] = Array.isArray(r?.data) ? r.data : []
      const urls = list
        .map((x: any) => (typeof x === 'string') ? x : (x?.file_path || x?.path || x?.url || ''))
        .filter(Boolean)
      setImages(urls)
    } catch { /* 无图片或接口错 → 保持空数组，不阻断 */ }
  }

  // ===== 5-A 新：图片上传 =====

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
      Toast.show({
        content: '提交成功',
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

  /** Step3 继续跳下一条待执行 — 保持当前设备 + typeTab */
  const goNextPending = async () => {
    if (!selectedDevice) { reset(); return }
    setLoading(true)
    try {
      // 切回 typeTab 对应的待执行状态查下一条
      setStatusTab('待执行')
      const list = await loadRecords(selectedDevice, '待执行')
      if (list && list.length > 0) {
        selectRecord(list[0])
      } else {
        Toast.show({ content: '当前没有更多待执行保养', icon: 'success', position: 'bottom' })
        setStep(1)
      }
    } finally { setLoading(false) }
  }

  // ===== Step 3: 完成 =====
  if (step === 3) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>保养完成</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => { setStep(1); setSelectedRecord(null) }}>返回列表</Button>
          <Button block color="primary" loading={loading} onClick={goNextPending}>继续下一条</Button>
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
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>加载中...</div>
          ) : devices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>
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
                    description={<div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 4 }}>{d.device_code}</div>}
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
    <div className="mobile-page mobile-page-scrollable" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* ============ Step 1: 记录列表 ============ */}
      {step === 1 && selectedDevice && (
        <>
          <div style={{
            background: 'var(--m-surface)', borderRadius: 10, padding: 12, marginBottom: 10,
            border: '1px solid var(--m-border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedDevice.device_name}</div>
                <div style={{ fontSize: 12, color: 'var(--m-text-3)' }}>{selectedDevice.device_code}</div>
              </div>
              <Space>
                <Button size="mini" color="primary" fill="outline" onClick={handleGenerate}>🧩 生成</Button>
                <Button size="mini" fill="outline" onClick={() => { setStep(0); setSelectedDevice(null) }}>换设备</Button>
              </Space>
            </div>
          </div>

          {/* 维保类型 Tab：日点检 / 周保养 / 月保养 */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: '0 10px', marginBottom: 10 }}>
            <Tabs activeKey={typeTab} onChange={(k) => {
              setTypeTab(k as '日点检' | '周保养' | '月保养')
              setStatusTab('all')
              loadRecords(selectedDevice, 'all')
            }}>
              {(['日点检', '周保养', '月保养'] as const).map((label) => {
                const c = tabCounts[label] || { total: 0, done: 0 }
                return (
                  <Tabs.Tab
                    key={label}
                    title={
                      <span style={{ display: 'inline-block', textAlign: 'center' }}>
                        {label === '日点检' ? '🔍' : label === '周保养' ? '🛠️' : '⚙️'} {label}
                        <div style={{ fontSize: 10, color: 'var(--m-text-3)', lineHeight: 1.2, marginTop: 1 }}>
                          {c.done}/{c.total}
                        </div>
                      </span>
                    }
                  />
                )
              })}
            </Tabs>
          </div>

          {/* 5-A 新增：状态 Tab（对齐 PC 端） */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: '0 10px', marginBottom: 10 }}>
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
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>加载中...</div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>
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
                    if (isPending) return { txt: '待执行', c: 'var(--brand-color-warning)' }
                    if (isDoing) return { txt: '进行中', c: 'var(--brand-color)' }
                    if (r.status === '已完成') return { txt: '已完成', c: 'var(--brand-color-success)' }
                    
                    return { txt: r.status || '', c: 'var(--m-text-2)' }
                  })()
                  return (
                    <List.Item
                      key={r.record_id}
    
                      extra={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 11, padding: '2px 6px', borderRadius: 8,
                            background: badge.c + '22', color: badge.c,
                          }}>{badge.txt}</span>
                        </div>
                      }
                      onClick={() => { selectRecord(r) }}
                    >
                      <div style={{ fontWeight: 500 }}>
                        {r.standard?.maintenance_method || r.standard?.maintenance_content?.slice?.(0, 20) || '保养项'}
                      </div>
                      {/* 5-A 新增：行内动作 */}
                      <div style={{ marginTop: 6, display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        {(isPending || isDoing) && (
                          <Button size="mini" color="primary" onClick={(e) => {
                            e.stopPropagation()
                            selectRecord(r)
                          }}>开始/继续</Button>
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

      {/* ============ Step 2: 保养/点检执行表单 ============ */}
      {step === 2 && selectedRecord && (
        <div style={{ paddingBottom: 24 }}>
          {(() => {
            const isReadonly = selectedRecord.status === '已完成'
            if (isReadonly) {
              return (
                <div style={{
                  background: 'var(--brand-color-success)', color: '#fff',
                  padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
                }}>
                  ✅ 本保养项已完成，以下为执行记录（只读）
                </div>
              )
            }
            return null
          })()}
          {/* 保养项标题 + 设备信息 */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, marginBottom: 12, border: '1px solid var(--m-border)' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {selectedRecord.standard?.maintenance_method || selectedRecord.standard?.maintenance_content?.slice?.(0, 20) || '保养项'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 4 }}>
              {selectedDevice?.device_name} · {selectedRecord.trigger_mode || ''} · {selectedRecord.period_key || selectedRecord.plan_date || '—'}
            </div>
          </div>

          {/* 保养标准详情（只读，来自后端 JOIN DeviceMaintenanceStandard） */}
          {(() => {
            const s = selectedRecord.standard
            if (!s) return null
            const rows: Array<[string, string | undefined]> = [
              ['机构', s.mechanism],
              ['部件', s.component],
              ['部位', s.location],
              ['保养方法', s.maintenance_method],
              ['保养内容', s.maintenance_content],
              ['判定类型', s.judge_type],
              ['判定基准', s.standard_value ? `${s.standard_value}${s.unit || ''}` : undefined],
            ]
            const visible = rows.filter(([, v]) => v && v.trim())
            if (visible.length === 0) return null
            return (
              <Card title="保养标准">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {visible.map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', fontSize: 13 }}>
                      <span style={{ color: 'var(--m-text-3)', width: 80, flexShrink: 0 }}>{k}</span>
                      <span style={{ color: 'var(--m-text-2)', flex: 1 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })()}

          {/* 定量型才显示实测值 Card */}
          {selectedRecord.standard?.judge_type === '定量' && (
            <Card title={`实测值（标准：${selectedRecord.standard?.standard_value || '—'}${selectedRecord.standard?.unit || ''}）`}>
              {selectedRecord.status === '已完成'
                ? <div style={{ fontSize: 13, color: 'var(--m-text-2)' }}>{actualValue || selectedRecord.actual_value || '—'}</div>
                : <TextArea value={actualValue} onChange={(v) => { setActualValue(v); setResult(autoJudge(v, selectedRecord.standard?.standard_value || '')) }} rows={2}
                    placeholder="请输入实测数值" style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
              }
            </Card>
          )}

          <Card title="执行结果">
            {selectedRecord.status === '已完成'
              ? <span style={{
                  fontSize: 13, padding: '4px 10px', borderRadius: 6,
                  background: result === '正常' ? 'var(--brand-color-success, #4CAF50)' : 'var(--brand-color-danger, #F44336)',
                  color: '#fff',
                }}>{result}</span>
              : (selectedRecord.standard?.judge_type === '定量'
                  ? <>
                      <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 8 }}>系统根据实测值自动判定：</div>
                      <span style={{
                        fontSize: 14, padding: '6px 14px', borderRadius: 6, fontWeight: 600,
                        background: result === '正常' ? 'var(--brand-color-success, #4CAF50)' : 'var(--brand-color-danger, #F44336)',
                        color: '#fff',
                      }}>{result}</span>
                      {actualValue && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--m-text-3)' }}>输入 {actualValue} → 标准 {selectedRecord.standard?.standard_value || '—'}</div>}
                    </>
                  : <Radio.Group value={result} onChange={(v) => setResult(v as any)}>
                      <Radio value="正常">正常</Radio>
                      <Radio value="异常">异常</Radio>
                    </Radio.Group>
                )
            }
            {result === '异常' && selectedRecord.status !== '已完成' && (
              <div style={{ marginTop: 10 }}>
                <TextArea value={abnormalDesc} onChange={setAbnormalDesc} rows={2}
                  placeholder="请描述异常情况"
                  style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
              </div>
            )}
          </Card>

          <Card title="备注（可选）">
            {selectedRecord.status === '已完成'
              ? <div style={{ fontSize: 13, color: 'var(--m-text-2)', whiteSpace: 'pre-wrap' }}>{remarks || selectedRecord.remarks || '—'}</div>
              : <TextArea value={remarks} onChange={setRemarks} rows={2}
                  placeholder="备注" style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
            }
          </Card>

          {/* 5-A 新增：图片上传（拍照 + 相册双通道） */}
          <Card title="现场照片（可选）">
            <MobileImageUploader
              uploadUrl={selectedRecord.status === '已完成' ? undefined : () => `/basic/device-records/${selectedRecord.record_id}/images`}
              deleteUrl={selectedRecord.status === '已完成' ? undefined : (rawUrl) => `/basic/device-records/${selectedRecord.record_id}/images?path=${encodeURIComponent(rawUrl)}`}
              value={images}
              onChange={setImages}
              maxCount={selectedRecord.status === '已完成' ? 0 : 6}
              watermark={{ username: getCurrentUsername(), timestamp: true }}
            />
          </Card>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            {selectedRecord.status === '已完成'
              ? <Button block color="primary" onClick={() => { setStep(1); setSelectedRecord(null) }}>返回列表</Button>
              : <>
                  <Button block fill="outline" onClick={() => setStep(1)}>上一步</Button>
                  <Button block color="primary" loading={submitting} onClick={onSubmit}>提交保养</Button>
                </>
            }
          </div>
        </div>
      )}
    </div>
    )
  )
}

// ========== 小工具 ==========

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div style={{
      background: 'var(--m-surface)', borderRadius: 10, padding: 14,
      border: '1px solid var(--m-border)', marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 8 }}>{title}</div>
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

/** 后端 maintenance_images → URL 数组（兼容 string[] / {file_path,...}[] 两种形态） */
function extractImageUrls(raw: any): string[] {
  if (!raw) return []
  if (!Array.isArray(raw)) return []
  return raw
    .map((x: any) => {
      if (typeof x === 'string') return x
      return x?.file_path || x?.path || x?.url || x?.src || ''
    })
    .filter(Boolean)
}

/** 维保类型 Tab → 当前时间的 period_key（日=YYYY-MM-DD / 周=YYYY-Www / 月=YYYY-MM） */
function buildPeriodKey(typeTab: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (typeTab === '日点检') {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }
  if (typeTab === '周保养') {
    // ISO 周号：周一为每周第一天
    const tmp = new Date(now)
    tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7))
    const yearStart = new Date(tmp.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${tmp.getFullYear()}-W${pad(weekNum)}`
  }
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

/** 定量型：实测值 → 自动判定（区间/上下限/单点±10%） */
function autoJudge(actual: string, standard: string): '正常' | '异常' {
  const actualNum = parseFloat(actual)
  if (!actual || isNaN(actualNum)) return '正常'
  const std = standard || ''
  const range = std.match(/([\d.]+)\s*[~～\-—至到]\s*([\d.]+)/)
  if (range) { const lo = parseFloat(range[1]); const hi = parseFloat(range[2]); return (actualNum < lo || actualNum > hi) ? '异常' : '正常' }
  const ge = std.match(/[≥>=]\s*([\d.]+)/)
  if (ge) { const lo = parseFloat(ge[1]); return actualNum < lo ? '异常' : '正常' }
  const le = std.match(/[≤<=<]\s*([\d.]+)/)
  if (le) { const hi = parseFloat(le[1]); return actualNum > hi ? '异常' : '正常' }
  const single = std.match(/([\d.]+)/)
  if (single) { const target = parseFloat(single[1]); return (actualNum < target * 0.9 || actualNum > target * 1.1) ? '异常' : '正常' }
  return '正常'
}
