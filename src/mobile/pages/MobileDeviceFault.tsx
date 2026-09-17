/**
 * 设备故障工单 — 完整 5 状态机（Phase 5-B）
 *
 * 对齐 PC DeviceFault.tsx 的写动作：
 *   ✅ 新建   POST /basic/device-faults               (fault_level/fault_desc/fault_time/impact_desc)
 *   ✅ 派单   PUT  /basic/device-faults/:id/assign    (repair_person_id/name/assign_note)
 *   ✅ 维修   PUT  /basic/device-faults/:id/repair    (fault_cause/repair_solution/repair_hours/parts_cost/labor_cost)
 *   ✅ 验收   PUT  /basic/device-faults/:id/approve   (approve_result/approve_opinion)
 *   ✅ 关闭   PUT  /basic/device-faults/:id/close     (close_remark)
 *   ✅ 图片   POST/GET /basic/device-faults/:id/images (multipart images)
 *
 * 状态机（与 PC 对齐）：
 *   待派工 → 维修中 → 待审批 → 已挂起/已关闭
 *          └─ 已关闭（直接关闭）
 */
import { useEffect, useState } from 'react'
import {
  Button, List, SearchBar, Toast, Dialog, TextArea, Radio, Tabs,
  PullToRefresh, ImageUploader, Input, Space,
} from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import api from '../../utils/api'
import { offlinePost, offlinePut } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'

type FaultStatus = '待派工' | '维修中' | '待审批' | '已挂起' | '已关闭'
type StatusTab = 'all' | FaultStatus

interface FaultDevice { device_id: number; device_code?: string; device_name?: string }
interface UserRow { user_id: number; real_name?: string; username?: string }

interface FaultRow {
  fault_id: number; fault_no?: string; device_id?: number; device_name?: string
  device_code?: string; fault_level: string; fault_desc?: string
  fault_time?: string; impact_desc?: string; reporter_name?: string
  repair_person_id?: number; repair_person_name?: string
  status: string; fault_cause?: string; repair_solution?: string
  approve_result?: string; approve_opinion?: string; close_remark?: string
  fault_images?: any[]
}

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '待派工', label: '待派工' },
  { key: '维修中', label: '维修中' },
  { key: '待审批', label: '待审批' },
  { key: '已挂起', label: '已挂起' },
  { key: '已关闭', label: '已关闭' },
]

const LEVELS = ['一般', '严重', '紧急'] as const

// ========== 5-B 主组件 ==========

