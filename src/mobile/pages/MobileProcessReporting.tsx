import logger from '../../utils/logger.js'
/**
 * 移动报工 — 对标 PC 端 ProcessReporting.tsx 完整流程
 *
 * 流程：选工单 → 开工创建报工单 → 分工序报工（5 Tab）→ 完工
 * 约束（对齐 PC）：
 *   - 工序从 report_processes 子表读取，按 sort_order 排序
 *   - 不良类型按 related_processes 过滤（空=全工序，有=仅关联工序）
 *   - 投料第一道工序可录投入/退回
 *   - 人员工时后端自动创建（开工时），前端只改人数
 *   - 数量校验 + 完工二次确认
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dialog, Toast, Button, Tabs, Badge } from 'antd-mobile'
import api from '../../utils/api'

// ============ 类型 ============
interface ProcessRow {
  report_process_id: number; process_id: number; process_code: string
  process_name: string; must_report: boolean; has_material: boolean
  sort_order: number;
}
interface ReportOrder {
  report_order_id: number; report_no: string; order_id: number; order_no: string
  line_id: number; line_name: string; material_code: string; material_name: string
  report_qty: number; status: number | string; report_time?: string; finish_time?: string
}
interface OrderRow {
  order_id: number; order_no: string; status: string
  material_code: string; material_name: string
  planned_qty: number; finished_qty: number; line_name?: string
}
interface DefectType {
  defect_id: number; defect_code: string; defect_type: string; defect_name: string
  category_name: string; status: string; related_processes?: number[]
}

// ============ 主组件 ============
export default function MobileProcessReporting() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const urlOrderId = sp.get('orderId')

  // 阶段：select → reporting
  const [phase, setPhase] = useState<'select' | 'reporting'>('select')

  // ========== 阶段1 数据 ==========
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [openReports, setOpenReports] = useState<ReportOrder[]>([])
  const [loading, setLoading] = useState(false)

  // ========== 阶段2 数据 ==========
  const [current, setCurrent] = useState<ReportOrder | null>(null)
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [activeProcId, setActiveProcId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<string>('input')

  // 基础字典
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([])

  // 各工序报工子记录（useMap: process_id → records[]）
  const [defects, setDefects] = useState<any[]>([])
  const [scraps, setScraps] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [exceptions, setExceptions] = useState<any[]>([])
  const [manpower, setManpower] = useState<any | null>(null)

  // ========== 阶段1 加载 ==========
  const loadSelect = useCallback(async () => {
    setLoading(true)
    try {
      const [oR, rR, dR] = await Promise.all([
        api.get('/production/orders', { params: { status: ['下发', '开工'], page: 1, pageSize: 50 } }),
        api.get('/production/report-orders', { params: { page: 1, pageSize: 100, status: 0 } }),
        api.get('/basic/defect-types', { params: { page: 1, pageSize: 500, status: '启用' } }),
      ])
      const oData: any = (oR as any).success ? ((oR as any).data?.list || (oR as any).data || []) : []
      const rData: any = (rR as any).success ? ((rR as any).data?.list || (rR as any).data || []) : []
      const dData: any = (dR as any).success ? ((dR as any).data?.list || (dR as any).data || []) : []
      setOrders(oData)
      setOpenReports(rData)
      setDefectTypes(dData)
    } catch (e: any) {
      Toast.show({ content: '加载失败: ' + (e?.message || ''), icon: 'fail' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (phase === 'select') loadSelect()
  }, [phase, loadSelect])

  // URL orderId 自动匹配/开工
  useEffect(() => {
    if (!urlOrderId || phase !== 'select') return
    const existing = openReports.find(r => String(r.order_id) === urlOrderId)
    if (existing) { enterReporting(existing); return }
    const t = setTimeout(async () => {
      const o = orders.find(x => String(x.order_id) === urlOrderId)
      if (o) await handleStartNew(o)
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlOrderId, phase, orders, openReports])

  // ========== 开工（创建报工单） ==========
  const handleStartNew = async (order: OrderRow) => {
    // 查是否已有未完工报工单
    const existing = openReports.find(r => r.order_id === order.order_id && String(r.status ?? 0) !== '1')
    if (existing) {
      const ok = await Dialog.confirm({
        content: `该订单已有开工报工单 ${existing.report_no}，直接进入？`,
        confirmText: '进入', cancelText: '取消',
      })
      if (ok) enterReporting(existing); return
    }
    // 弹窗选产线（如果订单没指定产线）
    try {
      const res: any = await api.post('/production/report-orders', {
        order_id: order.order_id,
        report_qty: order.planned_qty > 0 ? Math.min(1, order.planned_qty - order.finished_qty) : 1,
      })
      if (!res.success) throw new Error(res.message || '创建失败')
      const report = res.data?.reportOrder || res.data
      Toast.show({ content: `已开工：${report.report_no}`, icon: 'success' })
      await loadSelect()  // 刷新 openReports
      enterReporting(report)
    } catch (e: any) {
      if (e?.data?.need_confirm) {
        const ok = await Dialog.confirm({ content: e.message, confirmText: '继续', cancelText: '取消' })
        if (!ok) return
        try {
          const r2: any = await api.post('/production/report-orders', {
            order_id: order.order_id, report_qty: 1, confirmed: true,
          })
          const report2 = r2.data?.reportOrder || r2.data
          enterReporting(report2)
        } catch (e2: any) { Toast.show({ content: e2?.message || '失败', icon: 'fail' }) }
      } else {
        Toast.show({ content: e?.message || '失败', icon: 'fail' })
      }
    }
  }

  // ========== 进入报工 ==========
  const enterReporting = async (report: ReportOrder) => {
    setCurrent(report); setPhase('reporting'); setActiveTab('input')
    try {
      // 工序
      const pR: any = await api.get(`/production/report-orders/${report.report_order_id}/processes`)
      const procs: ProcessRow[] = pR.success ? (pR.data || []) : []
      procs.sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      setProcesses(procs)
      if (procs.length > 0) setActiveProcId(procs[0].process_id)

      // 所有子记录（一次性拉全，前端按工序过滤 — 省网络请求）
      const [dR, sR, mR, eR, mpR] = await Promise.all([
        api.get('/production/process-defects', { params: { report_order_id: report.report_order_id, page: 1, pageSize: 1000 } }),
        api.get('/production/scrap-defects', { params: { report_order_id: report.report_order_id, page: 1, pageSize: 1000 } }),
        api.get('/production/process-materials', { params: { report_order_id: report.report_order_id, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { report_order_id: report.report_order_id, page: 1, pageSize: 1000 } }),
        api.get('/production/manpower-records', { params: { report_order_id: report.report_order_id, page: 1, pageSize: 50 } }),
      ])
      setDefects(((dR as any).success ? ((dR as any).data?.list || (dR as any).data || []) : []).map((d: any) => ({ ...d, id: d.defect_id })))
      setScraps(((sR as any).success ? ((sR as any).data?.list || (sR as any).data || []) : []).map((d: any) => ({ ...d, id: d.scrap_id })))
      setMaterials(((mR as any).success ? ((mR as any).data?.list || (mR as any).data || []) : []).map((m: any) => ({ ...m, id: m.material_id })))
      setExceptions(((eR as any).success ? ((eR as any).data?.list || (eR as any).data || []) : []).map((e: any) => ({ ...e, id: e.exception_id })))
      const mpList: any[] = (mpR as any).success ? ((mpR as any).data?.list || (mpR as any).data || []) : []
      setManpower(mpList.length > 0 ? { ...mpList[0], id: mpList[0].record_id } : null)
    } catch (e) {
      logger.error('加载报工数据失败', e)
    }
  }

  // ========== 当前工序 ==========
  const activeProcess = useMemo(
    () => processes.find(p => p.process_id === activeProcId) || null,
    [processes, activeProcId],
  )
  const isFirstProcess = useMemo(
    () => processes[0]?.process_id === activeProcId,
    [processes, activeProcId],
  )

  // 过滤不良类型（按当前工序）
  const filteredDefectTypes = useMemo(() => {
    return defectTypes
      .filter(d => d.category_name === '制程检验类型' && d.defect_type !== '检验报废' && d.status === '启用')
      .filter(d => {
        const rel: any[] = Array.isArray(d.related_processes) ? d.related_processes : []
        if (!activeProcess) return rel.length === 0
        if (rel.length === 0) return true
        return rel.some(x => String(x) === String(activeProcess.process_id))
      })
  }, [defectTypes, activeProcess])

  const filteredScrapTypes = useMemo(() => {
    return defectTypes
      .filter(d => d.category_name === '制程检验类型' && d.defect_type === '检验报废' && d.status === '启用')
      .filter(d => {
        const rel: any[] = Array.isArray(d.related_processes) ? d.related_processes : []
        if (!activeProcess) return rel.length === 0
        if (rel.length === 0) return true
        return rel.some(x => String(x) === String(activeProcess.process_id))
      })
  }, [defectTypes, activeProcess])

  // ========== 当前工序过滤后的子记录 ==========
  const procDefects = useMemo(() =>
    defects.filter(d => String(d.process_id) === String(activeProcId)),
    [defects, activeProcId],
  )
  const procMaterials = useMemo(() =>
    materials.filter(m => String(m.process_id) === String(activeProcId)),
    [materials, activeProcId],
  )
  const procScraps = useMemo(() => scraps, [scraps])  // 检验报废是工单级
  const procExceptions = useMemo(() => exceptions, [exceptions])  // 异常是工单级

  // ========== CRUD ==========
  const addDefect = async () => {
    if (!current || !activeProcess) return
    const newRow = { report_order_id: current.report_order_id, process_id: activeProcess.process_id, quantity: 0 }
    setDefects(prev => [...prev, { ...newRow, id: `tmp_${Date.now()}`, _isNew: true }])
  }
  const saveDefect = async (row: any) => {
    if (!current) return
    if (!row.defect_type_id) { Toast.show({ content: '请选择不良类型', icon: 'fail' }); return }
    if (!row.quantity || row.quantity <= 0) { Toast.show({ content: '数量 > 0', icon: 'fail' }); return }
    try {
      if (row._isNew || String(row.id).startsWith('tmp_')) {
        const r: any = await api.post('/production/process-defects', row)
        const saved = r.data || (r.success ? r.data : null)
        if (saved) setDefects(prev => prev.map(d => d === row ? { ...saved, id: saved.defect_id } : d))
      } else {
        await api.put(`/production/process-defects/${row.defect_id || row.id}`, row)
        Toast.show({ content: '已保存', icon: 'success' })
      }
    } catch (e: any) { Toast.show({ content: e?.message || '保存失败', icon: 'fail' }) }
  }
  const delDefect = async (row: any) => {
    if (row._isNew || String(row.id).startsWith('tmp_')) {
      setDefects(prev => prev.filter(d => d !== row)); return
    }
    const ok = await Dialog.confirm({ content: '删除该不良记录？', confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      await api.delete(`/production/process-defects/${row.defect_id || row.id}`)
      setDefects(prev => prev.filter(d => d.id !== row.id))
    } catch (e: any) { Toast.show({ content: e?.message || '删除失败', icon: 'fail' }) }
  }

  // ========== 完工 ==========
  const finishReport = async () => {
    if (!current) return
    const ok = await Dialog.confirm({ content: '完工后不可继续编辑，确认？', confirmText: '完工', cancelText: '取消' })
    if (!ok) return
    try {
      await api.post(`/production/report-orders/${current.report_order_id}/finish`)
      Toast.show({ content: '已完工', icon: 'success' })
      navigate('/m/production-orders')
    } catch (e: any) { Toast.show({ content: e?.message || '失败', icon: 'fail' }) }
  }

  const isEditable = String(current?.status ?? 0) !== '1'

  // ============ 渲染 ============
  if (phase === 'select') return <SelectPhase {...{ orders, openReports, loading, onStart: handleStartNew, onEnter: enterReporting }} />
  if (!current) return null

  return (
    <div className="mobile-page-fixed-header">
      {/* 顶部固定：工单信息 + 工序 Tab */}
      <div className="mobile-sticky-header">
        <ReportHeader report={current} onFinish={finishReport} onBack={() => { setPhase('select'); setCurrent(null) }} />
        {processes.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, padding: '4px 6px', marginTop: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <Tabs activeKey={String(activeProcId)} onChange={k => setActiveProcId(Number(k))}>
              {processes.map(p => (
                <Tabs.Tab
                  title={<ProcTabLabel p={p} />}
                  key={String(p.process_id)}
                />
              ))}
            </Tabs>
          </div>
        )}
      </div>

      {/* 内容区独立滚动 */}
      <div className="mobile-page-scroll-list">
        {!activeProcess ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>该产线未配置工序</div>
        ) : (
          <>
            <TabBar active={activeTab} onChange={setActiveTab} />
            {activeTab === 'input' && <InputPanel {...{ activeProcess, current, procMaterials, isFirstProcess, setMaterials }} />}
            {activeTab === 'defect' && (
              <DefectPanel
                {...{
                  editable: isEditable, rows: procDefects, types: filteredDefectTypes,
                  activeProcess, onAdd: addDefect, onSave: saveDefect, onDel: delDefect,
                  onChange: (row, patch) => setDefects(prev => prev.map(d => d === row ? { ...d, ...patch } : d)),
                }}
              />
            )}
            {activeTab === 'material' && <MaterialPanel {...{ editable: isEditable, rows: procMaterials, activeProcess, isFirstProcess, current, setMaterials }} />}
            {activeTab === 'scrap' && <ScrapPanel {...{ editable: isEditable, rows: procScraps, types: filteredScrapTypes, current, setScraps }} />}
            {activeTab === 'manpower' && <ManpowerPanel {...{ editable: isEditable, manpower, current, setManpower }} />}
          </>
        )}
      </div>
    </div>
  )
}

