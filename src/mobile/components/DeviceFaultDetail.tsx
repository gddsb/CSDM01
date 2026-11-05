/**
 * 设备故障详情（整页视图内容）
 * 从 MobileDeviceFault.tsx 拆出：详情表单 + 明细行 + 分区
 *
 * 【框架约束】详情由页面级 .mobile-page-scroll-list 统一滚动，
 * 本组件根节点不得声明 maxHeight / overflow，否则会与弹层/页面滚动区形成"两层框架"。
 */
import { Button, TextArea, Radio, Input, Picker } from 'antd-mobile'
import { MobileImageUploader } from './MobileImageUploader'

function getCurrentUsername(): string {
  try {
    const raw = localStorage.getItem('mes_user')
    if (!raw) return ''
    return JSON.parse(raw)?.username || ''
  } catch { return '' }
}

export interface UserRow {
  user_id: number
  real_name?: string
  username?: string
}

export interface FaultRow {
  fault_id: number
  fault_no?: string
  device_id?: number
  device_name?: string
  device_code?: string
  fault_level: string
  fault_desc?: string
  fault_time?: string
  impact_desc?: string
  reporter_name?: string
  repairer_id?: number
  repairer_name?: string
  status: string
  fault_cause?: string
  repair_solution?: string
  repair_hours?: number
  parts_cost?: number
  labor_cost?: number
  approve_result?: string
  approve_opinion?: string
  close_remark?: string
  fault_images?: any[]
}

export interface DeviceFaultDetailProps {
  fault: FaultRow
  users: UserRow[]
  assignUserId: number | null
  setAssignUserId: (v: number | null) => void
  assignNote: string
  setAssignNote: (v: string) => void
  repairCause: string
  setRepairCause: (v: string) => void
  repairSolution: string
  setRepairSolution: (v: string) => void
  repairHours: string
  setRepairHours: (v: string) => void
  partsCost: string
  setPartsCost: (v: string) => void
  laborCost: string
  setLaborCost: (v: string) => void
  approveResult: '通过' | '驳回'
  setApproveResult: (v: '通过' | '驳回') => void
  approveOpinion: string
  setApproveOpinion: (v: string) => void
  closeRemark: string
  setCloseRemark: (v: string) => void
  onAssign: () => void
  onRepair: () => void
  onApprove: () => void
  onClose: () => void
  detailFaultImgs: string[]
  setDetailFaultImgs: (v: string[]) => void
  detailRepairImgs: string[]
  setDetailRepairImgs: (v: string[]) => void
}

