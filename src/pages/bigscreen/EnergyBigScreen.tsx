import { useEffect, useState, useRef, useCallback } from 'react'
import { Spin } from 'antd'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import {
  ThunderboltOutlined, RiseOutlined, CalendarOutlined,
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
  yesterday_kwh: number
  yesterday_qty: number
  yesterday_unit_energy: number | null
  week_kwh: number
  week_qty: number
  week_unit_energy: number | null
  month_qty: number
  month_unit_energy: number | null
}

interface TrendItem {
  date: string
  day_kwh: number
  finish_qty: number
  unit_energy: number | null
}

interface MonthTrendItem {
  month: string
  month_kwh: number
  finish_qty: number
  unit_energy: number | null
}

// ========== 图表配置 ==========
function trendChartOption(data: TrendItem[]): EChartsOption {
  const dates = data.map((d) => d.date.slice(5))
  const kwhData = data.map((d) => d.day_kwh)
  const unitData = data.map((d) => d.unit_energy)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,20,40,0.9)',
      borderColor: 'rgba(0,212,255,0.3)',
      textStyle: { color: '#e6f4ff', fontSize: 13 },
      axisPointer: { type: 'cross', crossStyle: { color: 'rgba(0,212,255,0.3)' } },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = data[idx]
        let html = `<div style="color:#8adfff;font-size:13px;margin-bottom:4px">${d.date}</div>`
        for (const p of params) {
          const val = p.data != null ? (Array.isArray(p.data) ? p.data[1] : p.data) : '--'
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:13px">${p.marker}<span style="color:#cfe6ff">${p.seriesName}</span>: <span style="color:${p.color};font-weight:600">${typeof val === 'number' ? (p.seriesName === '单罐能耗' ? val.toFixed(1) : val.toLocaleString()) : val}</span></div>`
        }
        html += `<div style="color:#5b8ca8;font-size:12px;margin-top:4px">完工数: ${d.finish_qty} 罐</div>`
        return html
      },
    },
    legend: {
      top: 0, left: 'center',
      itemWidth: 20, itemHeight: 10, itemGap: 24,
      textStyle: { color: '#8adfff', fontSize: 13, padding: [0, 0, 0, 4] },
    },
    grid: { left: 64, right: 64, top: 40, bottom: 32 },
    xAxis: {
      type: 'category', data: dates,
      axisLabel: { color: '#5b8ca8', fontSize: 12 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.2)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value', name: '用电量(kWh)', position: 'left',
        axisLabel: { color: '#5b8ca8', fontSize: 12 },
        axisLine: { show: true, lineStyle: { color: 'rgba(0,212,255,0.2)' } },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
        nameTextStyle: { color: '#5b8ca8', fontSize: 12, padding: [0, 0, 8, 0] },
      },
      {
        type: 'value', name: '单罐能耗(kWh/罐)', position: 'right',
        axisLabel: { color: '#5b8ca8', fontSize: 12 },
        axisLine: { show: true, lineStyle: { color: 'rgba(250,140,22,0.3)' } },
        splitLine: { show: false },
        nameTextStyle: { color: '#5b8ca8', fontSize: 12, padding: [0, 0, 8, 0] },
      },
    ],
    series: [
      {
        name: '日用电量', type: 'bar', data: kwhData,
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
        barWidth: '48%',
      },
      {
        name: '单罐能耗', type: 'line', yAxisIndex: 1, data: unitData,
        smooth: true, showSymbol: true, symbol: 'circle', symbolSize: 7,
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

function monthTrendChartOption(data: MonthTrendItem[]): EChartsOption {
  const months = data.map((d) => d.month.slice(2))
  const kwhData = data.map((d) => d.month_kwh)
  const unitData = data.map((d) => d.unit_energy)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,20,40,0.9)',
      borderColor: 'rgba(0,212,255,0.3)',
      textStyle: { color: '#e6f4ff', fontSize: 13 },
      axisPointer: { type: 'cross', crossStyle: { color: 'rgba(0,212,255,0.3)' } },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = data[idx]
        let html = `<div style="color:#8adfff;font-size:13px;margin-bottom:4px">${d.month}</div>`
        for (const p of params) {
          const val = p.data != null ? (Array.isArray(p.data) ? p.data[1] : p.data) : '--'
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:13px">${p.marker}<span style="color:#cfe6ff">${p.seriesName}</span>: <span style="color:${p.color};font-weight:600">${typeof val === 'number' ? (p.seriesName === '单罐能耗' ? val.toFixed(1) : val.toLocaleString()) : val}</span></div>`
        }
        html += `<div style="color:#5b8ca8;font-size:12px;margin-top:4px">完工数: ${d.finish_qty} 罐</div>`
        return html
      },
    },
    legend: {
      top: 0, left: 'center',
      itemWidth: 20, itemHeight: 10, itemGap: 24,
      textStyle: { color: '#8adfff', fontSize: 13, padding: [0, 0, 0, 4] },
    },
    grid: { left: 72, right: 72, top: 40, bottom: 32 },
    xAxis: {
      type: 'category', data: months,
      axisLabel: { color: '#5b8ca8', fontSize: 12 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.2)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value', name: '月用电量(kWh)', position: 'left',
        axisLabel: { color: '#5b8ca8', fontSize: 12 },
        axisLine: { show: true, lineStyle: { color: 'rgba(0,212,255,0.2)' } },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
        nameTextStyle: { color: '#5b8ca8', fontSize: 12, padding: [0, 0, 8, 0] },
      },
      {
        type: 'value', name: '单罐能耗(kWh/罐)', position: 'right',
        axisLabel: { color: '#5b8ca8', fontSize: 12 },
        axisLine: { show: true, lineStyle: { color: 'rgba(250,140,22,0.3)' } },
        splitLine: { show: false },
        nameTextStyle: { color: '#5b8ca8', fontSize: 12, padding: [0, 0, 8, 0] },
      },
    ],
    series: [
      {
        name: '月用电量', type: 'bar', data: kwhData,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#40a9ff' },
              { offset: 1, color: '#004080' },
            ],
          },
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '48%',
      },
      {
        name: '单罐能耗', type: 'line', yAxisIndex: 1, data: unitData,
        smooth: true, showSymbol: true, symbol: 'circle', symbolSize: 7,
        itemStyle: { color: '#fa8c16' },
        lineStyle: { width: 2.5, color: '#fa8c16', shadowColor: '#fa8c16', shadowBlur: 8 },
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
    let chart = chartRef.current
    if (!chart) {
      chart = echarts.init(ref.current)
      chartRef.current = chart
    }
    if (option) chart.setOption(option, true)
    // 强制 resize：ECharts init 时父容器可能尚未撑开，用 next tick 让它拿到正确尺寸
    const t1 = setTimeout(() => chart!.resize(), 0)
    const t2 = setTimeout(() => chart!.resize(), 200)
    const onResize = () => chart!.resize()
    window.addEventListener('resize', onResize)
    // ResizeObserver 兜底：父容器尺寸变化时自动 resize
    let ro: ResizeObserver | null = null
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => chart!.resize())
      ro.observe(ref.current)
    }
    return () => {
      clearTimeout(t1); clearTimeout(t2)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [option, ...deps])
  useEffect(() => {
    return () => { if (chartRef.current) { chartRef.current.dispose(); chartRef.current = null } }
  }, [])
  return ref
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '--'
  return Math.round(n).toLocaleString('zh-CN')
}