export default function MobileDeviceFault() {
  const { scan } = useBarcode()
  const [tab, setTab] = useState<StatusTab>('待派工')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [faults, setFaults] = useState<FaultRow[]>([])
  const [devices, setDevices] = useState<FaultDevice[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [selected, setSelected] = useState<FaultRow | null>(null)

  // 各抽屉表单
  const [showCreate, setShowCreate] = useState(false)
  const [createDeviceId, setCreateDeviceId] = useState<number | null>(null)
  const [createDeviceName, setCreateDeviceName] = useState('')
  const [createLevel, setCreateLevel] = useState<string>('一般')
  const [createDesc, setCreateDesc] = useState('')
  const [createImpact, setCreateImpact] = useState('')
  const [createImages, setCreateImages] = useState<ImageUploadItem[]>([])

  const [assignUserId, setAssignUserId] = useState<number | null>(null)
  const [assignNote, setAssignNote] = useState('')

  const [repairCause, setRepairCause] = useState('')
  const [repairSolution, setRepairSolution] = useState('')
  const [repairHours, setRepairHours] = useState('')
  const [partsCost, setPartsCost] = useState('')
  const [laborCost, setLaborCost] = useState('')

  const [approveResult, setApproveResult] = useState<'通过' | '驳回'>('通过')
  const [approveOpinion, setApproveOpinion] = useState('')
  const [closeRemark, setCloseRemark] = useState('')

  // ===== 拉取设备/用户（用于新建/派单）=====
  useEffect(() => {
    api.get('/basic/devices', { params: { page: 1, page_size: 500 } }).then((r: any) => {
      const list: FaultDevice[] = r.success ? (r.data?.list || r.data || []) : []
      setDevices(list)
    }).catch(() => {})
    api.get('/system/users', { params: { page: 1, page_size: 200 } }).then((r: any) => {
      const list: UserRow[] = r.success ? (r.data?.list || r.data || []) : []
      setUsers(list)
    }).catch(() => {})
  }, [])

  // ===== 拉取故障列表 =====
  const loadFaults = async (status?: StatusTab, kw?: string) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 50 }
      const s = (status || tab)
      if (s !== 'all') params.status = s
      if (kw) params.fault_no = kw
      const r: any = await api.get('/basic/device-faults', { params })
      const list: FaultRow[] = r.success ? (r.data?.list || r.data || []) : []
      setFaults(list)
    } catch { setFaults([]) } finally { setLoading(false) }
  }
  useEffect(() => { loadFaults(tab) }, [tab])

  // ===== 图片 upload helper =====
  const uploadImages = async (faultId: number, imgs: ImageUploadItem[]) => {
    if (imgs.length === 0) return
    try {
      const fd = new FormData()
      for (const item of imgs) {
        const file = (item as any).file
        if (file instanceof File) fd.append('images', file)
        else if (typeof file === 'string') {
          const blob = await (await fetch(file)).blob()
          fd.append('images', blob, 'image.jpg')
        }
      }
      await api.post(`/basic/device-faults/${faultId}/images`, fd, { timeout: 60000 })
    } catch { /* 图片失败不阻塞主流程 */ }
  }

  // ===== 5-B 新建故障 =====
  const onCreateSubmit = async () => {
    if (!createDeviceId) { Toast.show({ content: '请选择故障设备', position: 'bottom' }); return }
    if (!createDesc.trim()) { Toast.show({ content: '请描述故障现象', position: 'bottom' }); return }
    try {
      const r: any = await offlinePost('/basic/device-faults', {
        device_id: createDeviceId,
        device_name: createDeviceName || devices.find((d) => d.device_id === createDeviceId)?.device_name,
        device_code: devices.find((d) => d.device_id === createDeviceId)?.device_code,
        fault_level: createLevel,
        fault_desc: createDesc,
        fault_time: new Date().toISOString(),
        impact_desc: createImpact,
      }, { source: 'device-fault' })
      const faultId = r.data?.fault_id || r.data?.id
      if (faultId && createImages.length > 0) await uploadImages(faultId, createImages)

      Toast.show({
        content: r.data?.queued ? '已暂存，恢复网络后自动同步' : (r.message || '上报成功'),
        icon: 'success', position: 'bottom',
      })
      // reset
      setShowCreate(false); setCreateDeviceId(null); setCreateDeviceName('')
      setCreateDesc(''); setCreateImpact(''); setCreateLevel('一般'); setCreateImages([])
      await loadFaults(tab)
    } catch (e: any) { Toast.show({ content: e?.message || '上报失败', position: 'bottom' }) }
  }

  // ===== 5-B 扫码定位设备 =====
  const handleScanForCreate = async () => {
    const r = await scan(); if (!r) return
    const match = devices.find((d) => d.device_code === r.code)
    if (!match) { Toast.show({ content: '未找到设备', position: 'bottom' }); return }
    setCreateDeviceId(match.device_id)
    setCreateDeviceName(match.device_name || '')
  }

  // ===== 5-B 派单 =====
  const onAssign = async () => {
    if (!selected) return
    if (!assignUserId) { Toast.show({ content: '请选择维修人员', position: 'bottom' }); return }
    const user = users.find((u) => u.user_id === assignUserId)
    try {
      const r: any = await offlinePut(`/basic/device-faults/${selected.fault_id}/assign`, {
        repair_person_id: assignUserId,
        repair_person_name: user?.real_name || user?.username,
        assign_note: assignNote,
      }, { source: 'device-fault' })
      Toast.show({ content: r.message || '派单成功', icon: 'success', position: 'bottom' })
      setSelected(null); setAssignUserId(null); setAssignNote('')
      await loadFaults(tab)
    } catch (e: any) { Toast.show({ content: e?.message || '派单失败', position: 'bottom' }) }
  }

  // ===== 5-B 维修 =====
  const onRepair = async () => {
    if (!selected) return
    const ok = await Dialog.confirm({ content: '确认提交维修记录？', confirmText: '提交', cancelText: '取消' })
    if (!ok) return
    try {
      const r: any = await offlinePut(`/basic/device-faults/${selected.fault_id}/repair`, {
        fault_cause: repairCause,
        repair_solution: repairSolution,
        repair_hours: repairHours ? Number(repairHours) : undefined,
        parts_cost: partsCost ? Number(partsCost) : undefined,
        labor_cost: laborCost ? Number(laborCost) : undefined,
      }, { source: 'device-fault' })
      Toast.show({ content: r.message || '维修记录已提交', icon: 'success', position: 'bottom' })
      setSelected(null); setRepairCause(''); setRepairSolution('')
      setRepairHours(''); setPartsCost(''); setLaborCost('')
      await loadFaults(tab)
    } catch (e: any) { Toast.show({ content: e?.message || '提交失败', position: 'bottom' }) }
  }

  // ===== 5-B 验收 =====
  const onApprove = async () => {
    if (!selected) return
    const ok = await Dialog.confirm({ content: `验收结果：${approveResult}？`, confirmText: '确认', cancelText: '取消' })
    if (!ok) return
    try {
      const r: any = await offlinePut(`/basic/device-faults/${selected.fault_id}/approve`, {
        approve_result: approveResult,
        approve_opinion: approveOpinion,
      }, { source: 'device-fault' })
      Toast.show({ content: r.message || `已${approveResult === '通过' ? '通过' : '驳回'}`, icon: 'success', position: 'bottom' })
      setSelected(null); setApproveOpinion('')
      await loadFaults(tab)
    } catch (e: any) { Toast.show({ content: e?.message || '操作失败', position: 'bottom' }) }
  }

  // ===== 5-B 关闭 =====
  const onClose = async () => {
    if (!selected) return
    const ok = await Dialog.confirm({ content: '确认关闭此故障单？', confirmText: '关闭', cancelText: '取消' })
    if (!ok) return
    try {
      const r: any = await offlinePut(`/basic/device-faults/${selected.fault_id}/close`, {
        close_remark: closeRemark || '故障关闭',
      }, { source: 'device-fault' })
      Toast.show({ content: r.message || '已关闭', icon: 'success', position: 'bottom' })
      setSelected(null); setCloseRemark('')
      await loadFaults(tab)
    } catch (e: any) { Toast.show({ content: e?.message || '操作失败', position: 'bottom' }) }
  }

  // ===== 顶部统计 =====
  const stats = {
    pending: faults.filter((f) => f.status === '待派工').length,
    repairing: faults.filter((f) => f.status === '维修中').length,
    approving: faults.filter((f) => f.status === '待审批').length,
    urgent: faults.filter((f) => f.fault_level === '紧急').length,
  }

  // ===== 渲染 =====
  return (
    <div className="mobile-page-fixed-header">
      <div className="mobile-sticky-header">
        {/* 顶部统计卡 */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 12, padding: '10px 12px',
          background: 'linear-gradient(135deg,#2196F3 0%,#1565C0 100%)',
          borderRadius: 12, color: '#fff',
        }}>
          <Stat label="待派工" v={stats.pending} />
          <Stat label="维修中" v={stats.repairing} />
          <Stat label="待审批" v={stats.approving} />
          <Stat label="紧急" v={stats.urgent} red />
        </div>

        {/* 搜索 + 上报 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <SearchBar placeholder="故障单号 / 设备" value={keyword} onChange={setKeyword}
              onSearch={() => loadFaults(tab, keyword.trim())} />
          </div>
          <Button color="primary" onClick={() => setShowCreate(true)} style={{ height: 40, marginTop: 2 }}>
            + 上报
          </Button>
        </div>

        {/* 状态 Tab（对齐 PC） */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '0 8px', marginBottom: 10 }}>
          <Tabs activeKey={tab} onChange={(k) => setTab(k as StatusTab)}>
            {STATUS_TABS.map((t) => <Tabs.Tab title={t.label} key={t.key} />)}
          </Tabs>
        </div>
      </div>

      <div className="mobile-page-scroll-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
        ) : faults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无故障记录</div>
        ) : (
          <PullToRefresh onRefresh={() => loadFaults(tab, keyword.trim())}>
            <List>
              {faults.map((f) => <FaultCard key={f.fault_id} fault={f} onOpen={() => setSelected(f)} />)}
            </List>
          </PullToRefresh>
        )}
      </div>

      {/* ======= 新建抽屉 ======= */}
      {showCreate && (
        <Dialog visible content={
          <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '10px 6px' }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>上报故障</div>
            <div style={{ marginBottom: 8 }}>
              {/* 需求3: 扫码按钮已隐藏 */}
              {/* <Button size="mini" fill="outline" onClick={handleScanForCreate} style={{ marginRight: 8 }}>扫设备</Button> */}
              <select value={createDeviceId || ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null
                  setCreateDeviceId(id)
                  if (id) {
                    const d = devices.find((x) => x.device_id === id)
                    setCreateDeviceName(d?.device_name || '')
                  }
                }}
                style={{ padding: 6, borderRadius: 6, border: '1px solid #ddd', width: '100%' }}>
                <option value="">选择故障设备</option>
                {devices.map((d) => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.device_name} ({d.device_code})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>故障等级</div>
            <div style={{ display: 'flex', gap: 16 }}>
<Radio.Group value={createLevel} onChange={(v) => setCreateLevel(v as string)}>

              {LEVELS.map((l) => <Radio key={l} value={l}>{l}</Radio>)}
            </Radio.Group>            </div>

            <div style={{ fontSize: 12, color: '#666', margin: '8px 0 4px' }}>故障描述 *</div>
            <TextArea value={createDesc} onChange={setCreateDesc} rows={3}
              placeholder="详细描述故障现象" style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
            <div style={{ fontSize: 12, color: '#666', margin: '8px 0 4px' }}>影响范围（可选）</div>
            <TextArea value={createImpact} onChange={setCreateImpact} rows={2}
              placeholder="影响的产线/批次/人员" style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
            <div style={{ fontSize: 12, color: '#666', margin: '8px 0 4px' }}>故障现场照片（可选）</div>
            <ImageUploader value={createImages} onChange={setCreateImages}
              upload={async (f) => ({ url: URL.createObjectURL(f) })} maxCount={6} />
          </div>
        }
          actions={[
            { key: 'cancel', text: '取消', onClick: () => setShowCreate(false) },
            { key: 'ok', text: '上报', bold: true, onClick: onCreateSubmit },
          ]}
        />
      )}

      {/* ======= 故障详情抽屉 ======= */}
      {selected && (
        <Dialog visible content={<FaultDetail
          fault={selected}
          users={users}
          assignUserId={assignUserId} setAssignUserId={setAssignUserId}
          assignNote={assignNote} setAssignNote={setAssignNote}
          repairCause={repairCause} setRepairCause={setRepairCause}
          repairSolution={repairSolution} setRepairSolution={setRepairSolution}
          repairHours={repairHours} setRepairHours={setRepairHours}
          partsCost={partsCost} setPartsCost={setPartsCost}
          laborCost={laborCost} setLaborCost={setLaborCost}
          approveResult={approveResult} setApproveResult={setApproveResult}
          approveOpinion={approveOpinion} setApproveOpinion={setApproveOpinion}
          closeRemark={closeRemark} setCloseRemark={setCloseRemark}
          onAssign={onAssign} onRepair={onRepair} onApprove={onApprove} onClose={onClose}
        />}
          actions={[{ key: 'close', text: '关闭详情', onClick: () => setSelected(null) }]}
        />
      )}
    </div>
  )
}