// ============ 子组件 ============

function ProcTabLabel({ p }: { p: ProcessRow }) {
  return (
    <span style={{ fontSize: 12, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {p.sort_order}. {p.process_name}
      {p.must_report && <Badge content="必" style={{ marginLeft: 2 }} />}
    </span>
  )
}

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  const tabs = [
    { key: 'input', label: '投入' },
    { key: 'defect', label: '不良' },
    { key: 'material', label: '投料' },
    { key: 'scrap', label: '报废' },
    { key: 'manpower', label: '人员' },
  ]
  return (
    <div style={{ display: 'flex', background: '#fff', borderRadius: 8, padding: 4, marginBottom: 10, gap: 4 }}>
      {tabs.map(t => (
        <div key={t.key} onClick={() => onChange(t.key)} style={{
          flex: 1, textAlign: 'center', padding: '8px 0', fontSize: 13,
          borderRadius: 6, fontWeight: active === t.key ? 600 : 400,
          background: active === t.key ? '#2196F315' : 'transparent',
          color: active === t.key ? '#2196F3' : '#666',
        }}>{t.label}</div>
      ))}
    </div>
  )
}

function ReportHeader({ report, onFinish, onBack }: { report: ReportOrder; onFinish: () => void; onBack: () => void }) {
  const statusColor = String(report.status ?? 0) === '0' ? '#2196F3' : '#4CAF50'
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '10px 12px',
      borderLeft: `3px solid ${statusColor}`, boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{report.report_no}</div>
        <span style={{
          fontSize: 11, padding: '2px 10px', borderRadius: 10,
          background: statusColor + '15', color: statusColor, fontWeight: 600,
        }}>{String(report.status ?? 0) === '0' ? '开工' : '完工'}</span>
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
        {report.order_no} · {report.material_code} · {report.line_name}
      </div>
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
        报工数量 <b style={{ color: '#2196F3' }}>{report.report_qty}</b>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Button size="mini" fill="outline" onClick={onBack}>← 返回工单</Button>
        {String(report.status ?? 0) === '0' && (
          <Button size="mini" color="danger" onClick={onFinish}>完工</Button>
        )}
      </div>
    </div>
  )
}

