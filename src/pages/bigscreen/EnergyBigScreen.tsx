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

// ========== 工具函数 ==========
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
}

function KpiCard({ title, value, unit, icon, color, subText }: KpiCardProps) {
  return (
    <div
      className="bs-kpi-card"
      style={{
        background: `linear-gradient(135deg, ${color}18 0%, rgba(0, 20, 40, 0.6) 100%)`,
        borderColor: `${color}40`,
      }}
    >
      <div className="bs-kpi-icon" style={{ color }}>{icon}</div>
      <div className="bs-kpi-body">
        <div className="bs-kpi-title">{title}</div>
        <div className="bs-kpi-value" style={{ color }}>
          {value}
          {unit && <span className="bs-kpi-unit">{unit}</span>}
        </div>
        {subText && <div className="bs-kpi-sub"><span>{subText}</span></div>}
      </div>
      <div
        className="bs-kpi-glow"
        style={{ background: `radial-gradient(ellipse at center, ${color}25 0%, transparent 70%)` }}
      />
    </div>
  )
}

// ========== 30 天趋势图（主 Y=kWh 柱 + 次 Y=kWh/罐 折线）==========
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
      textStyle: { color: '#e6f4ff' },
      axisPointer: { type: 'cross', crossStyle: { color: 'rgba(0,212,255,0.3)' } },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = data[idx]
        let html = `<div style="color:#8adfff;font-size:12px;margin-bottom:4px">${d.date}</div>`
        for (const p of params) {
          const val = p.data != null ? (Array.isArray(p.data) ? p.data[1] : p.data) : '--'
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">${p.marker}<span style="color:#cfe6ff">${p.seriesName}</span>: <span style="color:${p.color};font-weight:600">${typeof val === 'number' ? (p.seriesName === '单罐能耗' ? val.toFixed(1) : val.toLocaleString()) : val}</span></div>`
        }
        html += `<div style="color:#5b8ca8;font-size:11px;margin-top:4px">完工数: ${d.finish_qty} 罐</div>`
        return html
      },
    },
    legend: {
      top: 0, left: 'center',
      itemWidth: 20, itemHeight: 10, itemGap: 24,
      textStyle: { color: '#8adfff', fontSize: 12, padding: [0, 0, 0, 4] },
    },
    grid: { left: 56, right: 56, top: 36, bottom: 28 },
    xAxis: {
      type: 'category', data: dates,
      axisLabel: { color: '#5b8ca8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.2)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value', name: '用电量(kWh)', position: 'left',
        axisLabel: { color: '#5b8ca8', fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: 'rgba(0,212,255,0.2)' } },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
        nameTextStyle: { color: '#5b8ca8', fontSize: 11, padding: [0, 0, 8, 0] },
      },
      {
        type: 'value', name: '单罐能耗(kWh/罐)', position: 'right',
        axisLabel: { color: '#5b8ca8', fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: 'rgba(250,140,22,0.3)' } },
        splitLine: { show: false },
        nameTextStyle: { color: '#5b8ca8', fontSize: 11, padding: [0, 0, 8, 0] },
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
        barWidth: '50%',
      },
      {
        name: '单罐能耗', type: 'line', yAxisIndex: 1, data: unitData,
        smooth: true, showSymbol: true, symbol: 'circle', symbolSize: 6,
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

// ========== 12 月趋势图 ==========
function monthTrendChartOption(data: MonthTrendItem[]): EChartsOption {
  const months = data.map((d) => d.month.slice(2)) // YY-MM
  const kwhData = data.map((d) => d.month_kwh)
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
        let html = `<div style="color:#8adfff;font-size:12px;margin-bottom:4px">${d.month}</div>`
        for (const p of params) {
          const val = p.data != null ? (Array.isArray(p.data) ? p.data[1] : p.data) : '--'
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">${p.marker}<span style="color:#cfe6ff">${p.seriesName}</span>: <span style="color:${p.color};font-weight:600">${typeof val === 'number' ? (p.seriesName === '单罐能耗' ? val.toFixed(1) : val.toLocaleString()) : val}</span></div>`
        }
        html += `<div style="color:#5b8ca8;font-size:11px;margin-top:4px">完工数: ${d.finish_qty} 罐</div>`
        return html
      },
    },
    legend: {
      top: 0, left: 'center',
      itemWidth: 20, itemHeight: 10, itemGap: 24,
      textStyle: { color: '#8adfff', fontSize: 12, padding: [0, 0, 0, 4] },
    },
    grid: { left: 64, right: 64, top: 36, bottom: 28 },
    xAxis: {
      type: 'category', data: months,
      axisLabel: { color: '#5b8ca8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.2)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value', name: '月用电量(kWh)', position: 'left',
        axisLabel: { color: '#5b8ca8', fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: 'rgba(0,212,255,0.2)' } },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
        nameTextStyle: { color: '#5b8ca8', fontSize: 11, padding: [0, 0, 8, 0] },
      },
      {
        type: 'value', name: '单罐能耗(kWh/罐)', position: 'right',
        axisLabel: { color: '#5b8ca8', fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: 'rgba(250,140,22,0.3)' } },
        splitLine: { show: false },
        nameTextStyle: { color: '#5b8ca8', fontSize: 11, padding: [0, 0, 8, 0] },
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
        barWidth: '50%',
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
  const [monthTrend, setMonthTrend] = useState<MonthTrendItem[]>([])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1920, designHeight: 1080 })

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
        api.get('/energy/trend?days=30'),
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

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 10, position: 'relative' }}>
          {loading && !overview && (
            <div className="bs-loading-overlay">
              <Spin size="large" tip="加载能源数据..." />
            </div>
          )}

          {/* 第一行：6 个 KPI */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <KpiCard
              title="今日用电"
              value={fmtInt(overview?.today_kwh)}
              unit="kWh"
              icon={<ThunderboltOutlined />}
              color="#00d4ff"
              subText="实时"
            />
            <KpiCard
              title="本月累计"
              value={fmtInt(overview?.month_kwh)}
              unit="kWh"
              icon={<FundOutlined />}
              color="#40a9ff"
              subText={dayjs().format('YYYY年M月')}
            />
            <KpiCard
              title="本月峰值"
              value={fmtInt(overview?.month_peak_kwh)}
              unit="kWh"
              icon={<RiseOutlined />}
              color="#ff4d4f"
              subText={overview?.month_peak_date ? dayjs(overview.month_peak_date).format('M月D日') : '--'}
            />
            <KpiCard
              title="昨日单罐能耗"
              value={overview?.yesterday_unit_energy != null ? fmtInt(overview.yesterday_unit_energy) : '--'}
              unit="kWh/罐"
              icon={<CalendarOutlined />}
              color="#52c41a"
              subText={overview ? `完工 ${fmtInt(overview.yesterday_qty)} 罐` : '--'}
            />
            <KpiCard
              title="本周单罐能耗"
              value={overview?.week_unit_energy != null ? fmtInt(overview.week_unit_energy) : '--'}
              unit="kWh/罐"
              icon={<BarChartOutlined />}
              color="#722ed1"
              subText={overview ? `完工 ${fmtInt(overview.week_qty)} 罐` : '--'}
            />
            <KpiCard
              title="本月单罐能耗"
              value={overview?.month_unit_energy != null ? fmtInt(overview.month_unit_energy) : '--'}
              unit="kWh/罐"
              icon={<BulbOutlined />}
              color="#fa8c16"
              subText={overview ? `完工 ${fmtInt(overview.month_qty)} 罐` : '--'}
            />
          </div>

          {/* 第二行：近 30 天用电趋势（占满） */}
          <BigScreenPanel
            title="近 30 天用电趋势"
            titleIcon={<BarChartOutlined />}
            titleExtra="主: 用电量(kWh) · 次: 单罐能耗(kWh/罐)"
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
          >
            <div ref={trendRef} className="bs-chart-container" style={{ flex: 1, minHeight: 0 }} />
          </BigScreenPanel>

          {/* 第三行：近 12 个月用电趋势（占满） */}
          <BigScreenPanel
            title="近 12 个月用电趋势"
            titleIcon={<ClockCircleOutlined />}
            titleExtra="主: 月用电量(kWh) · 次: 单罐能耗(kWh/罐)"
            style={{ flex: '0 0 340px', minWidth: 0, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
          >
            <div ref={monthTrendRef} className="bs-chart-container" style={{ flex: 1, minHeight: 0 }} />
          </BigScreenPanel>
        </div>
      </div>
    </div>
  )
}
