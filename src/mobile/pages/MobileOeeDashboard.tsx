/**
 * 移动端设备 OEE 看板（Phase 4）
 *
 * 数据来源：GET /api/auto/dashboard/oee?range=7|30|month
 * 后端聚合自 device_runtime_log + report_order + process_defect
 *
 * 布局：
 *   [Top]     范围切换（近7天 / 近30天 / 本月）
 *   [Big]     整体 OEE 大圆环（svg 自画）+ 3 小进度条（A/P/Q）
 *   [List]    设备排行 Top N（名称 / OEE / 进度条）
 *   [Trend]   质量率 近 N 天趋势（svg 折线）
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Tabs, PullToRefresh, Empty, ProgressBar } from 'antd-mobile'
import api from '../../utils/api'

type Range = '7' | '30' | 'month'

const RANGE_TABS: { key: Range; label: string }[] = [
  { key: '7', label: '近7天' },
  { key: '30', label: '近30天' },
  { key: 'month', label: '本月' },
]

const getStatus = (oee: number) =>
  oee >= 85 ? { label: '优秀', color: 'var(--brand-color-success)' }
  : oee >= 70 ? { label: '良好', color: 'var(--brand-color)' }
  : oee >= 60 ? { label: '一般', color: 'var(--brand-color-warning)' }
  : { label: '预警', color: 'var(--brand-color-danger)' }

interface OeeDevice {
  device_id: number
  device_name: string
  device_code?: string
  availability: number
  performance: number
  quality: number
  oee: number
  runtime_hours?: number
}

interface OeeTrendPoint {
  date: string
  output: number
  defect: number
  quality: number | null
}

interface OeeSummary {
  avg_oee: number
  max_oee: number
  min_oee: number
  device_count: number
  range_label: string
}

interface OeeData {
  devices: OeeDevice[]
  summary: OeeSummary
  trend: OeeTrendPoint[]
}

// ========== 圆环进度（svg，移动端友好）==========

function OeeRing({ value, size = 140 }: { value: number; size?: number }) {
  const radius = size / 2 - 8
  const circumference = 2 * Math.PI * radius
  const percent = Math.max(0, Math.min(100, value))
  const offset = circumference - (percent / 100) * circumference
  const status = getStatus(value)
  const fontSize = Math.round(size * 0.22)
  const subSize = Math.round(size * 0.1)

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={status.color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize, fontWeight: 700, color: status.color, lineHeight: 1 }}>
          {percent.toFixed(1)}
        </span>
        <span style={{ fontSize: subSize, color: 'var(--m-text-3)', marginTop: 2 }}>OEE %</span>
        <span style={{ fontSize: subSize - 2, color: status.color, marginTop: 2, fontWeight: 500 }}>
          {status.label}
        </span>
      </div>
    </div>
  )
}

// ========== 折线趋势图（svg，自画）==========

function TrendChart({ data }: { data: OeeTrendPoint[] }) {
  const width = 320
  const height = 120
  const pad = { l: 28, r: 12, t: 10, b: 22 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b

  const valid = data.filter((p) => p.quality !== null && p.quality !== undefined) as OeeTrendPoint[]
  if (valid.length < 2) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--m-text-3)', fontSize: 12,
      }}>
        趋势数据不足
      </div>
    )
  }

  // 限制最多 30 点
  const sliced = valid.slice(-30)
  const maxY = 100
  const minY = 0
  const xStep = sliced.length > 1 ? innerW / (sliced.length - 1) : innerW

  const points = sliced.map((p, i) => {
    const x = pad.l + i * xStep
    const y = pad.t + innerH - ((p.quality! - minY) / (maxY - minY)) * innerH
    return { x, y, p }
  })

  const pathD = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${points[points.length - 1].x},${pad.t + innerH} L${points[0].x},${pad.t + innerH} Z`

  const yTicks = [0, 50, 100]

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {yTicks.map((y) => {
        const py = pad.t + innerH - (y / (maxY - minY)) * innerH
        return (
          <g key={y}>
            <line x1={pad.l} y1={py} x2={pad.l + innerW} y2={py} stroke="#eee" strokeDasharray="2 2" />
            <text x={pad.l - 4} y={py + 3} fontSize="9" textAnchor="end" fill="#bbb">{y}%</text>
          </g>
        )
      })}
      <path d={areaD} fill="url(#qgrad)" opacity={0.35} />
      <defs>
        <linearGradient id="qgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2196F3" />
          <stop offset="100%" stopColor="#2196F3" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={pathD} fill="none" stroke="#2196F3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill="#2196F3" />
      ))}
      {/* 首尾日期 */}
      <text x={pad.l} y={height - 4} fontSize="9" fill="#bbb">{sliced[0].date.slice(5)}</text>
      <text x={pad.l + innerW} y={height - 4} fontSize="9" fill="#bbb" textAnchor="end">
        {sliced[sliced.length - 1].date.slice(5)}
      </text>
    </svg>
  )
}

