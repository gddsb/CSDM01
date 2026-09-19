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
  const [activeProcId, setActiveProcId] = useState<number | null>(null)

  // 工序报工组内部 Tab: defect | material
  const [processTab, setProcessTab] = useState<'defect' | 'material'>('defect')
  // 工单报工组内部 Tab: scrap | exception | manpower
  const [reportTab, setReportTab] = useState<'scrap' | 'exception' | 'manpower'>('scrap')

  // 全量记录（SubPanel 各自按 process_id 过滤）
  const [defects, setDefects] = useState<DefectRow[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [scraps, setScraps] = useState<ScrapRow[]>([])
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [manpower, setManpower] = useState<ManpowerRow | null>(null)

  // 字典预加载
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([])
  const [scrapTypes, setScrapTypes] = useState<DefectType[]>([])
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
    setProcessTab('defect')
    setReportTab('scrap')
    try {
      // 工序
      const procs: any = await api.get(`/production/report-orders/${report.report_order_id}/processes`)
      const plist = ((procs?.data || []) as ProcessRow[]).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      setProcesses(plist)
      if (plist.length > 0) setActiveProcId(plist[0].process_id)

      // 全量记录
      const [dr, mr, sr, er, pr]: any[] = await Promise.all([
        api.get('/production/process-defects', { params: { report_order_id: report.report_order_id, pageSize: 500 } }),
        api.get('/production/process-materials', { params: { report_order_id: report.report_order_id, pageSize: 500 } }),
        api.get('/production/scrap-defects', { params: { report_order_id: report.report_order_id, pageSize: 200 } }),
        api.get('/production/process-exceptions', { params: { report_order_id: report.report_order_id, pageSize: 200 } }),
        api.get('/production/manpower-records', { params: { report_order_id: report.report_order_id, pageSize: 1 } }),
      ])
      const _arr = (r: any) => (r?.data?.items || r?.data || []) as any[]
      setDefects(_arr(dr) as DefectRow[])
      setMaterials(_arr(mr) as MaterialRow[])
      setScraps(_arr(sr) as ScrapRow[])
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
      setDefects([]); setMaterials([]); setScraps([]); setExceptions([])
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

      {/* ========== ② 工序报工组 ========== */}
      <SectionDivider title="🔧 工序报工（分工序）" color="#1890ff" />

      {/* 工序 Select */}
      <div style={{
        background: '#fff', padding: '10px 14px', borderBottom: '1px solid #eef0f3',
      }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>当前工序</div>
        <select
          value={activeProcId || ''}
          onChange={(e) => setActiveProcId(e.target.value ? Number(e.target.value) : null)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #d9d9d9', fontSize: 14, background: '#fff',
          }}
        >
          {processes.map(p => (
            <option key={p.process_id} value={p.process_id}>
              {p.sort_order}. {p.process_name} {p.must_report ? '（必报）' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 工序内部 Tab：不良 / 投料 */}
      <div style={{ background: '#fff', marginTop: 1 }}>
        <Tabs activeKey={processTab} onChange={(k) => setProcessTab(k as any)}>
          <Tabs.Tab title="不良" key="defect" />
          <Tabs.Tab title="投料" key="material" />
        </Tabs>
        <div style={{ padding: 12 }}>
          {processTab === 'defect' && (
            <ProcessDefectPanel
              report={current}
              activeProcessId={activeProcId}
              editable={!!editable}
              defectTypes={defectTypes}
              allDefects={defects}
              setAllDefects={setDefects}
            />
          )}
          {processTab === 'material' && (
            <ProcessMaterialPanel
              report={current}
              activeProcessId={activeProcId}
              editable={!!editable}
              materials={materialsMaster}
              allMaterials={materials}
              setAllMaterials={setMaterials}
            />
          )}
        </div>
      </div>

      {/* ========== ③ 工单报工组 ========== */}
      <SectionDivider title="📊 工单报工（全流程）" color="#722ed1" />

      <div style={{ background: '#fff', marginTop: 1 }}>
        <Tabs activeKey={reportTab} onChange={(k) => setReportTab(k as any)}>
          <Tabs.Tab title="报废" key="scrap" />
          <Tabs.Tab title="工时" key="exception" />
          <Tabs.Tab title="人员" key="manpower" />
        </Tabs>
        <div style={{ padding: 12 }}>
          {reportTab === 'scrap' && (
            <ScrapPanel
              report={current}
              editable={!!editable}
              scrapTypes={scrapTypes}
              rows={scraps}
              setRows={setScraps}
            />
          )}
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

      <div style={{ height: 40 }} />
    </div>
  )
}

// ========== 小组件 ==========

function Header({ report, onBack, onFinish }: { report: ReportOrder; onBack: () => void; onFinish: () => void }) {
  const statusText = { '开工': '生产中', '完工': '已完工', '关闭': '已关闭', '下发': '已下发', '开立': '待开工' }[String(report.status)] || String(report.status)
  return (
    <div style={{
      background: 'linear-gradient(135deg,#1890ff,#096dd9)', color: '#fff',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>📝 {report.report_no}</div>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 10,
          background: statusText === '已完工' ? '#52c41a' : statusText === '生产中' ? '#faad14' : 'rgba(255,255,255,.25)',
        }}>{statusText}</span>
      </div>
      <div style={{ fontSize: 12, opacity: .9 }}>
        订单 {report.order_no} · {report.line_name}
      </div>
      <div style={{ fontSize: 12, opacity: .9, marginTop: 2 }}>
        {report.material_code} {report.material_name} · 报工 {report.report_qty}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button size="mini" fill="outline" color="white" onClick={onBack}>← 返回</Button>
        {String(report.status) !== '4' && String(report.status) !== '已完工' && (
          <Button size="mini" color="danger" onClick={onFinish} style={{ background: '#ff4d4f' }}>✓ 完工</Button>
        )}
      </div>
    </div>
  )
}

function StatsBar({ stats, reportQty }: { stats: ReturnType<typeof calcReportStats>; reportQty: number }) {
  const items = [
    { label: '报工数量', value: reportQty, color: '#2196F3' },
    { label: '合格数量', value: stats.expectedOutput > 0 ? Number(stats.expectedOutput.toFixed(1)) : 0, color: '#52c41a' },
    { label: '制程不良', value: stats.defectProcess, color: '#fa8c16' },
    { label: '来料不良', value: stats.defectMaterial, color: '#faad14' },
    { label: '报废数量', value: stats.defectScrap, color: '#f5222d' },
    { label: '异常工时', value: `${((stats.exceptionHours || 0) / 60).toFixed(1)}H`, color: '#eb2f96' },
  ]
  return (
    <div style={{
      background: '#fff', margin: '10px 10px 0', borderRadius: 10, padding: '10px 12px',
      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
    }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>📊 报工单汇总</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 4px' }}>
        {items.map((it) => (
          <div key={it.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: it.color }}>{it.value}</div>
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{it.label}</div>
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
