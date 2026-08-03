import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Spin, Row, Col } from 'antd'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import {
  ShopOutlined, HomeOutlined, FireOutlined, CloudOutlined,
  DashboardOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { useBigScreenScale } from '../../hooks/useBigScreenScale'
import BigScreenHeader from '../../components/BigScreenHeader'
import BigScreenPanel from '../../components/BigScreenPanel'
import '../../styles/bigscreen.css'

interface FactorItem {
  factor_name: string
  device_name: string
  factorType: 'temperature' | 'humidity' | 'dew' | 'pressure'
  value: number
  unit: string
  device_status: string
  collect_time: string
}

interface AreaData { name: string; icon: string; factors: FactorItem[] }

interface OverviewData {
  areas: AreaData[]
  alarms: { total: number; unhandled: number; today: number; recent: any[] }
  dew_points?: { workshop?: number | null; warehouse?: number | null }
  lastUpdate: string | null
}

interface TrendData {
  hours: number
  times: string[]
  series: { name: string; color: string; data: (number | null)[] }[]
}

function fmtTime(s?: string | null) {
  return s ? dayjs(s).format('YYYY-MM-DD HH:mm:ss') : '-'
}

function gaugeTemp(value: number, area: 'workshop' | 'warehouse'): EChartsOption {
  const upper = area === 'workshop' ? 25 : 35
  const color = value < 18 ? '#00d4ff' : value > upper ? '#ff4d4f' : '#52c41a'
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '70%',
      min: 0, max: 40, splitNumber: 8,
      startAngle: 225, endAngle: -45,
      axisLine: {
        lineStyle: {
          width: 8,
          color: [
            [0.45, '#36cfc9'],
            [upper / 40, '#40a9ff'],
            [1, '#ff6b6b'],
          ],
        },
      },
      pointer: {
        length: '55%',
        width: 3,
        itemStyle: { color: '#40a9ff' },
      },
      axisTick: {
        splitNumber: 5,
        distance: -8,
        length: 3,
        lineStyle: { color: '#ffffff', width: 1, opacity: 0.5 },
      },
      splitLine: {
        distance: -8,
        length: 8,
        lineStyle: { color: '#ffffff', width: 2 },
      },
      axisLabel: {
        color: '#e6f3ff',
        distance: -18,
        fontSize: 10,
        fontWeight: 500,
      },
      title: {
        show: true,
        offsetCenter: [0, '-10%'],
        fontSize: 11,
        fontWeight: 600,
        color: '#8adfff',
      },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '62%'],
        formatter: (v: number) => `${v.toFixed(1)}℃`,
        fontSize: 15,
        fontWeight: 700,
        color,
      },
      data: [{ value: Math.round(value * 10) / 10, name: '温度' }],
    }],
  }
}

function gaugeHum(value: number): EChartsOption {
  const color = value > 65 ? '#ff4d4f' : '#52c41a'
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '70%',
      min: 35, max: 100, splitNumber: 5,
      startAngle: 225, endAngle: -45,
      axisLine: {
        lineStyle: {
          width: 8,
          color: [[0.4615, '#36cfc9'], [1, '#ff6b6b']],
        },
      },
      pointer: {
        length: '55%',
        width: 3,
        itemStyle: { color: '#40a9ff' },
      },
      axisTick: {
        splitNumber: 5,
        distance: -8,
        length: 3,
        lineStyle: { color: '#ffffff', width: 1, opacity: 0.5 },
      },
      splitLine: {
        distance: -8,
        length: 8,
        lineStyle: { color: '#ffffff', width: 2 },
      },
      axisLabel: {
        color: '#e6f3ff',
        distance: -18,
        fontSize: 10,
        fontWeight: 500,
      },
      title: {
        show: true,
        offsetCenter: [0, '-10%'],
        fontSize: 11,
        fontWeight: 600,
        color: '#8adfff',
      },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '62%'],
        formatter: (v: number) => `${v.toFixed(1)}%`,
        fontSize: 15,
        fontWeight: 700,
        color,
      },
      data: [{ value: Math.round(value * 10) / 10, name: '湿度' }],
    }],
  }
}

