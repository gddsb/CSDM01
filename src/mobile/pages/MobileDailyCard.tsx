/**
 * MobileDailyCard.tsx — 移动端生产日报卡（汇总指标）
 *
 * 数据源：GET /api/daily-report?date=
 * 日期选择 onConfirm → 自动触发重新加载，无刷新按钮
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button, PullToRefresh, Picker } from 'antd-mobile'
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
  incomingDefectSmall?: number
  incomingDefectCap?: number
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
  const [showCalendar, setShowCalendar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DailyReportData | null>(null)
  const loadingRef = useRef(false)

  // 日历视图年月（用户正在看的月份，可不同于选中日期所在月）
  const [viewYear, setViewYear] = useState(() => dayjs().year())
  const [viewMonth, setViewMonth] = useState(() => dayjs().month() + 1)
  const [ymPickerVisible, setYMPickerVisible] = useState(false)

  // 开工日期标记缓存
  const markerDatesRef = useRef<Set<string>>(new Set())
  const loadedMonthsRef = useRef<Set<string>>(new Set())
  // 触发日历 grid 重渲染的 tick（标记更新 → tick++ → 日历重绘 → 新圆点出来）
  const [, setRenderTick] = useState(0)

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

  // 加载某月的开工日期标记
  const loadDateMarkers = useCallback(async (year: number, month: number) => {
    const cacheKey = `${year}-${String(month).padStart(2, '0')}`
    if (loadedMonthsRef.current.has(cacheKey)) return
    loadedMonthsRef.current.add(cacheKey)
    try {
      const r = await api.get('/daily-report/dates', { params: { year, month } })
      const arr: string[] = r.data?.data || r.data || []
      for (const d of arr) markerDatesRef.current.add(d)
      setRenderTick(n => n + 1) // 触发日历重绘
    } catch { /* 静默 */ }
  }, [])

  // 切换月份时预加载前后各 1 个月
  useEffect(() => {
    loadDateMarkers(viewYear, viewMonth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth])

  // 初始化：加载选中日期所在月前后各 3 个月
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth() + 1
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(y, m - 1 + offset, 1)
      loadDateMarkers(d.getFullYear(), d.getMonth() + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentHasMark = markerDatesRef.current.has(date)

  const openCalendar = () => {
    // 打开日历时跳到选中日期所在月
    const d = dayjs(date)
    setViewYear(d.year())
    setViewMonth(d.month() + 1)
    setShowCalendar(true)
  }

  const onPickDate = (y: number, m: number, day: number) => {
    const fmt = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setDate(fmt)
    setShowCalendar(false)
  }

  return (
    <div style={{ padding: 12 }}>
      {/* 日期按钮 */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12,
        background: 'var(--m-surface)', padding: 10, borderRadius: 10,
      }}>
        <Button size="mini" onClick={openCalendar} style={{ padding: '0 10px' }}>
          📅 {date}{currentHasMark ? ' 📌' : ''}
        </Button>
        {loading && <span style={{ fontSize: 11, color: '#1890ff', marginLeft: 4 }}>加载中…</span>}
      </div>

      {/* 手写日历弹窗 */}
      {showCalendar && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          }}
          onClick={() => setShowCalendar(false)}
        >
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              background: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
              maxHeight: '85vh', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 日历头部：月份导航 + 关闭 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => {
                  let m = viewMonth - 1, y = viewYear
                  if (m < 1) { m = 12; y-- }
                  setViewYear(y); setViewMonth(m)
                }} style={navBtn}>←</button>
                <button onClick={() => setYMPickerVisible(true)} style={{ fontSize: 16, fontWeight: 700, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 12px' }}>
                  {viewYear}年 {viewMonth}月 ▾
                </button>
                <button onClick={() => {
                  let m = viewMonth + 1, y = viewYear
                  if (m > 12) { m = 1; y++ }
                  setViewYear(y); setViewMonth(m)
                }} style={navBtn}>→</button>
              </div>
              <button onClick={() => setShowCalendar(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer' }}>✕</button>
            </div>

            {/* 年月选择 Picker（用 visible 控制，不用 trigger prop） */}
            <Picker
              visible={ymPickerVisible}
              columns={[years, months]}
              value={[String(viewYear), String(viewMonth)]}
              onClose={() => setYMPickerVisible(false)}
              onConfirm={(v) => { setViewYear(Number(v[0])); setViewMonth(Number(v[1])); setYMPickerVisible(false) }}
            />

            {/* 星期表头 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 0', textAlign: 'center', fontSize: 12, color: '#999' }}>
              {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}
            </div>

            {/* 日历 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px 12px 16px', gap: 4 }}>
              {buildMonthCells(viewYear, viewMonth).map((cell, idx) => {
                if (!cell) return <div key={idx} />
                const fmtKey = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
                const hasMark = markerDatesRef.current.has(fmtKey)
                const isSelected = fmtKey === date
                const isToday = fmtKey === dayjs().format('YYYY-MM-DD')
                return (
                  <div
                    key={idx}
                    onClick={() => cell.selectable && onPickDate(viewYear, viewMonth, cell.day)}
                    style={{
                      position: 'relative',
                      height: 40,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15,
                      cursor: cell.selectable ? 'pointer' : 'default',
                      background: isSelected ? 'var(--brand-color)' : 'transparent',
                      color: isSelected ? '#fff' : (cell.selectable ? (isToday ? 'var(--brand-color)' : '#333') : '#ccc'),
                      borderRadius: 8,
                      fontWeight: isSelected || isToday ? 600 : 400,
                    }}
                  >
                    {cell.day}
                    {hasMark && (
                      <span style={{
                        position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                        width: 5, height: 5, borderRadius: '50%',
                        background: isSelected ? '#fff' : 'var(--brand-color)',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

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

const navBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 18, padding: '4px 10px', color: '#666',
}

// 年月 Picker 列
const years = Array.from({ length: 6 }, (_, i) => ({ label: `${2024 + i}年`, value: `${2024 + i}` }))
const months = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: `${i + 1}` }))

// 构建月历 cell 数组（6周 × 7天 = 42 格）
interface CalendarCell { day: number; selectable: boolean }
function buildMonthCells(year: number, month: number): (CalendarCell | null)[] {
  const first = new Date(year, month - 1, 1)
  const firstWeekday = first.getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (CalendarCell | null)[] = []
  // 前置空白
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  // 当月天数
  const today = new Date()
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month - 1, d)
    const selectable = cellDate <= today // 今天及以前可点
    cells.push({ day: d, selectable })
  }
  // 补齐到 42 格
  while (cells.length < 42) cells.push(null)
  return cells
}

function DailyCardContent({ data }: { data: DailyReportData }) {
  const { header, productionRows, downtime } = data

  const totalInput = productionRows.reduce((s, r) => s + r.inputQty, 0)
  const totalOutput = productionRows.reduce((s, r) => s + r.outputQty, 0)
  const totalIncomingDefect = productionRows.reduce((s, r) => s + (r.incomingDefectSmall || 0) + (r.incomingDefectCap || 0), 0)
  const totalProcessDefect = productionRows.reduce((s, r) => s + r.processDefect, 0)
  const totalInspectionDefect = productionRows.reduce((s, r) => s + r.inspectionDefect, 0)
  const totalDefect = totalIncomingDefect + totalProcessDefect + totalInspectionDefect
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

      {/* ② 质量概览 —— 4 格 + 各不良率 */}
      <Section title="🔍 质量概览">
        <div style={grid2Style}>
          <Metric
            label="来料不良"
            value={fmt(totalIncomingDefect, 0)}
            unit="件"
            color="#fa8c16"
            extra={defectExtra(totalIncomingDefect, totalOutput)}
          />
          <Metric
            label="制程不良"
            value={fmt(totalProcessDefect, 0)}
            unit="件"
            color="#ff4d4f"
            extra={defectExtra(totalProcessDefect, totalOutput)}
          />
          <Metric
            label="检验废品"
            value={fmt(totalInspectionDefect, 0)}
            unit="件"
            color="#fa8c16"
            extra={defectExtra(totalInspectionDefect, totalOutput)}
          />
          <Metric
            label="总不良"
            value={fmt(totalDefect, 0)}
            unit="件"
            color="#ff4d4f"
            extra={defectExtra(totalDefect, totalOutput)}
          />
        </div>
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

function Metric({ label, value, unit, color, extra }: { label: string; value: string; unit: string; color: string; extra?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '8px 10px',
      borderRadius: 8, background: 'var(--m-surface-2)', gap: 10,
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
          <span style={{ fontSize: 11, color: 'var(--m-text-3)' }}>{unit}</span>
        </div>
      </div>
      {extra && <div style={{ minWidth: 60 }}>{extra}</div>}
    </div>
  )
}

// 不良率：单种不良 / 总产出，>5% 红色，否则绿色
function defectExtra(defect: number, output: number) {
  const pct = output > 0 ? (defect / output * 100) : 0
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>占比</div>
      <div style={{
        fontSize: 20, fontWeight: 700, lineHeight: 1.1,
        color: defect > output * 0.05 ? '#ff4d4f' : '#52c41a',
      }}>
        {fmt(pct, 2)}%
      </div>
    </div>
  )
}
