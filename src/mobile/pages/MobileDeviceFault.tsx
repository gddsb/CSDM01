/**
 * 设备故障工单 — 完整 5 状态机（Phase 5-B）
 *
 * 对齐 PC DeviceFault.tsx 的写动作：
 *   ✅ 新建   POST /basic/device-faults               (fault_level/fault_desc/fault_time/impact_desc)
 *   ✅ 派单   PUT  /basic/device-faults/:id/assign    (repairer_id/name/assign_note)
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
  PullToRefresh, Space,
} from 'antd-mobile'
import api from '../../utils/api'
import { useApp } from '../../contexts/AppContext'
import { offlinePost, offlinePut } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'
import { nowLocalStr } from '../../utils/localTime'
import { useDebounceEffect } from '../hooks/useDebounceEffect'
import { MobileImageUploader } from '../components/MobileImageUploader'
import type { UploadImageValue } from '../components/MobileImageUploader'
import DeviceFaultDetail from '../components/DeviceFaultDetail'
import type { FaultRow, UserRow } from '../components/DeviceFaultDetail'
import { registerBackHandler } from '../utils/backInterceptor'

function getCurrentUsername(): string {
  try {
    const raw = localStorage.getItem('mes_user')
    if (!raw) return ''
    return JSON.parse(raw)?.username || ''
  } catch { return '' }
}

type FaultStatus = '待派工' | '维修中' | '待审批' | '已挂起' | '已关闭'
type StatusTab = 'all' | FaultStatus

interface FaultDevice { device_id: number; device_code?: string; device_name?: string; line_name?: string }

/** 状态色（列表卡片 + 详情页头共用）
 * 【UI 重构 2026-11-07】统一使用 mobile.css 里的 --m-status-* 语义变量 */
function statusColorOf(status: string): string {
  return status === '待派工' ? 'var(--m-status-pending)'
    : status === '维修中' ? 'var(--m-status-repairing)'
    : status === '待审批' ? 'var(--m-status-approving)'
    : status === '已挂起' ? 'var(--m-status-skipped)'
    : 'var(--m-status-skipped)' /* 已关闭 */
}

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: '待派工', label: '待派工' },
  { key: '维修中', label: '维修中' },
  { key: '待审批', label: '待审批' },
  { key: '已关闭', label: '已关闭' },
]

const LEVELS = ['一般', '严重', '紧急'] as const

// ========== 5-B 主组件 ==========

