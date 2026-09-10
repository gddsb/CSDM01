import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Spin } from 'antd'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import {
  ThunderboltOutlined, RiseOutlined, FallOutlined, DashboardOutlined,
  BulbOutlined, FundOutlined, BarChartOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { useBigScreenScale } from '../../hooks/useBigScreenScale'
import BigScreenHeader from '../../components/BigScreenHeader'
import BigScreenPanel from '../../components/BigScreenPanel'
import '../../styles/bigscreen.css'

// ========== 类型定义 ==========
interface OverviewData {
  today_kwh: number
  month_kwh: number
  month_peak_kwh: number
  month_peak_date: string | null
  power_factor: number
  month_reverse_kwh: number
  today_finish_qty: number
  unit_energy: number | null
  mom_change: number | null
}

interface TrendItem {
  date: string
  day_kwh: number
  finish_qty: number
  unit_energy: number | null
}

interface MeterItem {
  device_addr: string
  device_name: string
  forward_active: number
  forward_reactive: number
  reverse_active: number
  reading_date: string
  today_delta: number
  power_factor: number | null
  online: boolean
}

interface OnlineData {
  total_meters: number
  online_count: number
  online_rate: number
  last_reading: string | null
}

// ========== 工具函数 ==========
function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '--'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '--'
  return Math.round(n).toLocaleString('zh-CN')
}

// ========== KPI 卡片组件 ==========
interface KpiCardProps {
  title: string
  value: string
  unit?: string
  icon: React.ReactNode
  color: string
  subText?: string
  trend?: { value: number; label: string; positive?: boolean }
}

function KpiCard({ title, value, unit, icon, color, subText, trend }: KpiCardProps) {
  return (
    <div
      className="bs-kpi-card"
      style={{
        background: `linear-gradient(135deg, ${color}18 0%, rgba(0, 20, 40, 0.6) 100%)`,
        borderColor: `${color}40`,
      }}
    >
      <div className="bs-kpi-icon" style={{ color }}>
        {icon}
      </div>
      <div className="bs-kpi-body">
        <div className="bs-kpi-title">{title}</div>
        <div className="bs-kpi-value" style={{ color }}>
          {value}
          {unit && <span className="bs-kpi-unit">{unit}</span>}
        </div>
        {(subText || trend) && (
          <div className="bs-kpi-sub">
            {subText && <span>{subText}</span>}
            {trend && (
              <span
                style={{
                  marginLeft: 8,
                  color: trend.positive ? '#52c41a' : '#ff4d4f',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {trend.positive ? <RiseOutlined /> : <FallOutlined />}
                {trend.value.toFixed(1)}% {trend.label}
              </span>
            )}
          </div>
        )}
      </div>
      <div
        className="bs-kpi-glow"
        style={{ background: `radial-gradient(ellipse at center, ${color}25 0%, transparent 70%)` }}
      />
    </div>
  )
}

// ========== 图表配置 ==========
function trendChartOption(data: TrendItem[]): EChartsOption {
  const dates = data.map((d) => d.date.slice(5)) // MM-DD
  const kwhData = data.map((d) => d.day_kwh)
  const unitData = data.map((d) => d.unit_energy)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,20,40,0.9)',
      borderColor: 'rgba(0,212,255,0.3)',
      textStyle: { color: '#e6f4ff' },
      axisPointer: { type: 'cross', crossStyle: { color: 'rgba(0,212,255,0.3)' } },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = data[idx]
        let html = `<div style="color:#8adfff;font-size:12px;margin-bottom:4px">${d.date}</div>`
        for (const p of params) {
          const val = p.data != null ? (Array.isArray(p.data) ? p.data[1] : p.data) : '--'
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">${p.marker}<span style="color:#cfe6ff">${p.seriesName}</span>: <span style="color:${p.color};font-weight:600">${typeof val === 'number' ? val.toFixed(2) : val}</span></div>`
        }
        html += `<div style="color:#5b8ca8;font-size:11px;margin-top:4px">完工数: ${d.finish_qty} 罐</div>`
        return html
      },
    },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 20, itemHeight: 10, itemGap: 24,
      textStyle: { color: '#8adfff', fontSize: 12, padding: [0, 0, 0, 4] },
    },
    grid: { left: 56, right: 56, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#5b8ca8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.2)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '用电量(kWh)',
        position: 'left',
        axisLabel: { color: '#5b8ca8', fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: 'rgba(0,212,255,0.2)' } },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
        nameTextStyle: { color: '#5b8ca8', fontSize: 11, padding: [0, 0, 8, 0] },
      },
      {
        type: 'value',
        name: '单罐能耗(kWh/罐)',
        position: 'right',
        axisLabel: { color: '#5b8ca8', fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: 'rgba(250,140,22,0.3)' } },
        splitLine: { show: false },
        nameTextStyle: { color: '#5b8ca8', fontSize: 11, padding: [0, 0, 8, 0] },
      },
    ],
    series: [
      {
        name: '日用电量',
        type: 'bar',
        data: kwhData,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#00d4ff' },
              { offset: 1, color: '#0066cc' },
            ],
          },
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '50%',
      },
      {
        name: '单罐能耗',
        type: 'line',
        yAxisIndex: 1,
        data: unitData,
        smooth: true,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#fa8c16' },
        lineStyle: { width: 2.5, color: '#fa8c16', shadowColor: '#fa8c16', shadowBlur: 8 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(250,140,22,0.3)' },
              { offset: 1, color: 'rgba(250,140,22,0.02)' },
            ],
          },
        },
      },
    ],
  }
}