// ========== 主组件 ==========

export default function MobileOeeDashboard() {
  const [range, setRange] = useState<Range>('7')
  const [data, setData] = useState<OeeData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res: any = await api.get('/auto/dashboard/oee', { params: { range: r } })
      if (res.success && res.data) setData(res.data)
      else setData(null)
    } catch {
      setData(null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(range) }, [range, fetchData])

  const summary = data?.summary
  const devices = data?.devices || []
  const topDevices = useMemo(() => devices.slice(0, 10), [devices])

  const onRefresh = async () => { await fetchData(range) }

  return (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* 范围切换 */}
      <Tabs activeKey={range} onChange={(k) => setRange(k as Range)} style={{ marginBottom: 12 }}>
        {RANGE_TABS.map((t) => (
          <Tabs.Tab title={t.label} key={t.key} />
        ))}
      </Tabs>

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--m-text-3)' }}>加载中...</div>
      ) : !data || devices.length === 0 ? (
        <Empty description="暂无设备数据" />
      ) : (
        <PullToRefresh onRefresh={onRefresh}>
          {/* ========== 整体概览 ========== */}
          <div style={{
            background: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
            borderRadius: 12, padding: 16, color: 'var(--m-surface)',
            display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12,
          }}>
            <OeeRing value={summary?.avg_oee || 0} size={128} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>设备综合效率 · {summary?.range_label}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>
                共 {summary?.device_count} 台 · 最高 {summary?.max_oee}% · 最低 {summary?.min_oee}%
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <MiniBar label="可用率" value={avgOf(devices, 'availability')} />
                <MiniBar label="性能率" value={avgOf(devices, 'performance')} />
                <MiniBar label="质量率" value={avgOf(devices, 'quality')} />
              </div>
            </div>
          </div>

          {/* ========== 设备排行 ========== */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>🏆 设备 OEE 排行</span>
              <span style={{ fontSize: 11, color: 'var(--m-text-3)' }}>Top {topDevices.length}</span>
            </div>
            {topDevices.map((d, i) => {
              const st = getStatus(d.oee)
              return (
                <div key={d.device_id} style={{
                  padding: '10px 4px', borderBottom: i < topDevices.length - 1 ? '1px solid #f5f5f5' : 'none',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 10,
                        background: i === 0 ? '#FFD54F' : i === 1 ? '#BDBDBD' : i === 2 ? '#FFAB91' : 'var(--m-surface-2)',
                        color: i < 3 ? 'var(--m-surface)' : 'var(--m-text-3)',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{i + 1}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--m-text)' }}>{d.device_name}</div>
                        {d.device_code && (
                          <div style={{ fontSize: 10, color: 'var(--m-text-3)' }}>{d.device_code}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: st.color }}>{d.oee.toFixed(1)}%</div>
                      <div style={{ fontSize: 10, color: st.color }}>{st.label}</div>
                    </div>
                  </div>
                  <ProgressBar
                    percent={Math.round(d.oee)}
                    style={{ height: 4, '--border-radius': 2, '--fill-color': st.color, '--track-color': '#f0f0f0' } as any}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: '#888' }}>
                    <span>A {d.availability}%</span>
                    <span>P {d.performance}%</span>
                    <span>Q {d.quality}%</span>
                    {d.runtime_hours ? <span>运行 {d.runtime_hours}h</span> : null}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ========== 质量率趋势 ========== */}
          <div style={{ background: 'var(--m-surface)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📈 质量率趋势 · {summary?.range_label}</div>
            <TrendChart data={data.trend} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginTop: 4 }}>
              <span>蓝色折线 · 每日质量率</span>
              <span>产量 {sumTrendField(data.trend, 'output').toLocaleString()} · 不良 {sumTrendField(data.trend, 'defect').toLocaleString()}</span>
            </div>
          </div>
        </PullToRefresh>
      )}
    </div>
  )
}

// ========== 小工具 ==========

function MiniBar({ label, value }: { label: string; value: number }) {
  const v = Math.round(value)
  const st = getStatus(value)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.85, marginBottom: 2 }}>
        <span>{label}</span>
        <span>{value.toFixed(1)}%</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.25)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${v}%`, height: '100%', background: 'var(--m-surface)', borderRadius: 2,
        }} />
      </div>
      {/* st 引用避免 linter 抱怨（用于后续可能扩展颜色） */}
      {st.label && null}
    </div>
  )
}

function avgOf(devices: OeeDevice[], key: keyof OeeDevice): number {
  if (devices.length === 0) return 0
  const sum = devices.reduce((s, d) => s + Number(d[key] || 0), 0)
  return sum / devices.length
}

function sumTrendField(trend: OeeTrendPoint[] | undefined, key: 'output' | 'defect'): number {
  if (!trend) return 0
  return trend.reduce((s, p) => s + Number(p[key] || 0), 0)
}