// --- 投入/产出 ---
function InputPanel({ activeProcess, current, procMaterials, isFirstProcess, setMaterials }: any) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')

  const existingInput = procMaterials
    .filter((m: any) => m.material_type === '投入')
    .reduce((s: number, m: any) => s + (Number(m.quantity) || 0), 0)
  const existingOutput = Number(current?.report_qty || 0)

  const save = async () => {
    if (!current || !activeProcess) return
    const inv = Number(input), outv = Number(output)
    if (!inv || inv <= 0) { Toast.show({ content: '请填投入数量', icon: 'fail' }); return }
    try {
      const r: any = await api.post('/production/process-materials', {
        report_order_id: current.report_order_id, process_id: activeProcess.process_id,
        material_type: '投入', quantity: inv, remarks: '',
      })
      Toast.show({ content: '已保存投入', icon: 'success' })
      setMaterials((prev: any[]) => {
        const r2 = r.data || {}
        return [...prev, { ...r2, id: r2.material_id || Date.now(), process_id: activeProcess.process_id }]
      })
      setInput('')
    } catch (e: any) { Toast.show({ content: e?.message || '保存失败', icon: 'fail' }) }
  }

  return (
    <Section title={`${activeProcess.process_name} · 投入/产出`}>
      <Stat label="已投入" value={existingInput} unit="件" />
      <Stat label="工单报工" value={existingOutput} unit="件" />
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#666' }}>新投入</label>
        <input
          type="number" value={input} onChange={e => setInput(e.target.value)}
          placeholder="数量"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 15 }}
        />
        <Button color="primary" size="small" onClick={save}>保存</Button>
      </div>
      {!isFirstProcess && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#aaa' }}>※ 第一道工序的投入数量将作为工单级投入量</div>
      )}
    </Section>
  )
}