function gaugeDew(value: number): EChartsOption {
  const color = value < 5 ? '#00d4ff' : value > 20 ? '#fa8c16' : '#a855f7'
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '60%'],
      radius: '80%',
      min: -10, max: 35, splitNumber: 9,
      startAngle: 225, endAngle: -45,
      axisLine: {
        lineStyle: {
          width: 8,
          color: [[15 / 45, '#36cfc9'], [30 / 45, '#a855f7'], [1, '#fa8c16']],
        },
      },
      pointer: {
        length: '55%',
        width: 3,
        itemStyle: { color: '#40a9ff' },
      },
      axisTick: {
        splitNumber: 5,
        distance: -6,
        length: 3,
        lineStyle: { color: '#ffffff', width: 1, opacity: 0.5 },
      },
      splitLine: {
        distance: -6,
        length: 8,
        lineStyle: { color: '#ffffff', width: 2 },
      },
      axisLabel: {
        color: '#e6f3ff',
        distance: -16,
        fontSize: 9,
        fontWeight: 500,
      },
      title: { show: false },
      detail: { show: false },
      data: [{ value: value != null && !Number.isNaN(value) ? Math.round(value * 10) / 10 : 0 }],
    }],
  }
}

function miniGauge(value: number, unit: string, type: 'temp' | 'hum' | 'dew' | 'pressure'): EChartsOption {
  const colors = {
    temp: value < 18 ? ['#00d4ff', '#52c41a', '#ff4d4f'] : value > 35 ? ['#00d4ff', '#fa8c16', '#ff4d4f'] : ['#00d4ff', '#52c41a', '#ff4d4f'],
    hum: value > 65 ? ['#52c41a', '#ff4d4f'] : ['#52c41a', '#ff4d4f'],
    dew: value < 5 ? ['#00d4ff', '#a855f7', '#fa8c16'] : value > 20 ? ['#00d4ff', '#a855f7', '#ff4d4f'] : ['#00d4ff', '#a855f7', '#fa8c16'],
    pressure: ['#ff4d4f', '#40a9ff', '#52c41a'],
  }
  const ranges = {
    temp: { min: 0, max: 40, split: 4 },
    hum: { min: 35, max: 100, split: 2 },
    dew: { min: -10, max: 35, split: 3 },
    pressure: { min: 0, max: 30, split: 3 },
  }
  const r = ranges[type]
  const cs = colors[type]
  const stops: any = type === 'temp'
    ? [[0.45, cs[0]], [35 / 40, cs[1]], [1, cs[2]]]
    : type === 'hum'
      ? [[0.4615, cs[0]], [1, cs[1]]]
      : type === 'dew'
        ? [[15 / 45, cs[0]], [30 / 45, cs[1]], [1, cs[2]]]
        : [[10 / 30, cs[0]], [15 / 30, cs[1]], [1, cs[2]]]

  const mainColor = type === 'temp'
    ? (value < 18 ? '#00d4ff' : value > 35 ? '#ff4d4f' : '#52c41a')
    : type === 'hum'
      ? (value > 65 ? '#ff4d4f' : '#52c41a')
      : type === 'dew'
        ? (value < 5 ? '#00d4ff' : value > 20 ? '#fa8c16' : '#a855f7')
        : (value < 10 ? '#ff4d4f' : value <= 15 ? '#40a9ff' : '#52c41a')

  return {
    series: [{
      type: 'gauge',
      center: ['50%', '58%'],
      radius: '85%',
      min: r.min, max: r.max,
      startAngle: 210, endAngle: -30,
      axisLine: { lineStyle: { width: 8, color: stops } },
      pointer: { itemStyle: { color: mainColor }, width: 2, length: '50%' },
      axisTick: { show: false },
      splitLine: { length: 6, lineStyle: { color: 'rgba(0,212,255,0.3)', width: 1 } },
      axisLabel: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '65%'],
        formatter: (v: number) => `${v.toFixed(1)}`,
        fontSize: 16, fontWeight: 700, color: mainColor,
      },
      data: [{ value: Math.round(value * 10) / 10 }],
    }],
  }
}