export default function DeviceFaultDetail(p: DeviceFaultDetailProps) {
  const f = p.fault
  return (
    <div style={{ padding: '4px 0 20px', fontSize: 13 }}>
      <DetailLine label="设备">{f.device_name} ({f.device_code})</DetailLine>
      <DetailLine label="等级">{f.fault_level}</DetailLine>
      <DetailLine label="上报时间">{String(f.fault_time || '').slice(0, 16).replace('T', ' ')}</DetailLine>
      {f.repairer_name && <DetailLine label="维修人">{f.repairer_name}</DetailLine>}
      {f.fault_desc && <DetailLine label="故障描述">{f.fault_desc}</DetailLine>}
      {f.impact_desc && <DetailLine label="影响范围">{f.impact_desc}</DetailLine>}
      {f.fault_cause && <DetailLine label="故障原因">{f.fault_cause}</DetailLine>}
      {f.repair_solution && <DetailLine label="维修方案">{f.repair_solution}</DetailLine>}
      {(f.repair_hours != null || f.parts_cost != null || f.labor_cost != null) && (
        <DetailLine label="维修费用">
          {(f.repair_hours != null ? `工时${f.repair_hours}h ` : '')}
          {(f.parts_cost != null ? `备件¥${f.parts_cost} ` : '')}
          {(f.labor_cost != null ? `人工¥${f.labor_cost}` : '')}
        </DetailLine>
      )}
      {f.approve_result && <DetailLine label="验收结果">{f.approve_result}{f.approve_opinion ? `（${f.approve_opinion}）` : ''}</DetailLine>}
      {f.close_remark && <DetailLine label="关闭备注">{f.close_remark}</DetailLine>}

      {/* 派单 */}
      {f.status === '待派工' && (
        <Section title="👷 派工">
          <Picker
            columns={[p.users.map((u) => ({ label: u.real_name || u.username || '', value: String(u.user_id) }))]}
            value={p.assignUserId ? [String(p.assignUserId)] : []}
            onConfirm={(v) => p.setAssignUserId(v[0] ? Number(v[0]) : null)}
          >
            {(items, { open }) => (
              <div onClick={open} style={{
                padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd',
                background: '#fff', cursor: 'pointer', marginBottom: 8,
                color: items[0] ? 'var(--m-text)' : 'var(--m-text-3)',
              }}>
                {items[0]?.label || '选择维修人员（设备维护员）'}
              </div>
            )}
          </Picker>
          <TextArea value={p.assignNote} onChange={p.setAssignNote} rows={1} placeholder="派工备注（可选）"
            style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
          <Button color="primary" size="mini" block onClick={p.onAssign} style={{ marginTop: 8 }}>确认派工</Button>
        </Section>
      )}

      {/* 维修 */}
      {f.status === '维修中' && (
        <Section title="🔧 维修记录">
          <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 4 }}>故障原因</div>
          <TextArea value={p.repairCause} onChange={p.setRepairCause} rows={2}
            placeholder="分析故障根因" style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
          <div style={{ fontSize: 12, color: 'var(--m-text-2)', margin: '8px 0 4px' }}>维修方案</div>
          <TextArea value={p.repairSolution} onChange={p.setRepairSolution} rows={2}
            placeholder="采取的修复措施" style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>工时(h)</div>
              <Input value={p.repairHours} onChange={p.setRepairHours} type="number" placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>备件费</div>
              <Input value={p.partsCost} onChange={p.setPartsCost} type="number" placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>人工费</div>
              <Input value={p.laborCost} onChange={p.setLaborCost} type="number" placeholder="0" />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--m-text-2)', margin: '8px 0 4px' }}>维修后照片（可选）</div>
          <MobileImageUploader
            uploadUrl={`/basic/device-faults/${f.fault_id}/images`}
            uploadData={{ image_type: 'repair' }}
            deleteUrl={(rawUrl) => `/basic/device-faults/${f.fault_id}/images?path=${encodeURIComponent(rawUrl)}`}
            value={p.detailRepairImgs}
            onChange={p.setDetailRepairImgs}
            maxCount={6}
            compress={true}
            watermark={{ username: getCurrentUsername(), timestamp: true }}
          />
          <Button color="primary" size="mini" block onClick={p.onRepair} style={{ marginTop: 8 }}>提交维修记录</Button>
        </Section>
      )}

      {/* 验收 */}
      {f.status === '待审批' && (
        <Section title="✅ 验收审批">
          <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 4 }}>验收结果</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Radio.Group value={p.approveResult} onChange={(v) => p.setApproveResult(v as '通过' | '驳回')}>
              <Radio value="通过">通过</Radio>
              <Radio value="驳回">驳回</Radio>
            </Radio.Group>
          </div>

          <div style={{ fontSize: 12, color: 'var(--m-text-2)', margin: '8px 0 4px' }}>审批意见</div>
          <TextArea value={p.approveOpinion} onChange={p.setApproveOpinion} rows={2}
            placeholder="验收备注" style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
          <Button color="primary" size="mini" block onClick={p.onApprove} style={{ marginTop: 8 }}>提交验收</Button>
        </Section>
      )}

      {/* 关闭（仅待派工未干活时可手动取消） */}
      {f.status === '待派工' && (
        <Section title="📌 关闭故障">
          <TextArea value={p.closeRemark} onChange={p.setCloseRemark} rows={1}
            placeholder="关闭备注（可选）" style={{ background: 'var(--m-surface-2)', borderRadius: 8, padding: 8 }} />
          <Button size="mini" block onClick={p.onClose} style={{ marginTop: 8, color: 'var(--brand-color-danger)', borderColor: 'var(--brand-color-danger)' }}>
            关闭故障单
          </Button>
        </Section>
      )}

      {/* 已关闭展示维修结果 */}
      {f.status === '已关闭' && (
        <Section title="📝 维修结果">
          {f.fault_cause ? <DetailLine label="原因">{f.fault_cause}</DetailLine> : <DetailLine label="原因">—</DetailLine>}
          {f.repair_solution ? <DetailLine label="方案">{f.repair_solution}</DetailLine> : <DetailLine label="方案">—</DetailLine>}
        </Section>
      )}

      {/* ===== 照片区 ===== */}
      {/* 故障照片：待派工可编辑，其他状态只读 */}
      {(p.detailFaultImgs.length > 0 || f.status === '待派工') && (
        <Section title="📷 故障现场照片">
          <MobileImageUploader
            value={p.detailFaultImgs}
            onChange={p.setDetailFaultImgs}
            uploadUrl={`/basic/device-faults/${f.fault_id}/images`}
            deleteUrl={(rawUrl: string) => `/basic/device-faults/${f.fault_id}/images?path=${encodeURIComponent(rawUrl)}`}
            maxCount={6}
            readOnly={f.status !== '待派工'}
          />
        </Section>
      )}

      {/* 维修后照片：维修中已在维修记录内上传，此处仅在其他状态只读展示 */}
      {(p.detailRepairImgs.length > 0 && f.status !== '维修中') && (
        <Section title="🔧 维修后照片">
          <MobileImageUploader
            value={p.detailRepairImgs}
            onChange={p.setDetailRepairImgs}
            uploadUrl={`/basic/device-faults/${f.fault_id}/images`}
            deleteUrl={(rawUrl: string) => `/basic/device-faults/${f.fault_id}/images?path=${encodeURIComponent(rawUrl)}`}
            maxCount={6}
            readOnly={true}
          />
        </Section>
      )}
    </div>
  )
}

function DetailLine({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: 'flex', marginBottom: 4, fontSize: 12 }}>
      <div style={{ color: 'var(--m-text-3)', width: 70, flexShrink: 0 }}>{label}：</div>
      <div style={{ color: 'var(--m-text)', flex: 1 }}>{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div style={{
      marginTop: 16, padding: '6px 0',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--brand-color)' }}>{title}</div>
      {children}
    </div>
  )
}