export default function MobileDeviceFault() {
  const { hasPermission } = useApp()
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
  const [createImages, setCreateImages] = useState<string[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [showDevicePicker, setShowDevicePicker] = useState(false)
  const [deviceSearchKw, setDeviceSearchKw] = useState('')

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

  // 详情照片（从服务器拉取；维修中时可编辑）
  const [detailFaultImgs, setDetailFaultImgs] = useState<UploadImageValue[]>([])
  const [detailRepairImgs, setDetailRepairImgs] = useState<UploadImageValue[]>([])

  // 顶部统计（独立于 tab 过滤，全量聚合）
  const [stats, setStats] = useState({ pending: 0, repairing: 0, approving: 0, closed: 0, urgent: 0, total: 0 })

  // ===== 拉取设备/用户（用于新建/派单）=====
  useEffect(() => {
    api.get('/basic/devices', { params: { page: 1, pageSize: 500 } }).then((r: any) => {
      const list: FaultDevice[] = r.success ? (r.data?.list || r.data || []) : []
      setDevices(list)
    }).catch(() => {})
    api.get('/system/users', { params: { page: 1, pageSize: 200, role_code: 'MAINTENANCE' } }).then((r: any) => {
      const list: UserRow[] = r.success ? (r.data?.list || r.data || []) : []
      setUsers(list)
    }).catch(() => {})
  }, [])

  // ===== 拉取故障列表 =====
  const loadFaults = async (status?: StatusTab, kw?: string) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 50 }
      const s = (status || tab)
      if (s !== 'all') params.status = s
      if (kw) params.fault_no = kw
      const r: any = await api.get('/basic/device-faults', { params })
      const list: FaultRow[] = r.success ? (r.data?.list || r.data || []) : []
      setFaults(list)
    } catch { setFaults([]) } finally { setLoading(false) }
  }
  useEffect(() => { loadFaults(tab) }, [tab])

  // ===== 顶部统计（全量聚合，不受 tab 影响）=====
  const loadStats = async () => {
    try {
      const r: any = await api.get('/basic/device-faults/stats')
      if (r.success && r.data) setStats(r.data)
    } catch { /* 统计失败不阻断列表 */ }
  }
  useEffect(() => { loadStats() }, [])

  // ===== 详情照片加载 =====
  const loadDetailImages = async (faultId: number) => {
    try {
      const r: any = await api.get(`/basic/device-faults/${faultId}/images`)
      if (r.success !== false) {
        const d = r.data || {}
        const toValues = (list: any[]): UploadImageValue[] => (list || [])
          .map((i) => ({ url: i.file_path || i.url || '', imageId: Number(i.image_id) || undefined }))
          .filter((v) => v.url)
        setDetailFaultImgs(toValues(d.fault_images))
        setDetailRepairImgs(toValues(d.repair_images))
      }
    } catch { /* 图片加载失败不阻断详情 */ }
  }
  useEffect(() => {
    if (selected) loadDetailImages(selected.fault_id)
    else { setDetailFaultImgs([]); setDetailRepairImgs([]) }
  }, [selected?.fault_id])

  // ===== NavBar 返回拦截：详情 → 列表（不跳出页面）=====
  useEffect(() => {
    const unregister = registerBackHandler(() => {
      if (selected) { setSelected(null); return true }
      return false
    })
    return unregister
  }, [selected])

  // 搜索框 debounce：停下 500ms 自动查
  useDebounceEffect(keyword, (v) => {
    loadFaults(tab, v.trim() || undefined)
  }, 500)

  // ===== 图片 upload helper（submit 后 fault_id 已知时拼 multipart）=====
  const uploadImages = async (faultId: number, files: File[]) => {
    if (files.length === 0) return 0
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      const r: any = await api.post(`/basic/device-faults/${faultId}/images`, fd, { timeout: 60000 })
      if (r?.success) return files.length
    } catch { /* 图片失败不阻塞主流程 */ }
    return 0
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
        fault_time: nowLocalStr(),
        impact_desc: createImpact,
      }, { source: 'device-fault' })
      const faultId = r.data?.fault_id || r.data?.id
      if (faultId && pendingFiles.length > 0) await uploadImages(faultId, pendingFiles)

      Toast.show({
        content: r.message || '上报成功',
        icon: 'success', position: 'bottom',
      })
      // reset
      setShowCreate(false); setCreateDeviceId(null); setCreateDeviceName(''); setPendingFiles([])
      setCreateDesc(''); setCreateImpact(''); setCreateLevel('一般'); setCreateImages([])
      await loadFaults(tab); await loadStats()
    } catch (e: any) { Toast.show({ content: e?.message || '上报失败', position: 'bottom' }) }
  }

  // ===== 5-B 扫码搜索故障 =====
  const handleScanForSearch = async () => {
    const r = await scan(); if (!r) return
    setKeyword(r.code)
    // 立即执行一次查找（不等待 debounce）
    loadFaults(tab, r.code)
  }

  // ===== 5-B 扫码定位设备并直接开上报弹窗（【UI 重构】快速上报入口）=====
  const handleScanForCreate = async () => {
    const r = await scan(); if (!r) return
    const match = devices.find((d) => d.device_code === r.code)
    if (!match) {
      Toast.show({ content: '未找到设备，请手动选择', position: 'bottom', duration: 1500 })
      // fallback：直接打开上报弹窗，设备为空让用户手动选
      setCreateDeviceId(null); setCreateDeviceName('')
      setShowCreate(true)
      return
    }
    setCreateDeviceId(match.device_id)
    setCreateDeviceName(match.device_name || match.device_code || '')
    setShowCreate(true) // 【UI 重构】自动打开上报弹窗，操作员跳过手动选设备
  }

  // ===== 5-B 派单 =====
  const onAssign = async () => {
    if (!selected) return
    if (!assignUserId) { Toast.show({ content: '请选择维修人员', position: 'bottom' }); return }
    const user = users.find((u) => u.user_id === assignUserId)
    try {
      const r: any = await offlinePut(`/basic/device-faults/${selected.fault_id}/assign`, {
        repairer_id: assignUserId,
        repairer_name: user?.real_name || user?.username,
        assign_note: assignNote,
      }, { source: 'device-fault' })
      Toast.show({ content: r.message || '派单成功', icon: 'success', position: 'bottom' })
      setSelected(null); setAssignUserId(null); setAssignNote('')
      await loadFaults(tab); await loadStats()
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
      await loadFaults(tab); await loadStats()
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
      await loadFaults(tab); await loadStats()
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
      await loadFaults(tab); await loadStats()
    } catch (e: any) { Toast.show({ content: e?.message || '操作失败', position: 'bottom' }) }
  }

  // ===== 渲染 =====
  // 详情整页视图：直接替换列表页，保持"单层框架 + 单一滚动源"
  if (selected) {
    const statusColor = statusColorOf(selected.status)
    return (
      <div className="mobile-page-fixed-header">
        <div className="mobile-sticky-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {selected.fault_no || `故障 #${selected.fault_id}`}
            </div>
            <span style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 8,
              background: statusColor + '22', color: statusColor,
            }}>{selected.status}</span>
          </div>
        </div>
        <div className="mobile-page-scroll-list">
          <DeviceFaultDetail
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
            detailFaultImgs={detailFaultImgs} setDetailFaultImgs={setDetailFaultImgs}
            detailRepairImgs={detailRepairImgs} setDetailRepairImgs={setDetailRepairImgs}
            onAssign={onAssign} onRepair={onRepair} onApprove={onApprove} onClose={onClose}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-page-fixed-header">
      <div className="mobile-sticky-header">
        {/* 顶部统计卡 */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 12, padding: '10px 12px',
          background: 'linear-gradient(135deg,#2196F3 0%,#1565C0 100%)',
          borderRadius: 12, color: 'var(--m-surface)',
        }}>
          <Stat label="待派工" v={stats.pending} />
          <Stat label="维修中" v={stats.repairing} />
          <Stat label="待审批" v={stats.approving} />
          <Stat label="紧急" v={stats.urgent} red />
        </div>

        {/* 搜索 + 扫码 + 上报 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <SearchBar
            placeholder="故障单号 / 设备"
            value={keyword}
            onChange={setKeyword}
            onSearch={() => loadFaults(tab, keyword.trim() || undefined)}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Button size="small" fill="outline" onClick={handleScanForSearch} style={{ flexShrink: 0 }}>📷</Button>
          {hasPermission('mobile:device:fault:create') && (
            <Button color="primary" onClick={() => setShowCreate(true)} style={{ flexShrink: 0 }}>+ 上报</Button>
          )}
        </div>

        {/* 【UI 重构】快速上报大按钮 — 扫码→自动找设备→开弹窗 */}
        {hasPermission('mobile:device:fault:create') && (
          <Button
            block
            size="large"
            color="primary"
            onClick={handleScanForCreate}
            style={{
              marginBottom: 10,
              height: 44,
              fontSize: 15,
              background: 'linear-gradient(135deg, var(--brand-color) 0%, var(--brand-color-hover) 100%)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(33,150,243,0.25)',
            }}
          >
            📷 扫码快速上报
          </Button>
        )}

        {/* 状态 Tab（对齐 PC） */}
        <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: '0 8px', marginBottom: 10 }}>
          <Tabs activeKey={tab} onChange={(k) => setTab(k as StatusTab)}>
            {STATUS_TABS.map((t) => <Tabs.Tab title={t.label} key={t.key} />)}
          </Tabs>
        </div>
      </div>

      <div className="mobile-page-scroll-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>加载中...</div>
        ) : faults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>暂无故障记录</div>
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
            {/* 设备选择：扫码快速上报时已自动填充，无需手动选 */}
            <div style={{ marginBottom: 8 }}>
              <div
                onClick={() => { setDeviceSearchKw(''); setShowDevicePicker(true) }}
                style={{
                  padding: '8px 12px', borderRadius: 6, border: '1px solid var(--m-border)',
                  background: 'var(--m-surface-2)', cursor: 'pointer', fontSize: 13,
                  color: createDeviceId ? 'var(--m-text)' : 'var(--m-text-3)',
                }}>
                {createDeviceId ? `${createDeviceName}（${devices.find(d => d.device_id === createDeviceId)?.device_code || ''}）` : '选择故障设备（可搜索）'}
              </div>
            </div>
            {/* 【UI 重构】等级前置 — 操作员第一眼看到主管最关心的字段 */}
            <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 4 }}>故障等级 <span style={{ color: 'var(--m-status-urgent)', marginLeft: 4 }}>{(LEVELS as string[]).includes(createLevel) ? `已选: ${createLevel}` : ''}</span></div>
            <div style={{ display: 'flex', gap: 16 }}>