// ========== 子组件 ==========

function Stat({ label, v, red }: { label: string; v: number; red?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: red ? '#FFCDD2' : '#fff' }}>{v}</div>
      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function FaultCard({ fault, onOpen }: { fault: FaultRow; onOpen: () => void }) {
  const levelColor = fault.fault_level === '紧急' ? '#F44336'
    : fault.fault_level === '严重' ? '#FF9800' : '#2196F3'
  const statusColor = fault.status === '待派工' ? '#FF9800'
    : fault.status === '维修中' ? '#2196F3'
    : fault.status === '待审批' ? '#9C27B0'
    : fault.status === '已挂起' ? '#FF5722'
    : '#9E9E9E'
  return (
    <div onClick={onOpen} style={{
      background: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
      border: '1px solid #eef0f3', cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{fault.fault_no || `#${fault.fault_id}`}</div>
        <Space>
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: levelColor + '22', color: levelColor }}>
            {fault.fault_level}
          </span>
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: statusColor + '22', color: statusColor }}>
            {fault.status}
          </span>
        </Space>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
        📍 {fault.device_name} ({fault.device_code})
      </div>
      {fault.fault_desc && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {fault.fault_desc}
        </div>
      )}
      {(fault.repair_person_name || fault.fault_time) && (
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 6, display: 'flex', gap: 10 }}>
          {fault.repair_person_name && <span>👷 {fault.repair_person_name}</span>}
          {fault.fault_time && <span>⏰ {String(fault.fault_time).slice(0, 16)}</span>}
        </div>
      )}
    </div>
  )
}

