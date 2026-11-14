/**
 * MobileDailyCard.tsx — 移动端生产日报卡（汇总指标）
 *
 * 数据源：GET /api/daily-report?date=
 * 日期选择 onConfirm → 自动触发重新加载，无刷新按钮
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Button, CalendarPicker, PullToRefresh } from 'antd-mobile'
import type { ReactNode } from 'react'
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
  const [pickerValue, setPickerValue] = useState<Date>(new Date())
  const [pickerVisible, setPickerVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DailyReportData | null>(null)
  const loadingRef = useRef(false)

  // 日期标记缓存: Map<"2026-11", Set<"YYYY-MM-DD">>
  const [dateMarkers, setDateMarkers] = useState<Record<string, Set<string>>>({})
  const loadedMonthsRef = useRef<Set<string>>(new Set())

  const load = useCallback(async (targetDate: string) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const r = await api.get('/daily-report', { params: { date: targetDate } })
      setData(r.data?.data || r.data || null)
    } catch { /* 静默 */ }
    finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => { load(date) }, [date, load])

  // 加载某月的开工日期标记（用 ref 缓存防止重复加载，避免每次 setDateMarkers 重建依赖）
  const loadDateMarkers = useCallback(async (year: number, month: number) => {
    const cacheKey = `${year}-${String(month).padStart(2, '0')}`
    if (loadedMonthsRef.current.has(cacheKey)) return
    loadedMonthsRef.current.add(cacheKey)
    try {
      const r = await api.get('/daily-report/dates', { params: { year, month } })
      const arr: string[] = r.data?.data || r.data || []
      setDateMarkers(prev => {
        // 如果已经有这个 key，不更新
        if (prev[cacheKey]) return prev
        return { ...prev, [cacheKey]: new Set(arr) }
      })
    } catch { /* 静默 */ }
  }, [])

  // 初始化：加载前后各 3 个月（覆盖 99% 使用场景），不做 renderDate 内的懒加载
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth() + 1
    // 当前月 + 上 3 个月 + 下 3 个月 = 7 个月
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(y, m - 1 + offset, 1)
      loadDateMarkers(d.getFullYear(), d.getMonth() + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 合并所有标记为一个 Set
  const allMarkerDates = useMemo(() => {
    const s = new Set<string>()
    for (const set of Object.values(dateMarkers)) {
      for (const d of set) s.add(d)
    }
    return s
  }, [dateMarkers])

  // 自定义日期渲染：只负责渲染，不触发任何异步（防止闭包循环）
  const renderDate = (date: Date) => {
    const y = date.getFullYear(), m = date.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const hasMark = allMarkerDates.has(key)
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {date.getDate()}
        {hasMark && (
          <span style={{
            position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--brand-color)',
          }} />
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 12 }}>
      {/* 筛选 —— 点击日期按钮弹出 CalendarPicker */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12,
        background: 'var(--m-surface)', padding: 10, borderRadius: 10,
      }}>
        <Button
          size="mini"
          onClick={() => setPickerVisible(true)}
          style={{ padding: '0 10px' }}
        >
          📅 {date}
        </Button>
        {loading && <span style={{ fontSize: 11, color: '#1890ff', marginLeft: 4 }}>加载中…</span>}
      </div>

      {/* 日历弹窗 */}
      <CalendarPicker
        visible={pickerVisible}
        selectionMode="single"
        value={pickerValue}
        min={new Date(2024, 0, 1)}
        max={new Date()}
        renderDate={renderDate}
        onClose={() => setPickerVisible(false)}
        onConfirm={(val) => {
          if (!val) return
          setPickerValue(val)
          const formatted = dayjs(val).format('YYYY-MM-DD')
          setDate(formatted)
          setPickerVisible(false)
        }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--m-text-3)' }}>加载中…</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--m-text-3)' }}>暂无日报数据</div>
      ) : (
        <PullToRefresh onRefresh={() => load(date)}>
          <DailyCardContent data={data} />
        </PullToRefresh>
      )}
    </div>
  )
}

function DailyCardContent({ data }: { data: DailyReportData }) {
  const { header, productionRows, downtime } = data

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
            marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--m-surface-2)',
            fontSize: 12, color: 'var(--m-text-2)',
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
            marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--m-status-urgent-bg)',
            fontSize: 12, color: 'var(--m-status-urgent)', borderLeft: '3px solid #ff4d4f',
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
              background: 'var(--m-surface)', borderRadius: 10, padding: 12, marginBottom: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.reportOrderNo}</span>
                <span style={{ fontSize: 11, color: 'var(--m-text-3)' }}>
                  {fmt(r.abnormalHours, 2)}h 异常
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 6 }}>
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

const grid2Style: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--m-text)' }}>{title}</div>
      <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {children}
      </div>
    </div>
  )
}

function Metric({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '8px 10px',
      borderRadius: 8, background: 'var(--m-surface-2)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--m-text-3)' }}>{unit}</span>
      </div>
    </div>
  )
}