// --- 不良记录 ---
function DefectPanel({ editable, rows, types, activeProcess, onAdd, onSave, onDel, onChange }: any) {
  return (
    <Section title={`${activeProcess.process_name} · 生产不良（${rows.length}）`}>
      {!editable && <ReadonlyBanner />}
      {types.length === 0 && (
        <div style={{ fontSize: 12, color: '#999', padding: 10 }}>该工序无可用不良项目</div>
      )}
      {editable && types.length > 0 && (
        <Button size="mini" color="primary" onClick={onAdd} style={{ marginBottom: 10 }}>+ 添加不良</Button>
      )}
      {rows.length === 0 ? (
        <EmptyTip text="暂无不良记录" />
      ) : (
        rows.map((row: any, i: number) => {
          const selectedType = types.find((t: any) => String(t.defect_id) === String(row.defect_type_id))
          return (
            <div key={row.id || i} style={{ borderTop: '1px solid #f0f0f0', padding: '10px 0' }}>
              <SelectField
                label="不良类型"
                value={String(row.defect_type_id || '')}
                options={types.map((t: any) => ({ label: `${t.defect_code} ${t.defect_name}`, value: String(t.defect_id) }))}
                disabled={!editable}
                onChange={(v) => {
                  const t = types.find((x: any) => String(x.defect_id) === v)
                  onChange(row, { defect_type_id: v, defect_code: t?.defect_code, defect_name: t?.defect_name })
                }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <label style={{ fontSize: 13, color: '#666' }}>数量</label>
                <input
                  type="number" min={0} value={Number(row.quantity || 0)}
                  disabled={!editable}
                  onChange={(e) => onChange(row, { quantity: Number(e.target.value) || 0 })}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8,
                    border: '1px solid #e0e0e0', fontSize: 15,
                    background: !editable ? '#f5f5f5' : '#fff',
                  }}
                />
                {editable && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="mini" color="primary" onClick={() => onSave(row)}>保存</Button>
                    <Button size="mini" fill="outline" onClick={() => onDel(row)}>删</Button>
                  </div>
                )}
              </div>
              {selectedType?.defect_type && (
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>分类: {selectedType.defect_type}</div>
              )}
            </div>
          )
        })
      )}
    </Section>
  )
}