function topMetersChartOption(meters: MeterItem[]): EChartsOption {
  const top = meters.slice(0, 10).reverse() // 翻转让最大的在顶部
  const names = top.map((m) => (m.device_name || m.device_addr).slice(0, 12))
  const values = top.map((m) => m.today_delta)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(0,20,40,0.9)',
      borderColor: 'rgba(0,212,255,0.3)',
      textStyle: { color: '#e6f4ff' },
      formatter: (params: any) => {
        const p = params[0]
        const m = top[top.length - 1 - p.dataIndex]
        return `<div style="color:#8adfff;font-size:12px;margin-bottom:4px">${m.device_name || m.device_addr}</div>
          <div style="display:flex;align-items:center;gap:6px;margin:2px 0">${p.marker}<span style="color:#cfe6ff">今日用电</span>: <span style="color:#00d4ff;font-weight:600">${p.value.toFixed(2)} kWh</span></div>
          <div style="color:#5b8ca8;font-size:11px">功率因数: ${m.power_factor ?? '--'} | ${m.online ? '在线' : '离线'}</div>`
      },
    },
    grid: { left: 100, right: 30, top: 10, bottom: 10 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#5b8ca8', fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: '#cfe6ff',
        fontSize: 11,
        overflow: 'truncate',
        width: 90,
      },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.2)' } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: values,
        barWidth: 14,
        itemStyle: {
          color: (params: any) => {
            const colors = ['#ff4d4f', '#ff7a45', '#ff9c6e', '#ffc069', '#ffd666',
              '#ffec3d', '#a0d911', '#73d13d', '#52c41a', '#36cfc9']
            return colors[params.dataIndex] || '#00d4ff'
          },
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right',
          color: '#8adfff',
          fontSize: 10,
          formatter: (p: any) => `${p.value.toFixed(1)}`,
        },
      },
    ],
  }
}

// ========== useChart Hook ==========
function useChart(option: EChartsOption | null, deps: any[] = []) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chartRef.current = chart
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); chartRef.current = null }
  }, [])
  useEffect(() => { if (chartRef.current && option) chartRef.current.setOption(option, true) }, [option, ...deps])
  return ref
}