interface FaultDetailProps {
  fault: FaultRow; users: UserRow[]
  assignUserId: number | null; setAssignUserId: (v: number | null) => void
  assignNote: string; setAssignNote: (v: string) => void
  repairCause: string; setRepairCause: (v: string) => void
  repairSolution: string; setRepairSolution: (v: string) => void
  repairHours: string; setRepairHours: (v: string) => void
  partsCost: string; setPartsCost: (v: string) => void
  laborCost: string; setLaborCost: (v: string) => void
  approveResult: '通过' | '驳回'; setApproveResult: (v: '通过' | '驳回') => void
  approveOpinion: string; setApproveOpinion: (v: string) => void
  closeRemark: string; setCloseRemark: (v: string) => void
  onAssign: () => void; onRepair: () => void; onApprove: () => void; onClose: () => void
}

function FaultDetail(p: FaultDetailProps) {
  const f = p.fault
  return (
    <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '10px 4px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>
        {f.fault_no || `故障 #${f.fault_id}`}
        <span style={{
          marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 8,
          background: '#E3F2FD', color: '#1565C0', fontWeight: 400,
        }}>{f.status}</span>
      </div>
      <DetailLine label="设备">{f.device_name} ({f.device_code})</DetailLine>
      <DetailLine label="等级">{f.fault_level}</DetailLine>
      <DetailLine label="上报时间">{String(f.fault_time || '').slice(0, 16)}</DetailLine>
      {f.repair_person_name && <DetailLine label="维修人">{f.repair_person_name}</DetailLine>}
      {f.fault_desc && <DetailLine label="故障描述">{f.fault_desc}</DetailLine>}
      {f.impact_desc && <DetailLine label="影响范围">{f.impact_desc}</DetailLine>}

      {/* 派单 */}
      {f.status === '待派工' && (
        <Section title="👷 派工">
          <select value={p.assignUserId || ''}
            onChange={(e) => p.setAssignUserId(e.target.value ? Number(e.target.value) : null)}
            style={{ padding: 6, borderRadius: 6, border: '1px solid #ddd', width: '100%', marginBottom: 8 }}>
            <option value="">选择维修人员</option>
            {p.users.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.real_name || u.username}</option>
            ))}
          </select>
          <TextArea value={p.assignNote} onChange={p.setAssignNote} rows={1} placeholder="派工备注（可选）"
            style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
          <Button color="primary" size="mini" block onClick={p.onAssign} style={{ marginTop: 8 }}>确认派工</Button>
        </Section>
      )}

      {/* 维修 */}
      {f.status === '维修中' && (
        <Section title="🔧 维修记录">
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>故障原因</div>
          <TextArea value={p.repairCause} onChange={p.setRepairCause} rows={2}
            placeholder="分析故障根因" style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
          <div style={{ fontSize: 12, color: '#666', margin: '8px 0 4px' }}>维修方案</div>
          <TextArea value={p.repairSolution} onChange={p.setRepairSolution} rows={2}
            placeholder="采取的修复措施" style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#888' }}>工时(h)</div>
              <Input value={p.repairHours} onChange={p.setRepairHours} type="number" placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#888' }}>备件费</div>
              <Input value={p.partsCost} onChange={p.setPartsCost} type="number" placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#888' }}>人工费</div>
              <Input value={p.laborCost} onChange={p.setLaborCost} type="number" placeholder="0" />
            </div>
          </div>
          <Button color="primary" size="mini" block onClick={p.onRepair} style={{ marginTop: 8 }}>提交维修记录</Button>
        </Section>
      )}

      {/* 验收 */}
      {f.status === '待审批' && (
        <Section title="✅ 验收审批">
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>验收结果</div>
          <div style={{ display: 'flex', gap: 16 }}>
<Radio.Group value={p.approveResult} onChange={(v) => p.setApproveResult(v as any)}>

            <Radio value="通过">通过</Radio>
            <Radio value="驳回">驳回</Radio>
          </Radio.Group>          </div>

          <div style={{ fontSize: 12, color: '#666', margin: '8px 0 4px' }}>审批意见</div>
          <TextArea value={p.approveOpinion} onChange={p.setApproveOpinion} rows={2}
            placeholder="验收备注" style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
          <Button color="primary" size="mini" block onClick={p.onApprove} style={{ marginTop: 8 }}>提交验收</Button>
        </Section>
      )}

      {/* 关闭（任何非已关闭状态都可） */}
      {f.status !== '已关闭' && f.status !== '待派工' && (
        <Section title="📌 关闭故障">
          <TextArea value={p.closeRemark} onChange={p.setCloseRemark} rows={1}
            placeholder="关闭备注（可选）" style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }} />
          <Button size="mini" block onClick={p.onClose} style={{ marginTop: 8, color: '#F44336', borderColor: '#F44336' }}>
            关闭故障单
          </Button>
        </Section>
      )}

      {/* 已关闭展示维修结果 */}
      {f.status === '已关闭' && (f.repair_solution || f.fault_cause) && (
        <Section title="📝 维修结果">
          {f.fault_cause && <DetailLine label="原因">{f.fault_cause}</DetailLine>}
          {f.repair_solution && <DetailLine label="方案">{f.repair_solution}</DetailLine>}
        </Section>
      )}
    </div>
  )
}

function DetailLine({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: 'flex', marginBottom: 4, fontSize: 12 }}>
      <div style={{ color: '#888', width: 70, flexShrink: 0 }}>{label}：</div>
      <div style={{ color: '#333', flex: 1 }}>{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div style={{
      marginTop: 12, padding: 10, borderRadius: 8, background: '#f7f8fa', border: '1px solid #eef0f3',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}