// --- 投料 ---
function MaterialPanel({ editable, rows, activeProcess, isFirstProcess, current, setMaterials }: any) {
  const [code, setCode] = useState('')
  const [qty, setQty] = useState('')
  const [type, setType] = useState<'投入' | '退回'>('投入')

  const save = async () => {
    if (!current || !activeProcess) return
    if (!qty || Number(qty) <= 0) { Toast.show({ content: '数量 > 0', icon: 'fail' }); return }
    if (!isFirstProcess && type === '退回') {
      Toast.show({ content: '退回仅支持第一道工序', icon: 'fail' }); return
    }
    try {
      const r: any = await api.post('/production/process-materials', {
        report_order_id: current.report_order_id, process_id: activeProcess.process_id,
        material_code: code, material_name: '', material_type: type,
        quantity: Number(qty), remarks: '',
      })
      const d = r.data || {}
      setMaterials((prev: any[]) => [...prev, { ...d, id: d.material_id || Date.now(), process_id: activeProcess.process_id }])
      Toast.show({ content: '已保存', icon: 'success' }); setCode(''); setQty('')
    } catch (e: any) { Toast.show({ content: e?.message || '失败', icon: 'fail' }) }
  }

  return (
    <Section title={`${activeProcess.process_name} · 投料记录（${rows.length}）`}>
      {!editable && <ReadonlyBanner />}
      {editable && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 0' }}>
          <SelectField
            label="类型"
            value={type}
            options={[
              { label: '投入', value: '投入' },
              ...(isFirstProcess ? [{ label: '退回', value: '退回' }] : []),
            ]}
            onChange={(v: any) => setType(v)}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              placeholder="料号/说明" value={code} onChange={e => setCode(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14 }}
            />
            <input
              type="number" placeholder="数量" value={qty} onChange={e => setQty(e.target.value)}
              style={{ width: 100, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14 }}
            />
            <Button size="small" color="primary" onClick={save}>添加</Button>
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyTip text="暂无投料" />
      ) : (
        rows.map((m: any) => (
          <div key={m.id} style={{ borderTop: '1px solid #f0f0f0', padding: '8px 0', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: m.material_type === '退回' ? '#f44336' : '#2196F3', fontWeight: 600 }}>
                [{m.material_type}] {m.material_code || m.material_name || '—'}
              </span>
              <span style={{ fontWeight: 600 }}>×{m.quantity}</span>
            </div>
          </div>
        ))
      )}
    </Section>
  )
}