// ========== 主组件 ==========
export default function EnergyBigScreen() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [monthTrend, setMonthTrend] = useState<MonthTrendItem[]>([])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1280, designHeight: 720 })

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

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [o, t, mt] = await Promise.all([
        api.get('/energy/overview'),
        api.get('/energy/trend?mode=month'),
        api.get('/energy/month-trend?months=12'),
      ])
      if (o?.data) setOverview(o.data as OverviewData)
      if (Array.isArray(t?.data)) setTrend(t.data as TrendItem[])
      if (Array.isArray(mt?.data)) setMonthTrend(mt.data as MonthTrendItem[])
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

  const trendRef = useChart(trend.length > 0 ? trendChartOption(trend) : null, [trend])
  const monthTrendRef = useChart(monthTrend.length > 0 ? monthTrendChartOption(monthTrend) : null, [monthTrend])

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

  // KPI 配置（复用 ProductionBigScreen 的全局 .bs-kpi-card / .bs-kpi-value / .bs-kpi-label）
  const kpis = [
    {
      label: '今日用电',
      value: fmtInt(overview?.today_kwh),
      color: '#00d4ff',
      icon: <ThunderboltOutlined style={{ marginRight: 6, fontSize: 18 }} />,
      sub: 'kWh',
    },
    {
      label: '本月累计',
      value: fmtInt(overview?.month_kwh),
      color: '#40a9ff',
      icon: <FundOutlined style={{ marginRight: 6, fontSize: 18 }} />,
      sub: dayjs().format('YYYY年M月'),
    },
    {
      label: '本月峰值',
      value: fmtInt(overview?.month_peak_kwh),
      color: '#ff4d4f',
      icon: <RiseOutlined style={{ marginRight: 6, fontSize: 18 }} />,
      sub: overview?.month_peak_date ? dayjs(overview.month_peak_date).format('M月D日') : '--',
    },
    {
      label: '昨日单罐能耗',
      value: overview?.yesterday_unit_energy != null ? fmtInt(overview.yesterday_unit_energy) : '--',
      color: '#52c41a',
      icon: <CalendarOutlined style={{ marginRight: 6, fontSize: 18 }} />,
      sub: overview ? `完工 ${fmtInt(overview.yesterday_qty)} 罐` : '--',
    },
    {
      label: '本周单罐能耗',
      value: overview?.week_unit_energy != null ? fmtInt(overview.week_unit_energy) : '--',
      color: '#722ed1',
      icon: <BarChartOutlined style={{ marginRight: 6, fontSize: 18 }} />,
      sub: overview ? `完工 ${fmtInt(overview.week_qty)} 罐` : '--',
    },
    {
      label: '本月单罐能耗',
      value: overview?.month_unit_energy != null ? fmtInt(overview.month_unit_energy) : '--',
      color: '#fa8c16',
      icon: <BulbOutlined style={{ marginRight: 6, fontSize: 18 }} />,
      sub: overview ? `完工 ${fmtInt(overview.month_qty)} 罐` : '--',
    },
  ]

  return (
    <div style={{ width: '100vw', height: '100vh', minWidth: 1280, minHeight: 720, overflow: 'hidden' }}>
      <div className="bigscreen-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minWidth: 1280, minHeight: 720, overflow: 'hidden' }}>
        <BigScreenHeader
          title="能源管理中心"
          extraLeft={leftDateTime}
          extraRight={rightUpdateTime}
          onRefresh={loadAll}
          refreshing={loading}
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexShrink: 0 }}>
          {kpis.map((k) => (
            <BigScreenPanel key={k.label} style={{ flex: 1 }}>
              <div className="bs-kpi-card">
                <div className="bs-kpi-label" style={{ color: '#8adfff', fontSize: 13, marginTop: 0, marginBottom: 4 }}>
                  {k.icon}{k.label}
                </div>
                <div className="bs-kpi-value bs-number-glow" style={{ color: k.color }}>
                  {k.value}
                  <span style={{ fontSize: 16, marginLeft: 2 }}>{k.sub}</span>
                </div>
              </div>
            </BigScreenPanel>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BigScreenPanel
            title="本月用电趋势"
            titleIcon={<BarChartOutlined />}
            titleExtra="主: 日用电量(kWh) · 次: 单罐能耗(kWh/罐)"
            style={{ flex: 1, minWidth: 0, minHeight: 0 }}
            bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
          >
            <div ref={trendRef} style={{ flex: 1, minHeight: 160, width: '100%', display: 'block' }} />
          </BigScreenPanel>

          <BigScreenPanel
            title="近 12 个月用电趋势"
            titleIcon={<ClockCircleOutlined />}
            titleExtra="主: 月用电量(kWh) · 次: 单罐能耗(kWh/罐)"
            style={{ flex: 1, minWidth: 0, minHeight: 0 }}
            bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
          >
            <div ref={monthTrendRef} style={{ flex: 1, minHeight: 160, width: '100%', display: 'block' }} />
          </BigScreenPanel>
        </div>
      </div>
    </div>
  )
}