// ========== 主组件 ==========
export default function EnergyBigScreen() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [meters, setMeters] = useState<MeterItem[]>([])
  const [online, setOnline] = useState<OnlineData | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1920, designHeight: 1080 })

  // 时钟
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const formatClock = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const formatDateTime = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const getWeekday = (d: Date) => ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()]

  // 加载数据
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [o, t, m, on] = await Promise.all([
        api.get('/energy/overview'),
        api.get('/energy/trend?days=30'),
        api.get('/energy/meter-list'),
        api.get('/energy/online'),
      ])
      if (o?.data) setOverview(o.data as OverviewData)
      if (Array.isArray(t?.data)) setTrend(t.data as TrendItem[])
      if (Array.isArray(m?.data)) setMeters(m.data as MeterItem[])
      if (on?.data) setOnline(on.data as OnlineData)
    } catch (err) {
      console.error('加载能源看板失败:', err)
    } finally {
      setLoading(false)
      setLastRefreshTime(new Date())
    }
  }, [])

  useEffect(() => {
    loadAll()
    timerRef.current = setInterval(loadAll, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadAll])

  // 图表
  const trendRef = useChart(trend.length > 0 ? trendChartOption(trend) : null, [trend])
  const topMetersRef = useChart(meters.length > 0 ? topMetersChartOption(meters) : null, [meters])

  // 表头/表体列定义
  const meterTableCols: { key: keyof MeterItem | 'delta_pct'; label: string; width?: number; align?: 'left' | 'right' | 'center' }[] = [
    { key: 'device_name', label: '电表名称', width: 180, align: 'left' },
    { key: 'forward_active', label: '总读数(kWh)', width: 120, align: 'right' },
    { key: 'today_delta', label: '今日用电', width: 110, align: 'right' },
    { key: 'power_factor', label: '功率因数', width: 100, align: 'right' },
    { key: 'online', label: '状态', width: 80, align: 'center' },
    { key: 'reading_date', label: '最后采集', width: 160, align: 'left' },
  ]

  const leftDateTime = (
    <div className="bs-header-date">
      <span className="bs-header-date-main">{formatDateTime(currentTime)}</span>
      <span className="bs-header-date-week">{getWeekday(currentTime)}</span>
    </div>
  )

  const rightUpdateTime = (
    <div className="bs-header-update">
      <span>更新时间</span>
      <span className="bs-header-update-time">{lastRefreshTime ? formatClock(lastRefreshTime) : '--'}</span>
    </div>
  )

  // 在线状态
  const onlineRateColor = (online?.online_rate ?? 0) >= 90 ? '#52c41a' : (online?.online_rate ?? 0) >= 70 ? '#faad14' : '#ff4d4f'

  return (
    <div style={{ width: '100vw', height: '100vh', minWidth: 1920, minHeight: 1080, overflow: 'hidden', background: '#060d1b' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minWidth: 1920, minHeight: 1080, overflow: 'hidden' }}>
        <BigScreenHeader
          title="能源管理中心"
          extraLeft={leftDateTime}
          extraRight={rightUpdateTime}
          onRefresh={loadAll}
          refreshing={loading}
        />

        {/* 主体布局 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 10, position: 'relative' }}>
          {loading && !overview && (
            <div className="bs-loading-overlay">
              <Spin size="large" tip="加载能源数据..." />
            </div>
          )}

          {/* 第一行：6 个 KPI 卡片 */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <KpiCard
              title="今日用电"
              value={fmtNum(overview?.today_kwh)}
              unit="kWh"
              icon={<ThunderboltOutlined />}
              color="#00d4ff"
              trend={overview?.mom_change != null ? { value: Math.abs(overview.mom_change), label: overview.mom_change >= 0 ? '较昨日' : '较昨日', positive: overview.mom_change >= 0 } : undefined}
            />
            <KpiCard
              title="本月累计"
              value={fmtNum(overview?.month_kwh)}
              unit="kWh"
              icon={<FundOutlined />}
              color="#40a9ff"
              subText={`${dayjs().format('YYYY年M月')}`}
            />
            <KpiCard
              title="本月峰值"
              value={fmtNum(overview?.month_peak_kwh)}
              unit="kWh"
              icon={<RiseOutlined />}
              color="#ff4d4f"
              subText={overview?.month_peak_date ? dayjs(overview.month_peak_date).format('M月D日') : '--'}
            />
            <KpiCard
              title="功率因数"
              value={overview?.power_factor != null ? overview.power_factor.toFixed(3) : '--'}
              icon={<DashboardOutlined />}
              color="#52c41a"
              subText={overview && overview.power_factor > 0.9 ? '优良' : overview && overview.power_factor > 0.8 ? '良好' : '待优化'}
            />
            <KpiCard
              title="反向回送"
              value={fmtNum(overview?.month_reverse_kwh)}
              unit="kWh"
              icon={<FallOutlined />}
              color="#a855f7"
              subText="本月累计"
            />
            <KpiCard
              title="单罐能耗"
              value={overview?.unit_energy != null ? overview.unit_energy.toFixed(2) : '--'}
              unit="kWh/罐"
              icon={<BulbOutlined />}
              color="#fa8c16"
              subText={overview ? `今日完工 ${fmtInt(overview.today_finish_qty)} 罐` : '--'}
            />
          </div>

          {/* 第二行：30天趋势图 (左大) + Top 10 电表 (右小) */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            {/* 30天趋势 */}
            <BigScreenPanel
              title="近 30 天用电趋势"
              titleIcon={<BarChartOutlined />}
              titleExtra="用电量 + 单罐能耗"
              style={{ flex: 1, minWidth: 0 }}
              bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              <div ref={trendRef} className="bs-chart-container" style={{ flex: 1, minHeight: 0 }} />
            </BigScreenPanel>

            {/* Top 10 高耗电电表 */}
            <BigScreenPanel
              title="高耗电 TOP 10"
              titleIcon={<ThunderboltOutlined />}
              titleExtra="今日"
              style={{ flex: '0 0 420px', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              <div ref={topMetersRef} className="bs-chart-container" style={{ flex: 1, minHeight: 0 }} />
            </BigScreenPanel>
          </div>

          {/* 第三行：电表详情表 (左) + 在线状态 (右) */}
          <div style={{ flex: '0 0 260px', display: 'flex', gap: 10, minHeight: 0 }}>
            {/* 电表详情表 */}
            <BigScreenPanel
              title="全部电表"
              titleIcon={<DashboardOutlined />}
              titleExtra={`共 ${meters.length} 台`}
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              {/* 表头 */}
              <div className="bs-table-header" style={{ display: 'flex', padding: '8px 12px', background: 'rgba(0,212,255,0.08)', borderBottom: '1px solid rgba(0,212,255,0.2)', flexShrink: 0 }}>
                {meterTableCols.map((c) => (
                  <div
                    key={c.key as string}
                    style={{
                      width: c.width,
                      textAlign: c.align || 'left',
                      color: '#8adfff',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
              {/* 表体 - 滚动 */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="bs-table-body">
                {meters.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#5b8ca8', padding: 40 }}>暂无电表数据</div>
                ) : (
                  meters.map((m, idx) => (
                    <div
                      key={m.device_addr}
                      className="bs-table-row"
                      style={{
                        display: 'flex',
                        padding: '8px 12px',
                        borderBottom: idx < meters.length - 1 ? '1px solid rgba(0,212,255,0.08)' : 'none',
                        alignItems: 'center',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ width: 180, flexShrink: 0, color: '#cfe6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.device_name || m.device_addr}
                      </div>
                      <div style={{ width: 120, flexShrink: 0, textAlign: 'right', color: '#8adfff' }}>
                        {fmtNum(m.forward_active)}
                      </div>
                      <div style={{ width: 110, flexShrink: 0, textAlign: 'right', color: m.today_delta > 0 ? '#00d4ff' : '#5b8ca8', fontWeight: 600 }}>
                        +{fmtNum(m.today_delta)}
                      </div>
                      <div style={{ width: 100, flexShrink: 0, textAlign: 'right', color: '#cfe6ff' }}>
                        {m.power_factor != null ? m.power_factor.toFixed(3) : '--'}
                      </div>
                      <div style={{ width: 80, flexShrink: 0, textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: 10,
                            fontSize: 11,
                            background: m.online ? 'rgba(82,196,26,0.15)' : 'rgba(255,77,79,0.15)',
                            color: m.online ? '#52c41a' : '#ff4d4f',
                            border: `1px solid ${m.online ? 'rgba(82,196,26,0.4)' : 'rgba(255,77,79,0.4)'}`,
                          }}
                        >
                          {m.online ? '在线' : '离线'}
                        </span>
                      </div>
                      <div style={{ width: 160, flexShrink: 0, color: '#5b8ca8' }}>
                        {m.reading_date ? dayjs(m.reading_date).format('MM-DD HH:mm') : '--'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </BigScreenPanel>

            {/* 右侧：在线状态 + 统计 */}
            <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <BigScreenPanel
                title="在线状态"
                titleIcon={<ClockCircleOutlined />}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0, padding: 16 }}
              >
                {/* 在线率环形图 */}
                <div
                  ref={useChart(online ? {
                    series: [{
                      type: 'gauge',
                      startAngle: 90,
                      endAngle: -270,
                      radius: '75%',
                      center: ['50%', '45%'],
                      min: 0,
                      max: 100,
                      progress: { show: true, width: 10, itemStyle: { color: onlineRateColor } },
                      axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(0,212,255,0.15)']] } },
                      pointer: { show: false },
                      axisTick: { show: false },
                      splitLine: { show: false },
                      axisLabel: { show: false },
                      detail: {
                        valueAnimation: true,
                        offsetCenter: [0, '15%'],
                        formatter: (v: number) => `${v.toFixed(1)}%`,
                        fontSize: 22,
                        fontWeight: 700,
                        color: onlineRateColor,
                      },
                      title: { show: false },
                      data: [{ value: online.online_rate }],
                    }],
                  } : null, [online?.online_rate])}
                  style={{ width: '100%', height: 160 }}
                />
                <div style={{ textAlign: 'center', marginTop: 4 }}>
                  <div style={{ fontSize: 14, color: '#cfe6ff', marginBottom: 4 }}>
                    在线 <span style={{ color: onlineRateColor, fontWeight: 700 }}>{online?.online_count ?? '--'}</span>
                    <span style={{ color: '#5b8ca8' }}> / {online?.total_meters ?? '--'}</span> 台
                  </div>
                  <div style={{ fontSize: 11, color: '#5b8ca8' }}>
                    最后采集 {online?.last_reading ? dayjs(online.last_reading).format('HH:mm:ss') : '--'}
                  </div>
                </div>
              </BigScreenPanel>

              {/* 今日指标小面板 */}
              <BigScreenPanel
                title="今日概览"
                titleIcon={<FundOutlined />}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, flex: 1, minHeight: 0, padding: 16 }}
              >
                {overview && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#8adfff', fontSize: 13 }}>日完工数</span>
                      <span style={{ color: '#00d4ff', fontSize: 20, fontWeight: 700 }}>{fmtInt(overview.today_finish_qty)} 罐</span>
                    </div>
                    <div style={{ height: 1, background: 'rgba(0,212,255,0.15)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#8adfff', fontSize: 13 }}>单罐能耗</span>
                      <span style={{ color: '#fa8c16', fontSize: 20, fontWeight: 700 }}>
                        {overview.unit_energy != null ? overview.unit_energy.toFixed(2) : '--'}
                        <span style={{ fontSize: 12, color: '#5b8ca8', marginLeft: 4 }}>kWh/罐</span>
                      </span>
                    </div>
                    <div style={{ height: 1, background: 'rgba(0,212,255,0.15)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#8adfff', fontSize: 13 }}>今日用电</span>
                      <span style={{ color: '#40a9ff', fontSize: 20, fontWeight: 700 }}>
                        {fmtNum(overview.today_kwh)}
                        <span style={{ fontSize: 12, color: '#5b8ca8', marginLeft: 4 }}>kWh</span>
                      </span>
                    </div>
                  </>
                )}
                {!overview && (
                  <div style={{ textAlign: 'center', color: '#5b8ca8' }}>加载中...</div>
                )}
              </BigScreenPanel>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
