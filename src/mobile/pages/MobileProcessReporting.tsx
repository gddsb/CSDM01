/**
 * 移动报工主页面 — 职责：阶段切换 + 数据加载 + 布局
 * 各 Tab 的业务逻辑（新增/编辑/删除/图片上传）已抽到 reporting/ 目录下 6 个独立 SubPanel
 *
 * 页面结构（按需求 v2）：
 *   ┌─ 工单信息 + 报工统计（顶部）
 *   ├─ 工序报工（分组容器，工序 Select + [不良][投料] 两 Tab）
 *   ├─ 工单报工（分组容器，[报废][工时][人员] 三 Tab）
 *   └─ 完工/返回 按钮
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dialog, Toast, Button, Tabs, Badge } from 'antd-mobile'
import api from '../../utils/api'
import { calcReportStats } from '../../pages/production/reportStats'

// SubPanel
import { ProcessDefectPanel } from './reporting/ProcessDefectPanel'
import { ProcessMaterialPanel } from './reporting/ProcessMaterialPanel'
import { ScrapPanel } from './reporting/ScrapPanel'
import { ExceptionPanel } from './reporting/ExceptionPanel'
import { ManpowerPanel } from './reporting/ManpowerPanel'

// 共享类型（集中导出）
import type {
  ProcessRow, ReportOrder, OrderRow, DefectType, MaterialMaster,
  DefectRow, MaterialRow, ScrapRow, ExceptionRow, ManpowerRow,
} from './reporting/types'

// ============ 主组件 ============
export default function MobileProcessReporting() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const urlOrderId = sp.get('orderId')

  // 阶段：select（选工单）→ reporting（报工）
  const [phase, setPhase] = useState<'select' | 'reporting'>('select')

  // ========== 阶段1：工单选择 ==========
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [current, setCurrent] = useState<ReportOrder | null>(null)

  // ========== 阶段2：报工数据 ==========
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  // 三个独立工序选择器（不良/物料/报废 Tab 各自维护，互不影响）
  const [defectProcId, setDefectProcId] = useState<number | null>(null)
  const [materialProcId, setMaterialProcId] = useState<number | null>(null)
  const [scrapProcId, setScrapProcId] = useState<number | null>(null)

  // 一级 Tab: process（工序报工）| report（工单报工）
  const [groupTab, setGroupTab] = useState<'process' | 'report'>('process')
  // 工序报工内部 Tab: defect | material | scrap（检验报废移到这里）
  const [processTab, setProcessTab] = useState<'defect' | 'material' | 'scrap'>('defect')
  // 工单报工内部 Tab: exception | manpower（报废已移到工序记录）
  const [reportTab, setReportTab] = useState<'exception' | 'manpower'>('exception')

  // 全量记录（SubPanel 各自按 process_id 过滤）
  // 🔑 注意：defectsRaw 是 ProcessDefect 全量（不良+报废共用同一张表），前端按 scrapTypes 字典分类
  const [defectsRaw, setDefectsRaw] = useState<DefectRow[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [manpower, setManpower] = useState<ManpowerRow | null>(null)

  // 字典预加载
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([])
  const [scrapTypes, setScrapTypes] = useState<DefectType[]>([])

  // 🔑 从全量 ProcessDefect 里按字典派生工序不良 / 检验报废
  const scrapDefectIds = useMemo(() => new Set(scrapTypes.map(t => t.defect_id)), [scrapTypes])
  const defects = useMemo(() => defectsRaw.filter(d => !scrapDefectIds.has(Number(d.defect_type_id))), [defectsRaw, scrapDefectIds])
  const scraps = useMemo(() => defectsRaw.filter(d => scrapDefectIds.has(Number(d.defect_type_id))), [defectsRaw, scrapDefectIds])
  const [materialsMaster, setMaterialsMaster] = useState<MaterialMaster[]>([])

  // ========== 阶段1 加载：生产订单 ==========
  useEffect(() => {
    if (phase !== 'select') return
    ;(async () => {
      try {
        const res: any = await api.get('/production/orders', { params: { status: '开工', pageSize: 50 } })
        const list = (res?.data?.items || res?.data || []) as OrderRow[]
        const started = list.filter(o => o.status === '开工')
        setOrders(started)

        // URL 带 orderId 自动开工
        if (urlOrderId) {
          const order = started.find(o => String(o.order_id) === String(urlOrderId))
          if (order) await handleStartNew(order)
        }
      } catch (e) { /* 静默 */ }
    })()
  }, [phase, urlOrderId])

  // ========== 字典预加载 ==========
  useEffect(() => {
    ;(async () => {
      try {
        const [dtr, mtr] = await Promise.all([
          api.get('/basic/defect-types', { params: { pageSize: 500 } }) as Promise<any>,
          api.get('/basic/materials', { params: { page: 1, pageSize: 1000 } }) as Promise<any>,
        ])
        const dt = (dtr?.data?.items || dtr?.data || []) as DefectType[]
        const mt = (mtr?.data?.items || mtr?.data || []) as MaterialMaster[]
        // 工序不良类型
        setDefectTypes(dt.filter(t => t.category_name === '制程检验类型' && t.defect_type !== '检验报废'))
        // 报废类型
        setScrapTypes(dt.filter(t => t.defect_type === '检验报废' || t.category_name === '报废类型'))
        setMaterialsMaster(mt)
      } catch { /* 静默 */ }
    })()
  }, [])

  // ========== 开工创建报工单 ==========
  const handleStartNew = async (order: OrderRow) => {
    try {
      // 检查是否已有报工单
      const exist: any = await api.get('/production/report-orders', { params: { order_id: order.order_id, status: '生产中', pageSize: 1 } })
      const activeReport = (exist?.data?.items || exist?.data || [])[0]
      if (activeReport) {
        await enterReporting(activeReport)
        return
      }
      Toast.show({ content: '正在创建报工单...', icon: 'loading' })
      const create: any = await api.post('/production/report-orders', {
        order_id: order.order_id, line_id: order.line_id, report_qty: order.finished_qty || order.planned_qty,
      })
      if (!create?.success) throw new Error(create?.message || '创建失败')
      Toast.show({ content: '报工单已创建', icon: 'success' })
      await enterReporting(create.data)
    } catch (e: any) {
      Toast.show({ content: e?.message || '开工失败', icon: 'fail' })
    }
  }

  // ========== 进入报工：拉全量数据 ==========
  const enterReporting = async (report: ReportOrder) => {
    setCurrent(report)
    setPhase('reporting')
    setGroupTab('process')
    setProcessTab('defect')
    setReportTab('exception')
    try {
      // 工序
      const procs: any = await api.get(`/production/report-orders/${report.report_order_id}/processes`)
      const plist = ((procs?.data || []) as ProcessRow[]).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      setProcesses(plist)
      if (plist.length > 0) {
        const first = plist[0].process_id
        setDefectProcId(first)
        setMaterialProcId(first)
        setScrapProcId(first)
      }

      // 全量记录（报废也走 process-defects，前端按 scrapTypes 字典分类）
      const [dr, mr, er, pr]: any[] = await Promise.all([
        api.get('/production/process-defects', { params: { report_order_id: report.report_order_id, pageSize: 500 } }),
        api.get('/production/process-materials', { params: { report_order_id: report.report_order_id, pageSize: 500 } }),
        api.get('/production/process-exceptions', { params: { report_order_id: report.report_order_id, pageSize: 200 } }),
        api.get('/production/manpower-records', { params: { report_order_id: report.report_order_id, pageSize: 1 } }),
      ])
      const _arr = (r: any) => (r?.data?.items || r?.data || []) as any[]
      // 🔑 后端 include DefectType 后，defect_type 是对象不是字符串，前端渲染会崩溃（React #31）
      // 这里统一归一化：defect_type 取字符串，同时取出关联的 defect_code/defect_name
      setDefectsRaw(_arr(dr).map((d: any) => {
        const dt = d.defect_type
        if (dt && typeof dt === 'object') {
          return {
            ...d,
            defect_type_id: d.defect_type_id ?? dt.defect_id,
            defect_code: d.defect_code ?? dt.defect_code,
            defect_name: d.defect_name ?? dt.defect_name,
            defect_type: dt.defect_type ?? dt.category_name ?? '',   // ← 关键：对象→字符串
            defect_unit: d.defect_unit ?? dt.defect_unit,
          }
        }
        return d
      }) as DefectRow[])
      setMaterials(_arr(mr) as MaterialRow[])
      setExceptions(_arr(er) as ExceptionRow[])
      setManpower((_arr(pr)[0] || null) as ManpowerRow | null)
    } catch { /* 静默 */ }
  }

  // ========== 完工 ==========
  const finishReport = useCallback(async () => {
    if (!current) return
    const ok = await Dialog.confirm({
      content: `确认完工 ${current.report_no}？完工后不可撤销。`,
      confirmText: '确认完工', cancelText: '继续报工',
    })
    if (!ok) return
    try {
      const r: any = await api.post(`/production/report-orders/${current.report_order_id}/close`)
      if (!r?.success) throw new Error(r?.message || '完工失败')
      Toast.show({ content: '✅ 已完工', icon: 'success' })
      setCurrent(null); setPhase('select')
      setDefectsRaw([]); setMaterials([]); setExceptions([]); setManpower(null)
    } catch (e: any) {
      Toast.show({ content: e?.message || '完工失败', icon: 'fail' })
    }
  }, [current])

  // ========== 报工统计（复用 PC 端纯函数） ==========
  const stats = useMemo(() => calcReportStats({
    defects, scraps, exceptions, materials,
    manpowers: manpower ? [manpower] : [],
    lineProcesses: processes,
    selectedReport: current ? { ...current, status: current.status != null ? String(current.status) : null } : null,
  }), [defects, scraps, exceptions, materials, manpower, processes, current])

  const editable = useMemo(() => current && String(current.status) !== '已完工' && String(current.status) !== '4', [current])

  // ========== 渲染 ==========
  if (phase === 'select') {
    return (
      <div style={{ padding: 16, background: '#f5f6fa', minHeight: '100vh' }}>
        <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#333' }}>📋 选择开工订单</h2>
        {orders.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: 30 }}>— 暂无开工订单 —</div>}
        {orders.map((o) => (
          <div key={o.order_id} style={{
            background: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
            border: '1px solid #eef0f3',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{o.order_no}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{o.material_code} · {o.material_name}</div>
              </div>
              <Badge content={`${o.finished_qty}/${o.planned_qty}`} style={{ '--right': '-4px', '--top': '-4px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button size="mini" color="primary" onClick={() => handleStartNew(o)}>▶ 开工报工</Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!current) return null

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh' }}>
      {/* ========== ① 工单信息 + 报工统计 ========== */}
      <Header report={current} onBack={() => { setCurrent(null); setPhase('select') }} onFinish={finishReport} />
      <StatsBar stats={stats} reportQty={current.report_qty || 0} />

      {/* ========== 报工区域（一个卡片 + 两个一级 Tab） ========== */}
      <div style={{
        background: '#fff', margin: '8px 10px', borderRadius: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,.04)', overflow: 'hidden',
      }}>
        {/* 一级 Tab：工序报工 / 工单报工 */}
        <Tabs
          activeKey={groupTab}
          onChange={(k) => setGroupTab(k as any)}
          style={{ background: '#fafafa' }}
        >
          <Tabs.Tab title="🔧 工序记录" key="process" />
          <Tabs.Tab title="📊 工单记录" key="report" />
        </Tabs>

        {/* === 工序报工 Tab === */}
        {groupTab === 'process' && (
          <div>
            {/* 工序内部 Tab：不良记录 / 物料记录 / 检验报废 */}
            <Tabs activeKey={processTab} onChange={(k) => setProcessTab(k as any)}>
              <Tabs.Tab title="不良记录" key="defect" />
              <Tabs.Tab title="物料记录" key="material" />
              <Tabs.Tab title="检验报废" key="scrap" />
            </Tabs>
            <div style={{ padding: 10 }}>
              {processTab === 'defect' && (
                <>
                  <ProcessSelector
                    processes={processes}
                    activeProcId={defectProcId}
                    onChange={setDefectProcId}
                  />
                  <ProcessDefectPanel
                    report={current}
                    activeProcessId={defectProcId}
                    editable={!!editable}
                    defectTypes={defectTypes}
                    allDefects={defects}
                    // 🔑 defects 是 defectsRaw 的不良子集，包一层只改不良不碰报废
                    setAllDefects={(updater) => setDefectsRaw(prev => {
                      const scrap = prev.filter(d => scrapDefectIds.has(Number(d.defect_type_id)))
                      const nonScrap = prev.filter(d => !scrapDefectIds.has(Number(d.defect_type_id)))
                      return [...updater(nonScrap), ...scrap]
                    })}
                  />
                </>
              )}
              {processTab === 'material' && (
                <>
                  <ProcessSelector
                    processes={processes}
                    activeProcId={materialProcId}
                    onChange={setMaterialProcId}
                  />
                  <ProcessMaterialPanel
                    report={current}
                    activeProcessId={materialProcId}
                    editable={!!editable}
                    materials={materialsMaster}
                    allMaterials={materials}
                    setAllMaterials={setMaterials}
                  />
                </>
              )}
              {processTab === 'scrap' && (
                <>
                  <ProcessSelector
                    processes={processes}
                    activeProcId={scrapProcId}
                    onChange={setScrapProcId}
                  />
                  <ScrapPanel
                    report={current}
                    activeProcessId={scrapProcId}
                    processes={processes}
                    editable={!!editable}
                    scrapTypes={scrapTypes}
                    rows={scraps}
                    // 🔑 scraps 是 defectsRaw 按 scrapDefectIds 过滤的派生数据，改全量即可联动
                    setRows={(updater) => setDefectsRaw((prev) => {
                      const before = prev.filter(d => !scrapDefectIds.has(Number(d.defect_type_id)))
                      const scrapRows = prev.filter(d => scrapDefectIds.has(Number(d.defect_type_id))) as unknown as ScrapRow[]
                      const merged = updater(scrapRows)
                      // 把更新后的 merged 转成 DefectRow 拼回去
                      const mergedDefects: DefectRow[] = merged.map((s) => ({
                        id: s.scrap_id ?? s.id,
                        defect_id: s.scrap_id ?? (s.id as number | undefined),
                        report_order_id: s.report_order_id,
                        process_id: processes.find(p => p.process_id === scrapProcId)?.process_id,
                        defect_type_id: s.defect_type_id,
                        defect_code: s.defect_code,
                        defect_name: s.defect_name,
                        defect_type: s.defect_type,
                        quantity: s.quantity,
                      }))
                      return [...before, ...mergedDefects]
                    })}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* === 工单记录 Tab（只剩工时 + 人员，报废已移到工序记录） === */}
        {groupTab === 'report' && (
          <div>
            <Tabs activeKey={reportTab} onChange={(k) => setReportTab(k as any)}>
              <Tabs.Tab title="工时记录" key="exception" />
              <Tabs.Tab title="人员记录" key="manpower" />
            </Tabs>
            <div style={{ padding: 10 }}>
              {reportTab === 'exception' && (
                <ExceptionPanel
                  report={current}
                  editable={!!editable}
                  rows={exceptions}
                  setRows={setExceptions}
                />
              )}
              {reportTab === 'manpower' && (
                <ManpowerPanel
                  report={current}
                  editable={!!editable}
                  manpower={manpower}
                  setManpower={setManpower}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}

// ========== 小组件 ==========

function Header({ report, onBack, onFinish }: { report: ReportOrder; onBack: () => void; onFinish: () => void }) {
  const statusText = { '开工': '生产中', '完工': '已完工', '关闭': '已关闭', '下发': '已下发', '开立': '待开工' }[String(report.status)] || String(report.status)
  const isDone = String(report.status) === '4' || String(report.status) === '已完工'
  return (
    <div style={{
      background: 'linear-gradient(135deg,#1890ff,#096dd9)', color: '#fff',
      padding: '12px 14px',
    }}>
      {/* 行1：编号 + 状态 + 返回/完工按钮 同一行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>📝 {report.report_no}</span>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
          background: isDone ? '#52c41a' : statusText === '生产中' ? '#faad14' : 'rgba(255,255,255,.25)',
        }}>{statusText}</span>
        <div style={{ flex: 1 }} />
        <Button size="mini" fill="outline" color="white" onClick={onBack}>返回</Button>
        {!isDone && (
          <Button size="mini" color="danger" onClick={onFinish} style={{ background: '#ff4d4f' }}>完工</Button>
        )}
      </div>
      {/* 行2：订单 + 产线 */}
      <div style={{ fontSize: 11, opacity: .85, marginTop: 4 }}>
        订单 {report.order_no} · {report.line_name}
      </div>
      {/* 行3：料号 + 报工数量 */}
      <div style={{ fontSize: 11, opacity: .85, marginTop: 1 }}>
        {report.material_code} {report.material_name} · 报工 {report.report_qty}
      </div>
    </div>
  )
}

function StatsBar({ stats, reportQty }: { stats: ReturnType<typeof calcReportStats>; reportQty: number }) {
  // 一行 6 项：报工/投入 各 8ch，其余 4 项 flex:1 平均宽度
  const items: Array<{ label: string; value: number | string; color: string; width?: string | number }> = [
    { label: '报工数量', value: reportQty, color: '#2196F3', width: '8ch' },
    { label: '投入数量', value: stats.inputQty || 0, color: '#1890ff', width: '8ch' },
    { label: '来料不良', value: stats.defectMaterial, color: '#faad14' },
    { label: '制程不良', value: stats.defectProcess, color: '#fa8c16' },
    { label: '检验报废', value: stats.defectScrap, color: '#f5222d' },
    { label: '异常工时', value: `${((stats.exceptionHours || 0) / 60).toFixed(1)}H`, color: '#eb2f96' },
  ]
  return (
    <div style={{
      background: '#fff', margin: '10px 10px 0', borderRadius: 10, padding: '10px 12px',
      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
    }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>📊 报工单汇总</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
        {items.map(it => (
          <div
            key={it.label}
            style={{
              width: it.width ?? undefined,
              flex: it.width ? 'none' : 1,
              textAlign: 'center',
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: it.color, whiteSpace: 'nowrap' }}>{it.value}</div>
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, whiteSpace: 'nowrap' }}>{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionDivider({ title, color }: { title: string; color: string }) {
  return (
    <div style={{
      padding: '14px 12px 6px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ width: 4, height: 16, background: color, borderRadius: 2 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{title}</div>
    </div>
  )
}

/**
 * 工序选择器 — 必报工序 option 带前缀 "*"，选中后右侧显示红色 [必报] 徽章
 */
function ProcessSelector({
  processes, activeProcId, onChange,
}: {
  processes: ProcessRow[]
  activeProcId: number | null
  onChange: (id: number | null) => void
}) {
  const current = processes.find(p => p.process_id === activeProcId)
  return (
    <div style={{
      padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>工序</span>
      <select
        value={activeProcId || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        style={{
          flex: 1, padding: '7px 10px', borderRadius: 6,
          border: '1px solid #ddd', fontSize: 13, background: '#fff',
        }}
      >
        {processes.map(p => (
          <option key={p.process_id} value={p.process_id}>
            {p.must_report ? '* ' : ''}{p.sort_order}. {p.process_name}
          </option>
        ))}
      </select>
      {current?.must_report && (
        <span style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 10,
          background: '#f44336', color: '#fff', fontWeight: 700, flexShrink: 0,
        }}>必报</span>
      )}
    </div>
  )
}