// --- 检验报废 ---
function ScrapPanel({ editable, rows, types, current, setScraps }: any) {
  const [defectTypeId, setDefectTypeId] = useState<string>('')
  const [qty, setQty] = useState('')

  const save = async () => {
    if (!current) return
    if (!defectTypeId) { Toast.show({ content: '请选报废项目', icon: 'fail' }); return }
    if (!qty || Number(qty) <= 0) { Toast.show({ content: '数量 > 0', icon: 'fail' }); return }
    try {
      const r: any = await api.post('/production/scrap-defects', {
        report_order_id: current.report_order_id, defect_type_id: Number(defectTypeId), quantity: Number(qty),
      })
      const d = r.data || {}
      setScraps((prev: any[]) => [...prev, { ...d, id: d.scrap_id || Date.now() }])
      Toast.show({ content: '已保存', icon: 'success' }); setQty(''); setDefectTypeId('')
    } catch (e: any) { Toast.show({ content: e?.message || '失败', icon: 'fail' }) }
  }

  return (
    <Section title={`检验报废（工单级 · ${rows.length}）`}>
      {!editable && <ReadonlyBanner />}
      {editable && types.length > 0 && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 0' }}>
          <SelectField
            label="报废项目"
            value={defectTypeId}
            options={types.map((t: any) => ({ label: `${t.defect_code} ${t.defect_name}`, value: String(t.defect_id) }))}
            onChange={setDefectTypeId}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number" placeholder="数量" value={qty} onChange={e => setQty(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14 }}
            />
            <Button size="small" color="primary" onClick={save}>添加</Button>
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyTip text="暂无报废" />
      ) : (
        rows.map((s: any) => (
          <div key={s.id} style={{ borderTop: '1px solid #f0f0f0', padding: '8px 0', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>{s.defect_name || s.defect_type || '—'}</span>
            <span style={{ color: '#f44336', fontWeight: 600 }}>×{s.quantity}</span>
          </div>
        ))
      )}
    </Section>
  )
}

// --- 人员工时 ---
function ManpowerPanel({ editable, manpower, current, setManpower }: any) {
  const [skilled, setSkilled] = useState<number>(0)
  const [general, setGeneral] = useState<number>(0)
  const [labor, setLabor] = useState<number>(0)
  const [other, setOther] = useState<number>(0)

  useEffect(() => {
    if (manpower) {
      setSkilled(Number(manpower.skilled_count || 0))
      setGeneral(Number(manpower.general_count || 0))
      setLabor(Number(manpower.labor_count || 0))
      setOther(Number(manpower.other_count || 0))
    }
  }, [manpower])

  const save = async () => {
    if (!current) return
    const total = skilled + general + labor + other
    if (total <= 0) { Toast.show({ content: '请填至少一项人数', icon: 'fail' }); return }
    const payload = {
      report_order_id: current.report_order_id,
      skilled_count: skilled, general_count: general,
      labor_count: labor, other_count: other,
    }
    try {
      let r: any
      if (manpower?.record_id) {
        r = await api.put(`/production/manpower-records/${manpower.record_id}`, payload)
      } else {
        r = await api.post('/production/manpower-records', payload)
      }
      const d = (r as any).data || manpower || {}
      setManpower({ ...d, id: d.record_id || d.id })
      Toast.show({ content: '已保存', icon: 'success' })
    } catch (e: any) { Toast.show({ content: e?.message || '失败', icon: 'fail' }) }
  }

  return (
    <Section title="人员工时（改人数即可，工时自动算）">
      {!editable && <ReadonlyBanner />}
      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
        开工时间: {current?.report_time?.slice(0, 16) || '—'}
      </div>
      <NumField label="技工" value={skilled} onChange={setSkilled} disabled={!editable} />
      <NumField label="普工" value={general} onChange={setGeneral} disabled={!editable} />
      <NumField label="劳务" value={labor} onChange={setLabor} disabled={!editable} />
      <NumField label="其他" value={other} onChange={setOther} disabled={!editable} />
      {editable && <Button color="primary" size="small" block onClick={save} style={{ marginTop: 12 }}>保存人员配置</Button>}
    </Section>
  )
}

// ============= 通用小组件 =============
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '12px 14px',
      marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    }}>
      <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}