<Radio.Group value={createLevel} onChange={(v) => setCreateLevel(v as string)}>

              {LEVELS.map((l) => <Radio key={l} value={l}>{l}</Radio>)}
            </Radio.Group>            </div>

            {/* 【UI 重构】TextArea 默认 2 行，减少首屏占用 */}
            <div style={{ fontSize: 12, color: 'var(--m-text-2)', margin: '8px 0 4px' }}>故障描述 *</div>
            <TextArea value={createDesc} onChange={setCreateDesc} rows={2}
              placeholder="详细描述故障现象" style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
            <div style={{ fontSize: 12, color: 'var(--m-text-2)', margin: '8px 0 4px' }}>影响范围（可选）</div>
            <TextArea value={createImpact} onChange={setCreateImpact} rows={1}
              placeholder="影响的产线/批次/人员（可空）" style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
            <div style={{ fontSize: 12, color: 'var(--m-text-2)', margin: '8px 0 4px' }}>故障现场照片（可选）</div>
            <MobileImageUploader
              uploadMode="blob"
              value={createImages}
              onChange={setCreateImages}
              maxCount={6}
              compress={true}
              watermark={{ username: getCurrentUsername(), timestamp: true }}
              onFilesReady={setPendingFiles}
            />
          </div>
        }
          actions={[
            { key: 'cancel', text: '取消', onClick: () => setShowCreate(false) },
            { key: 'ok', text: '上报', bold: true, onClick: onCreateSubmit },
          ]}
        />
      )}

      {/* ======= 设备搜索选择弹层 ======= */}
      {showDevicePicker && (
        <Dialog
          visible
          content={
            <div style={{ padding: '6px 4px 0' }}>
              <SearchBar
                placeholder="输入设备名称或编号"
                value={deviceSearchKw}
                onChange={setDeviceSearchKw}
                onCancel={() => setDeviceSearchKw('')}
              />
              <div style={{ maxHeight: 320, overflow: 'auto', marginTop: 4 }}>
                {devices
                  .filter(d => {
                    if (!deviceSearchKw.trim()) return true
                    const kw = deviceSearchKw.toLowerCase()
                    return (
                      (d.device_name || '').toLowerCase().includes(kw) ||
                      (d.device_code || '').toLowerCase().includes(kw) ||
                      String(d.device_id).includes(kw)
                    )
                  })
                  .map(d => (
                    <div
                      key={d.device_id}
                      onClick={() => {
                        setCreateDeviceId(d.device_id)
                        setCreateDeviceName(d.device_name || '')
                        setShowDevicePicker(false)
                      }}
                      style={{
                        padding: '10px 12px', borderBottom: '1px solid var(--m-border)',
                        cursor: 'pointer', fontSize: 13,
                      }}>
                      <div style={{ fontWeight: 500 }}>{d.device_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>
                        {d.device_code} {d.line_name ? `· ${d.line_name}` : ''}
                      </div>
                    </div>
                  ))}
                {devices.filter(d => {
                  if (!deviceSearchKw.trim()) return true
                  const kw = deviceSearchKw.toLowerCase()
                  return (
                    (d.device_name || '').toLowerCase().includes(kw) ||
                    (d.device_code || '').toLowerCase().includes(kw) ||
                    String(d.device_id).includes(kw)
                  )
                }).length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--m-text-3)', fontSize: 12 }}>
                    无匹配设备
                  </div>
                )}
              </div>
            </div>
          }
          actions={[{ key: 'close', text: '取消', onClick: () => setShowDevicePicker(false) }]}
        />
      )}

    </div>
  )
}

