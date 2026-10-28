/**
 * MobileDailyCard.tsx — 移动端生产日报卡（汇总指标）
 *
 * 数据源：GET /api/daily-report?date=&line=&shift=
 * 不做大表格，只展示核心汇总 + 快捷概览
 */
import { useEffect, useState, useCallback } from 'react'
import { Button, DatePicker } from 'antd-mobile'
import api from '../../utils/api'
import dayjs from 'dayjs'

interface ProductionRow {
  reportOrderId: number
  reportOrderNo: string
  materialName: string
  specification: string | null
  inputQty: number
  outputQty: number
  processDefect: number
  inspectionDefect: number
  edgeWeightKg: number | null
  skilledCount: number
  generalCount: number
  laborCount: number
  otherCount: number
  abnormalHours: number
  totalHours: number
}

interface DowntimeRow {
  stopCode: string
  description: string | null
  durationHours: number
}

interface DailyReportData {
  header: { date: string; line: string; shift: string }
  productionRows: ProductionRow[]
  downtime: DowntimeRow[]
}

const STOP_CODE_LABEL: Record<string, string> = {
  A: '停机待料', B: '换型换线', C: '制程调整', D: '故障维修', E: '其它异常',
}

function fmt(n: number | null | undefined, d = 0): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—'
  return Number(n).toFixed(d)
}

export default function MobileDailyCard() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DailyReportData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/daily-report', { params: { date } })
      setData(r.data?.data || r.data || null)
    } catch { /* 静默 */ }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: 12 }}>
      {/* 筛选 */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12,
        background: '#fff', padding: 10, borderRadius: 10,
      }}>
        <DatePicker
          value={new Date(date + 'T00:00:00')}
          min={new Date('2024-01-01')}
          max={new Date()}
          onChange={(v) => v && setDate(dayjs(v).format('YYYY-MM-DD'))}
          children={(items) => <Button size="mini">{items[0]}</Button>}
        />
        <Button size="mini" onClick={load} disabled={loading}>🔄</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>加载中…</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无日报数据</div>
      ) : (
        <DailyCardContent data={data} />
      )}
    </div>
  )
}