function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#2196F3' }}>{value}{unit}</span>
    </div>
  )
}
function EmptyTip({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: 20, color: '#bbb', fontSize: 12 }}>— {text} —</div>
}
function ReadonlyBanner() {
  return (
    <div style={{
      background: '#f5f5f5', color: '#999', fontSize: 11, padding: '6px 10px',
      borderRadius: 6, marginBottom: 10, textAlign: 'center',
    }}>报工单已完工 · 只读</div>
  )
}
function NumField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <span style={{ width: 50, fontSize: 13, color: '#666' }}>{label}</span>
      <input
        type="number" min={0} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{
          flex: 1, padding: '8px 12px', borderRadius: 8,
          border: '1px solid #e0e0e0', fontSize: 15, background: disabled ? '#f5f5f5' : '#fff',
        }}
      />
    </div>
  )
}
function SelectField({ label, value, options, onChange, disabled }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 60, fontSize: 13, color: '#666' }}>{label}</span>
      <select
        value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1, padding: '10px 12px', borderRadius: 8,
          border: '1px solid #e0e0e0', fontSize: 14, background: '#fff',
        }}
      >
        <option value="">请选择</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ============= 阶段1：工单选择 =============
function SelectPhase({ orders, openReports, loading, onStart, onEnter }: any) {
  return (
    <div className="mobile-page-fixed-header">
      <div className="mobile-sticky-header">
        <div style={{ fontWeight: 600, fontSize: 16, padding: '8px 0' }}>选择或创建报工单</div>
      </div>
      <div className="mobile-page-scroll-list">
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>}

        {/* 已开工 */}
        {openReports.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#888', padding: '4px 4px 6px', fontWeight: 600 }}>
              🔥 已开工（{openReports.length}）
            </div>
            {openReports.map((r: ReportOrder) => (
              <div key={r.report_order_id} onClick={() => onEnter(r)} style={selectCard('#2196F3')}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{r.report_no}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#2196F315', color: '#2196F3' }}>开工</span>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{r.order_no} · {r.material_code}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>📍 {r.line_name} · 报工{r.report_qty}</div>
              </div>
            ))}
          </div>
        )}

        {/* 待开工 */}
        <div style={{ fontSize: 12, color: '#888', padding: '8px 4px 6px', fontWeight: 600 }}>
          📋 待开工订单（{orders.length}）
        </div>
        {orders.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>
            暂无可开工订单，请先在 PC 端下发生产订单
          </div>
        )}
        {orders.map((o: OrderRow) => {
          const hasOpen = openReports.some(r => r.order_id === o.order_id && String(r.status ?? 0) !== '1')
          return (
            <div key={o.order_id} style={selectCard('#FF9800')}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{o.order_no}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#FF980015', color: '#FF9800' }}>{o.status}</span>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6, wordBreak: 'break-all' }}>
                {o.material_code} · {o.material_name}
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                计划 {o.planned_qty} · 已报 {o.finished_qty ?? 0}
              </div>
              <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                {hasOpen ? (
                  <Button size="mini" color="primary" onClick={() => {
                    const r = openReports.find(x => x.order_id === o.order_id && String(x.status ?? 0) !== '1')
                    if (r) onEnter(r)
                  }}>进入报工</Button>
                ) : (
                  <Button size="mini" color="primary" onClick={() => onStart(o)}>开工</Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const selectCard = (color: string): React.CSSProperties => ({
  background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  borderLeft: `3px solid ${color}`, cursor: 'pointer',
})