// ========== 子组件 ==========

function Stat({ label, v, red }: { label: string; v: number; red?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: red ? '#FFCDD2' : 'var(--m-surface)' }}>{v}</div>
      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function FaultCard({ fault, onOpen }: { fault: FaultRow; onOpen: () => void }) {
  const levelColor = fault.fault_level === '紧急' ? 'var(--brand-color-danger)'
    : fault.fault_level === '严重' ? 'var(--brand-color-warning)' : 'var(--brand-color)'
  const statusColor = statusColorOf(fault.status)
  return (
    <div onClick={onOpen} style={{
      background: 'var(--m-surface)', borderRadius: 10, padding: 12, marginBottom: 10,
      border: '1px solid var(--m-border)', cursor: 'pointer',
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
      <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginTop: 6 }}>
        📍 {fault.device_name} ({fault.device_code})
      </div>
      {fault.fault_desc && (
        <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {fault.fault_desc}
        </div>
      )}
      {(fault.repairer_name || fault.fault_time) && (
        <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 6, display: 'flex', gap: 10 }}>
          {fault.repairer_name && <span>👷 {fault.repairer_name}</span>}
          {fault.fault_time && <span>⏰ {String(fault.fault_time).slice(0, 16).replace("T", " ")}</span>}
        </div>
      )}
    </div>
  )
}