function trendOption(
  series: { name: string; color: string; data: (number | null)[] }[],
  times: string[],
  cfg: { leftName: string; rightName: string; isLeftAxis: (name: string) => boolean; markLines?: { yAxis: number; label: string; color: string }[] },
): EChartsOption {
  const xData = times.map((t) => dayjs(t).format('HH:mm'))
  const labelInterval = (index: number) => {
    const t = times[index]; if (!t) return false
    const d = dayjs(t); return d.minute() === 0
  }
  const leftVals: number[] = []; const rightVals: number[] = []
  for (const s of series) {
    const arr = cfg.isLeftAxis(s.name) ? leftVals : rightVals
    for (const v of s.data) { if (v != null && !Number.isNaN(v)) arr.push(v) }
  }
  const axisRange = (vals: number[]) => {
    if (!vals.length) return {}
    const lo = Math.min(...vals); const hi = Math.max(...vals)
    const span = hi - lo || 1; const pad = span * 0.15
    return { min: Math.floor(lo - pad), max: Math.ceil(hi + pad) }
  }
  const lr = axisRange(leftVals); const rr = axisRange(rightVals)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,20,40,0.9)',
      borderColor: 'rgba(0,212,255,0.3)',
      textStyle: { color: '#e6f4ff' },
      formatter: (params: any) => {
        const full = times[params[0].dataIndex]
          ? dayjs(times[params[0].dataIndex]).format('YYYY-MM-DD HH:mm')
          : params[0].name
        let html = `<div style="color:#8adfff;font-size:12px;margin-bottom:4px">${full}</div>`
        for (const p of params) {
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">${p.marker}<span style="color:#cfe6ff">${p.seriesName}</span>: <span style="color:${p.color};font-weight:600">${p.value ?? '-'}</span></div>`
        }
        return html
      },
    },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 20, itemHeight: 10, itemGap: 24,
      textStyle: { color: '#8adfff', fontSize: 12, padding: [0, 0, 0, 4] },
    },
    grid: { left: 44, right: 44, top: 30, bottom: 28 },
    xAxis: {
      type: 'category', data: xData, boundaryGap: false,
      axisLabel: { color: '#5b8ca8', fontSize: 11, hideOverlap: false, interval: labelInterval },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.2)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value', name: cfg.leftName, position: 'left',
        min: lr.min, max: lr.max,
        axisLabel: { color: '#5b8ca8', fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: 'rgba(0,212,255,0.2)' } },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
        nameTextStyle: { color: '#5b8ca8', fontSize: 11, padding: [0, 0, 8, 0] },
      },
      {
        type: 'value', name: cfg.rightName, position: 'right',
        min: rr.min, max: rr.max,
        axisLabel: { color: '#5b8ca8', fontSize: 11 },
        axisLine: { show: true, lineStyle: { color: 'rgba(0,212,255,0.2)' } },
        splitLine: { show: false },
        nameTextStyle: { color: '#5b8ca8', fontSize: 11, padding: [0, 0, 8, 0] },
      },
    ],
    series: series.map((s, idx) => ({
      name: s.name, type: 'line', smooth: true, showSymbol: false,
      yAxisIndex: cfg.isLeftAxis(s.name) ? 0 : 1,
      itemStyle: { color: s.color },
      lineStyle: { width: 2.5, color: s.color, shadowColor: s.color, shadowBlur: 8 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: s.color + '40' },
            { offset: 1, color: s.color + '02' },
          ],
        },
      },
      markLine: idx === 0 && cfg.markLines?.length
        ? {
            silent: true, symbol: 'none',
            animation: false,
            data: cfg.markLines.map((ml) => ({
              yAxis: ml.yAxis,
              label: { formatter: ml.label, color: ml.color, fontSize: 10, position: 'insideEndTop' },
              lineStyle: { type: 'dashed', color: ml.color, width: 1, opacity: 0.6 },
            })),
          }
        : undefined,
      data: s.data,
    })),
  }
}

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