function DailyCardContent({ data }: { data: DailyReportData }) {
  const { header, productionRows, downtime } = data

  // 汇总
  const totalInput = productionRows.reduce((s, r) => s + r.inputQty, 0)
  const totalOutput = productionRows.reduce((s, r) => s + r.outputQty, 0)
  const totalProcessDefect = productionRows.reduce((s, r) => s + r.processDefect, 0)
  const totalInspectionDefect = productionRows.reduce((s, r) => s + r.inspectionDefect, 0)
  const totalEdge = productionRows.reduce((s, r) => s + (r.edgeWeightKg || 0), 0)
  const totalSkilled = productionRows.reduce((s, r) => s + r.skilledCount, 0)
  const totalGeneral = productionRows.reduce((s, r) => s + r.generalCount, 0)
  const totalLabor = productionRows.reduce((s, r) => s + r.laborCount, 0)
  const totalOther = productionRows.reduce((s, r) => s + r.otherCount, 0)
  const totalAbnormalHours = productionRows.reduce((s, r) => s + r.abnormalHours, 0)
  const totalHours = productionRows.reduce((s, r) => s + r.totalHours, 0)
  const totalDowntimeHours = downtime.reduce((s, r) => s + r.durationHours, 0)
  const longestStop = downtime.length > 0
    ? downtime.reduce((a, b) => (b.durationHours > a.durationHours ? b : a))
    : null

  return (
    <>
      {/* 产线/班次标识 */}
      <div style={{
        background: 'linear-gradient(135deg,#1890ff,#36cfc9)',
        color: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{header.date}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
          {header.line || '—'} · {header.shift || '—'}
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          共 {productionRows.length} 条完工报工单
        </div>
      </div>

      {/* ① 生产概览 */}
      <Section title="📦 生产概览">
        <div style={grid2Style}>
          <Metric label="投入数量" value={fmt(totalInput, 0)} unit="件" color="#1890ff" />
          <Metric label="入库数量" value={fmt(totalOutput, 0)} unit="件" color="#52c41a" />
          <Metric label="合格品" value={fmt(totalOutput - totalProcessDefect - totalInspectionDefect, 0)} unit="件" color="#52c41a" />
          <Metric label="料边重量" value={fmt(totalEdge, 2)} unit="kg" color="#8c8c8c" />
        </div>
      </Section>

      {/* ② 质量概览 */}
      <Section title="🔍 质量概览">
        <div style={grid2Style}>
          <Metric label="制程不良" value={fmt(totalProcessDefect, 0)} unit="件" color="#ff4d4f" />
          <Metric label="检验废品" value={fmt(totalInspectionDefect, 0)} unit="件" color="#fa8c16" />
        </div>
        {productionRows.length > 0 && (
          <div style={{
            marginTop: 10, padding: 10, borderRadius: 8, background: '#fafafa',
            fontSize: 12, color: '#666',
          }}>
            不良率：
            <span style={{ fontWeight: 600, color: totalProcessDefect + totalInspectionDefect > totalOutput * 0.05 ? '#ff4d4f' : '#52c41a' }}>
              {fmt(totalOutput > 0 ? ((totalProcessDefect + totalInspectionDefect) / totalOutput * 100) : 0, 2)}%
            </span>
          </div>
        )}
      </Section>

      {/* ③ 人员概览 */}
      <Section title="👷 人员概览">
        <div style={grid2Style}>
          <Metric label="技工" value={fmt(totalSkilled, 0)} unit="人" color="#1890ff" />
          <Metric label="普工" value={fmt(totalGeneral, 0)} unit="人" color="#13c2c2" />
          <Metric label="劳务" value={fmt(totalLabor, 0)} unit="人" color="#722ed1" />
          <Metric label="其它" value={fmt(totalOther, 0)} unit="人" color="#8c8c8c" />
        </div>
        <div style={grid2Style}>
          <Metric label="合计工时" value={fmt(totalHours, 1)} unit="h" color="#1890ff" />
          <Metric label="异常工时" value={fmt(totalAbnormalHours, 2)} unit="h" color="#fa8c16" />
        </div>
      </Section>

      {/* ④ 停机概览 */}
      <Section title="⏱️ 停机概览">
        <div style={grid2Style}>
          <Metric label="停机次数" value={fmt(downtime.length, 0)} unit="次" color="#1890ff" />
          <Metric label="总停机时" value={fmt(totalDowntimeHours, 2)} unit="h" color="#ff4d4f" />
        </div>
        {longestStop && (
          <div style={{
            marginTop: 10, padding: 10, borderRadius: 8, background: '#fff1f0',
            fontSize: 12, color: '#cf1322', borderLeft: '3px solid #ff4d4f',
          }}>
            最长停机：<b>{STOP_CODE_LABEL[longestStop.stopCode] || '其它异常'}</b>
            {longestStop.description ? ` — ${longestStop.description}` : ''}
            ，{fmt(longestStop.durationHours, 2)}h
          </div>
        )}
      </Section>

      {/* ⑤ 报工单行列表 */}
      {productionRows.length > 0 && (
        <Section title="📋 报工明细">
          {productionRows.map(r => (
            <div key={r.reportOrderId} style={{
              background: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.reportOrderNo}</span>
                <span style={{ fontSize: 11, color: '#999' }}>
                  {fmt(r.abnormalHours, 2)}h 异常
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                {r.materialName}{r.specification ? `（${r.specification}）` : ''}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: '#1890ff' }}>投入 {fmt(r.inputQty, 0)}</span>
                <span style={{ color: '#52c41a' }}>入库 {fmt(r.outputQty, 0)}</span>
                {r.processDefect > 0 && (
                  <span style={{ color: '#ff4d4f' }}>制程不良 {fmt(r.processDefect, 0)}</span>
                )}
                {r.inspectionDefect > 0 && (
                  <span style={{ color: '#fa8c16' }}>检验废品 {fmt(r.inspectionDefect, 0)}</span>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}
    </>
  )
}

/* ========================= 小组件 ========================= */

const grid2Style: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#262626' }}>{title}</div>
      <div style={{ background: '#fff', borderRadius: 10, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {children}
      </div>
    </div>
  )
}

function Metric({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '8px 10px',
      borderRadius: 8, background: '#fafafa',
    }}>
      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
        <span style={{ fontSize: 11, color: '#8c8c8c' }}>{unit}</span>
      </div>
    </div>
  )
}