// 动态采集点表盘子组件
function FactorGauge({ factor }: { factor: FactorItem }) {
  const getType = (n: string, t?: string) => {
    if (t) {
      if (t === 'temperature') return 'temp'
      if (t === 'humidity') return 'hum'
      return t
    }
    if (n.includes('温度') && !n.includes('露点')) return 'temp'
    if (n.includes('湿度')) return 'hum'
    if (n.includes('露点')) return 'dew'
    if (n.includes('压差')) return 'pressure'
    return 'temp'
  }
  const type = getType(factor.factor_name, factor.factorType)
  const unit = factor.unit || (type === 'temp' ? '℃' : type === 'hum' ? '%RH' : type === 'pressure' ? 'Pa' : '')
  const option = miniGauge(factor.value, unit, type as any)
  const ref = useChart(option, [factor.value])
  const label = factor.factor_name
  return (
    <div style={{ textAlign: 'center', height: '100%', minHeight: 85, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div ref={ref} style={{ flex: 1, minHeight: 60, width: '100%' }} />
      <div className="bs-gauge-label" style={{ marginTop: -2, fontSize: 11, flexShrink: 0 }}>
        {label}
      </div>
    </div>
  )
}

export default function EnvironmentBigScreen() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1280, designHeight: 720 })

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
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
      const [o, t] = await Promise.all([
        api.get('/auto/dashboard/overview'),
        api.get('/auto/dashboard/trend'),
      ])
      if (o?.data) {
        const raw = o.data as any
        const areas: AreaData[] = []
        if (raw.factors) {
          const ws: AreaData = { name: '生产车间', icon: 'workshop', factors: [] }
          const wh: AreaData = { name: '仓库区域', icon: 'warehouse', factors: [] }
          for (const f of raw.factors as any[]) {
            const name = f.factor_name || ''
            const isTemp = name.includes('温度') && !name.includes('露点')
            const isHum = name.includes('湿度')
            const isDew = name.includes('露点')
            const isPressure = name.includes('压差')
            if (!isTemp && !isHum && !isDew && !isPressure) continue
            let fType: FactorItem['factorType'] = 'temperature'
            if (isTemp) fType = 'temperature'
            else if (isHum) fType = 'humidity'
            else if (isDew) fType = 'dew'
            else if (isPressure) fType = 'pressure'
            const item: FactorItem = {
              factor_name: name, device_name: f.device_name || '',
              factorType: fType,
              value: f.value, unit: f.unit || '',
              device_status: f.device_status || '', collect_time: f.collect_time,
            }
            if (name.includes('车间')) ws.factors.push(item)
            else if (name.includes('仓库')) wh.factors.push(item)
          }
          if (ws.factors.length > 0) areas.push(ws)
          if (wh.factors.length > 0) areas.push(wh)
        }
        setOverview({ areas, alarms: raw.alarms || { total: 0, unhandled: 0, today: 0, recent: [] }, dew_points: raw.dew_points || {}, lastUpdate: raw.lastUpdate || null })
      }
      if (t?.data) setTrend(t.data as TrendData)
    } catch (err) { console.error('加载环境看板失败:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadAll()
    timerRef.current = setInterval(loadAll, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadAll])

  const areaAvg = useMemo(() => {
    const calc = (name: string, type: FactorItem['factorType']) => {
      const area = overview?.areas.find((a) => a.name === name)
      const fs = area?.factors.filter((f) => f.factorType === type) || []
      if (!fs.length) return 0
      return fs.reduce((s, f) => s + f.value, 0) / fs.length
    }
    return {
      wsTemp: calc('生产车间', 'temperature'),
      wsHum: calc('生产车间', 'humidity'),
      wsDew: overview?.dew_points?.workshop ?? 0,
      whTemp: calc('仓库区域', 'temperature'),
      whHum: calc('仓库区域', 'humidity'),
      whDew: overview?.dew_points?.warehouse ?? 0,
    }
  }, [overview])

  const isTemp = (n: string) => n.includes('温度') && !n.includes('露点')
  const isHum = (n: string) => n.includes('湿度')
  const tempSeries = useMemo(() => (trend?.series || []).filter((s) => isTemp(s.name)), [trend])
  const humSeries = useMemo(() => (trend?.series || []).filter((s) => isHum(s.name)), [trend])

  const whTempColor = useMemo(() => {
    const wh = tempSeries.find((s) => s.name.includes('仓库'))
    return wh?.color || '#fa8c16'
  }, [tempSeries])

  const tempCfg = { leftName: '温度(℃)', rightName: '温度(℃)', isLeftAxis: () => true,
    markLines: [
      { yAxis: 18, label: '下限18℃', color: '#00d4ff' },
      { yAxis: 25, label: '车间上限25℃', color: '#ff4d4f' },
      { yAxis: 35, label: '仓库上限35℃', color: whTempColor },
    ] }
  const humCfg = { leftName: '湿度(%)', rightName: '湿度(%)', isLeftAxis: () => true,
    markLines: [{ yAxis: 65, label: '限值65%', color: '#ff4d4f' }] }

  const wsTempRef = useChart(gaugeTemp(areaAvg.wsTemp, 'workshop'), [areaAvg.wsTemp])
  const wsHumRef = useChart(gaugeHum(areaAvg.wsHum), [areaAvg.wsHum])
  const wsDewRef = useChart(gaugeDew(areaAvg.wsDew), [areaAvg.wsDew])
  const whTempRef = useChart(gaugeTemp(areaAvg.whTemp, 'warehouse'), [areaAvg.whTemp])
  const whHumRef = useChart(gaugeHum(areaAvg.whHum), [areaAvg.whHum])
  const whDewRef = useChart(gaugeDew(areaAvg.whDew), [areaAvg.whDew])

  // 所有采集点（温湿度 + 压差）- 按指定顺序排序
  const allFactors = useMemo(() => {
    const list: FactorItem[] = []
    if (!overview?.areas) return list
    for (const a of overview.areas) {
      for (const f of a.factors) {
        const n = f.factor_name || ''
        if (n.includes('温度') && !n.includes('露点')) list.push({ ...f, factorType: 'temperature' })
        else if (n.includes('湿度')) list.push({ ...f, factorType: 'humidity' })
        else if (n.includes('露点')) list.push({ ...f, factorType: 'dew' })
        else if (n.includes('压差')) list.push({ ...f, factorType: 'pressure' })
      }
    }
    // 自定义排序权重
    const getRank = (name: string) => {
      if (name.includes('车间') && name.includes('前端') && name.includes('压差')) return 1
      if (name.includes('车间') && (name.includes('后段') || name.includes('后端')) && name.includes('压差')) return 2
      if (name.includes('车间') && name.includes('前端') && name.includes('温度')) return 3
      if (name.includes('车间') && name.includes('前端') && name.includes('湿度')) return 4
      if (name.includes('仓库') && name.includes('前端') && name.includes('温度')) return 5
      if (name.includes('仓库') && name.includes('前端') && name.includes('湿度')) return 6
      if (name.includes('仓库') && (name.includes('中段') || name.includes('中端')) && name.includes('温度')) return 7
      if (name.includes('仓库') && (name.includes('中段') || name.includes('中端')) && name.includes('湿度')) return 8
      if (name.includes('仓库') && (name.includes('后段') || name.includes('后端')) && name.includes('温度')) return 9
      if (name.includes('仓库') && (name.includes('后段') || name.includes('后端')) && name.includes('湿度')) return 10
      return 99
    }
    return list.sort((a, b) => getRank(a.factor_name) - getRank(b.factor_name))
  }, [overview])

  const tempRef = useChart(tempSeries.length ? trendOption(tempSeries, trend?.times || [], tempCfg) : null, [tempSeries, trend?.times, whTempColor])
  const humRef = useChart(humSeries.length ? trendOption(humSeries, trend?.times || [], humCfg) : null, [humSeries, trend?.times])

  const alarms = overview?.alarms
  const hasAlarm = (alarms?.unhandled || 0) > 0

  const leftDateTime = (
    <div className="bs-header-date">
      <span className="bs-header-date-main">{formatDateTime(currentTime)}</span>
      <span className="bs-header-date-week">{getWeekday(currentTime)}</span>
    </div>
  )

  const rightUpdateTime = (
    <div className="bs-header-update">
      <span>更新时间</span>
      <span className="bs-header-update-time">{formatClock(currentTime)}</span>
    </div>
  )

  return (
    <div style={{ width: '100vw', height: '100vh', minWidth: 1280, minHeight: 720, overflow: 'hidden' }}>
      <div className="bigscreen-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minWidth: 1280, minHeight: 720, overflow: 'hidden' }}>
        <BigScreenHeader
          title="环境监测中心"
          extraLeft={leftDateTime}
          extraRight={rightUpdateTime}
          onRefresh={loadAll}
          refreshing={loading}
        />

        {/* 主体三栏布局 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, padding: 10, flexDirection: 'column', position: 'relative' }}>
          {loading && !overview && (
            <div className="bs-loading-overlay">
              <Spin size="large" />
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            {/* 左栏：生产车间 + 仓库 */}
            <div style={{ flex: '0 0 25%', minWidth: 280, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <BigScreenPanel
                title="生产车间"
                titleIcon={<ShopOutlined />}
                titleExtra={`${overview?.areas.find(a => a.name === '生产车间')?.factors.length ?? 0} 个监测点`}
                style={{ flex: 1, minHeight: 0 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
              >
                <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
                  <div className="bs-gauge-card" style={{ flex: 1, minHeight: 0, padding: 4 }}>
                    <div ref={wsTempRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="bs-gauge-card" style={{ flex: 1, minHeight: 0, padding: 4 }}>
                    <div ref={wsHumRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                </div>
              </BigScreenPanel>

              <BigScreenPanel
                title="仓库区域"
                titleIcon={<HomeOutlined />}
                titleExtra={`${overview?.areas.find(a => a.name === '仓库区域')?.factors.length ?? 0} 个监测点`}
                style={{ flex: 1, minHeight: 0 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
              >
                <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
                  <div className="bs-gauge-card" style={{ flex: 1, minHeight: 0, padding: 4 }}>
                    <div ref={whTempRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="bs-gauge-card" style={{ flex: 1, minHeight: 0, padding: 4 }}>
                    <div ref={whHumRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                </div>
              </BigScreenPanel>

              {/* 露点温度卡片 */}
              <div className="bs-gauge-card" style={{ padding: 4, flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, color: '#8adfff', fontWeight: 500, zIndex: 2 }}>生产车间</div>
                <div style={{ position: 'absolute', top: 6, right: 10, fontSize: 11, color: '#8adfff', fontWeight: 500, zIndex: 2 }}>仓库区域</div>
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'stretch', gap: 8, paddingTop: 20, flex: 1, minHeight: 0 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div ref={wsDewRef} style={{ flex: 1, width: '100%', minHeight: 0 }} />
                    <span className="bs-gauge-value" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, textAlign: 'center', marginTop: -6, paddingBottom: 2 }}>{areaAvg.wsDew.toFixed(1)}℃</span>
                  </div>
                  <div style={{ width: 1, background: 'rgba(0,212,255,0.2)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div ref={whDewRef} style={{ flex: 1, width: '100%', minHeight: 0 }} />
                    <span className="bs-gauge-value" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, textAlign: 'center', marginTop: -6, paddingBottom: 2 }}>{areaAvg.whDew.toFixed(1)}℃</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 中栏：温湿度趋势图（上下堆叠） */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <BigScreenPanel
                title="过去12小时温度趋势"
                titleIcon={<ThunderboltOutlined />}
                style={{ flex: 1 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column' }}
              >
                <div ref={tempRef} className="bs-chart-container" style={{ flex: 1, minHeight: 0 }} />
              </BigScreenPanel>

              <BigScreenPanel
                title="过去12小时湿度趋势"
                titleIcon={<CloudOutlined />}
                style={{ flex: 1 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column' }}
              >
                <div ref={humRef} className="bs-chart-container" style={{ flex: 1, minHeight: 0 }} />
              </BigScreenPanel>
            </div>

            {/* 右栏：所有采集点仪表 */}
            <div style={{ flex: '0 0 25%', minWidth: 280, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <BigScreenPanel
                title={`所有采集点 (${allFactors.length})`}
                titleIcon={<DashboardOutlined />}
                style={{ flex: 1 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                <Row
                  gutter={[12, 8]}
                  style={{ flex: 1, minHeight: 0, display: 'flex', alignContent: 'flex-start' }}
                >
                  {allFactors.map((f, idx) => (
                    <Col
                      span={12}
                      key={`${f.factor_name}-${idx}`}
                      style={{ height: `${100 / Math.ceil(allFactors.length / 2)}%` }}
                    >
                      <FactorGauge factor={f} />
                    </Col>
                  ))}
                  {allFactors.length === 0 && (
                    <Col span={24}>
                      <div style={{ textAlign: 'center', color: '#5b8ca8', padding: 30 }}>暂无采集点数据</div>
                    </Col>
                  )}
                </Row>
              </BigScreenPanel>
            </div>
          </div>

          {/* 底部状态栏 */}
          <div className="bs-footer-bar">
            <div className={`bs-footer-status ${hasAlarm ? 'error' : ''}`}>
              <span className="dot" />
              <span>报警状态 {hasAlarm ? `${alarms?.unhandled || 0} 条未处理` : '正常'}</span>
            </div>
            <div className="bs-footer-status">
              <span>今日报警 {alarms?.today || 0} 条 | 累计 {alarms?.total || 0} 条</span>
            </div>
            <div className="bs-footer-status">
              <span>采集频率 10 分钟</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
