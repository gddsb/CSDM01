import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Row, Col, Spin, Space } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import {
  ShopOutlined, HomeOutlined, FireOutlined, CloudOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { useBigScreenScale } from '../../hooks/useBigScreenScale'
import '../../styles/bigscreen.css'

interface FactorItem {
  factor_name: string
  device_name: string
  factorType: 'temperature' | 'humidity'
  value: number
  unit: string
  device_status: string
  collect_time: string
}

interface AreaData {
  name: string
  icon: string
  factors: FactorItem[]
}

interface OverviewData {
  areas: AreaData[]
  alarms: { total: number; unhandled: number; today: number; recent: any[] }
  dew_points?: { workshop?: number | null; warehouse?: number | null; [key: string]: number | null | undefined }
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

function gaugeTempOption(value: number, area: 'workshop' | 'warehouse'): EChartsOption {
  const upper = area === 'workshop' ? 25 : 35
  const color = value < 18 ? '#1890ff' : value > upper ? '#ff4d4f' : '#52c41a'
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '78%',
      min: 0,
      max: 40,
      splitNumber: 8,
      axisLine: {
        lineStyle: {
          width: 12,
          color: [
            [0.45, '#1890ff'],
            [upper / 40, '#52c41a'],
            [1, '#ff4d4f'],
          ],
        },
      },
      pointer: { itemStyle: { color }, width: 4, length: '58%' },
      axisTick: { length: 4, lineStyle: { color: 'auto', width: 1 } },
      splitLine: { length: 10, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#aaa', distance: 16, fontSize: 9 },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '78%'],
        formatter: '{value} °C',
        fontSize: 20,
        fontWeight: 700,
        color,
      },
      data: [{ value: Math.round(value * 10) / 10 }],
    }],
  }
}

function gaugeHumOption(value: number): EChartsOption {
  const color = value > 65 ? '#ff4d4f' : '#52c41a'
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '78%',
      min: 35,
      max: 100,
      splitNumber: 5,
      axisLine: {
        lineStyle: {
          width: 12,
          color: [
            [0.4615, '#52c41a'],
            [1, '#ff4d4f'],
          ],
        },
      },
      pointer: { itemStyle: { color }, width: 4, length: '58%' },
      axisTick: { length: 4, lineStyle: { color: 'auto', width: 1 } },
      splitLine: { length: 10, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#aaa', distance: 16, fontSize: 9 },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '78%'],
        formatter: '{value} %',
        fontSize: 20,
        fontWeight: 700,
        color,
      },
      data: [{ value: Math.round(value * 10) / 10 }],
    }],
  }
}

function gaugeDewOption(value: number): EChartsOption {
  const color = value < 5 ? '#1890ff' : value > 20 ? '#fa8c16' : '#a855f7'
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '78%',
      min: -10,
      max: 35,
      splitNumber: 9,
      axisLine: {
        lineStyle: {
          width: 12,
          color: [
            [15 / 45, '#1890ff'],
            [30 / 45, '#a855f7'],
            [1, '#fa8c16'],
          ],
        },
      },
      pointer: { itemStyle: { color }, width: 4, length: '58%' },
      axisTick: { length: 4, lineStyle: { color: 'auto', width: 1 } },
      splitLine: { length: 10, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#aaa', distance: 16, fontSize: 9 },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '78%'],
        formatter: '{value} °C',
        fontSize: 20,
        fontWeight: 700,
        color,
      },
      data: [{ value: value != null && !Number.isNaN(value) ? Math.round(value * 10) / 10 : 0 }],
    }],
  }
}

interface TrendConfig {
  leftName: string
  rightName: string
  rightMin?: number
  rightMax?: number
  isLeftAxis: (name: string) => boolean
  markLines?: { yAxis: number; label: string; color: string }[]
}

function trendOption(
  series: { name: string; color: string; data: (number | null)[] }[],
  times: string[],
  cfg: TrendConfig,
): EChartsOption {
  const xData = times.map((t) => dayjs(t).format('HH:00'))

  const leftVals: number[] = []
  const rightVals: number[] = []
  for (const s of series) {
    const arr = cfg.isLeftAxis(s.name) ? leftVals : rightVals
    for (const v of s.data) {
      if (v !== null && v !== undefined && !Number.isNaN(v)) arr.push(v)
    }
  }
  const axisRange = (vals: number[]) => {
    if (vals.length === 0) return { min: undefined as number | undefined, max: undefined as number | undefined }
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const span = hi - lo
    const pad = span < 1 ? 1 : span * 0.1
    return { min: Math.floor(lo - pad), max: Math.ceil(hi + pad) }
  }
  const leftRange = axisRange(leftVals)
  const rightRange = axisRange(rightVals)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const full = times[params[0].dataIndex]
          ? dayjs(times[params[0].dataIndex]).format('YYYY-MM-DD HH:00')
          : params[0].name
        let html = full + '<br/>'
        for (const p of params) {
          html += `${p.marker} ${p.seriesName}: ${p.value ?? '-'}<br/>`
        }
        return html
      },
    },
    legend: { top: 0, icon: 'roundRect', textStyle: { color: '#ccc' } },
    grid: { left: 52, right: 58, top: 35, bottom: 32 },
    xAxis: {
      type: 'category', data: xData, boundaryGap: false,
      axisLabel: { color: '#888', fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: '#333' } },
    },
    yAxis: [
      {
        type: 'value', name: cfg.leftName, position: 'left',
        min: leftRange.min, max: leftRange.max,
        minInterval: 1,
        axisLabel: {
          color: '#888',
          formatter: (v: number | string) => typeof v === 'number' ? Math.round(v).toString() : v,
        },
        splitLine: { lineStyle: { color: '#1a1a2e' } },
        nameTextStyle: { color: '#888' },
      },
      {
        type: 'value', name: cfg.rightName, position: 'right',
        min: rightRange.min, max: rightRange.max,
        minInterval: 1,
        axisLabel: {
          color: '#888',
          formatter: (v: number | string) => typeof v === 'number' ? Math.round(v).toString() : v,
        },
        splitLine: { show: false },
        nameTextStyle: { color: '#888' },
      },
    ],
    series: series.map((s, idx) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      yAxisIndex: cfg.isLeftAxis(s.name) ? 0 : 1,
      itemStyle: { color: s.color },
      lineStyle: { width: 2.5, color: s.color },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: s.color + '50' },
            { offset: 1, color: s.color + '05' },
          ],
        },
      },
      markLine: idx === 0 && cfg.markLines && cfg.markLines.length > 0 ? {
        silent: true,
        symbol: 'none',
        data: cfg.markLines.map((ml) => ({
          yAxis: ml.yAxis,
          label: { formatter: ml.label, color: ml.color, fontSize: 9 },
          lineStyle: { type: 'dashed', color: ml.color, width: 1, opacity: 0.5 },
        })),
      } : undefined,
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
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option, true)
    }
  }, [option, ...deps])

  return ref
}

export default function EnvironmentBigScreen() {
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1920, designHeight: 1080 })

  // 时钟
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [o, t] = await Promise.all([
        api.get('/auto/dashboard/overview'),
        api.get('/auto/dashboard/trend'),
      ])
      if (o && o.data) {
        const raw = o.data as any
        const areas: AreaData[] = []
        if (raw.factors) {
          const ws: AreaData = { name: '生产车间', icon: 'workshop', factors: [] }
          const wh: AreaData = { name: '仓库', icon: 'warehouse', factors: [] }
          for (const f of raw.factors as any[]) {
            const name: string = f.factor_name || ''
            if (!name.includes('温度') && !name.includes('湿度')) continue
            const item: FactorItem = {
              factor_name: name,
              device_name: f.device_name || '',
              factorType: name.includes('温度') ? 'temperature' : 'humidity',
              value: f.value,
              unit: f.unit || '',
              device_status: f.device_status || '',
              collect_time: f.collect_time,
            }
            if (name.includes('车间')) ws.factors.push(item)
            else if (name.includes('仓库')) wh.factors.push(item)
          }
          if (ws.factors.length > 0) areas.push(ws)
          if (wh.factors.length > 0) areas.push(wh)
        }
        setOverview({ areas, alarms: raw.alarms || { total: 0, unhandled: 0, today: 0, recent: [] }, lastUpdate: raw.lastUpdate || null })
      }
      if (t && t.data) setTrend(t.data as TrendData)
    } catch (err: any) {
      console.error('加载环境看板数据失败:', err)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadAll()
    timerRef.current = setInterval(loadAll, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadAll])

  const areaAvg = useMemo(() => {
    const calc = (areaName: string, type: 'temperature' | 'humidity') => {
      const area = overview?.areas.find((a) => a.name === areaName)
      const factors = area?.factors.filter((f) => f.factorType === type) || []
      if (factors.length === 0) return 0
      return factors.reduce((s, f) => s + f.value, 0) / factors.length
    }
    const workshopTemp = calc('生产车间', 'temperature')
    const workshopHum = calc('生产车间', 'humidity')
    const warehouseTemp = calc('仓库', 'temperature')
    const warehouseHum = calc('仓库', 'humidity')
    const workshopDew = overview?.dew_points?.workshop ?? null
    const warehouseDew = overview?.dew_points?.warehouse ?? null
    return {
      workshopTemp,
      workshopHum,
      workshopDew: workshopDew as number | null,
      warehouseTemp,
      warehouseHum,
      warehouseDew: warehouseDew as number | null,
    }
  }, [overview])

  const isTemp = (n: string) => n.includes('温度') && !n.includes('露点')
  const isHum = (n: string) => n.includes('湿度')
  const tempSeries = useMemo(() =>
    (trend?.series || []).filter((s) => isTemp(s.name)), [trend])
  const humSeries = useMemo(() =>
    (trend?.series || []).filter((s) => isHum(s.name)), [trend])

  const tempTrendConfig: TrendConfig = {
    leftName: '温度(℃)',
    rightName: '温度(℃)',
    isLeftAxis: () => true,
    markLines: [
      { yAxis: 18, label: '下限18', color: '#1890ff' },
      { yAxis: 25, label: '车间上限25', color: '#ff4d4f' },
      { yAxis: 35, label: '仓库上限35', color: '#fa8c16' },
    ],
  }

  const humTrendConfig: TrendConfig = {
    leftName: '湿度(%)',
    rightName: '湿度(%)',
    rightMin: 0, rightMax: 100,
    isLeftAxis: () => true,
    markLines: [
      { yAxis: 65, label: '限值65%', color: '#ff4d4f' },
    ],
  }

  const workshopTempRef = useChart(gaugeTempOption(areaAvg.workshopTemp, 'workshop'), [areaAvg.workshopTemp])
  const workshopHumRef = useChart(gaugeHumOption(areaAvg.workshopHum), [areaAvg.workshopHum])
  const workshopDewRef = useChart(gaugeDewOption(areaAvg.workshopDew ?? 0), [areaAvg.workshopDew])
  const warehouseTempRef = useChart(gaugeTempOption(areaAvg.warehouseTemp, 'warehouse'), [areaAvg.warehouseTemp])
  const warehouseHumRef = useChart(gaugeHumOption(areaAvg.warehouseHum), [areaAvg.warehouseHum])
  const warehouseDewRef = useChart(gaugeDewOption(areaAvg.warehouseDew ?? 0), [areaAvg.warehouseDew])
  const tempTrendRef = useChart(
    tempSeries.length > 0 ? trendOption(tempSeries, trend?.times || [], tempTrendConfig) : null,
    [tempSeries, trend?.times],
  )
  const humTrendRef = useChart(
    humSeries.length > 0 ? trendOption(humSeries, trend?.times || [], humTrendConfig) : null,
    [humSeries, trend?.times],
  )

  return (
    <div
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0e1a' }}
    >
      <div
        className="bigscreen-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '1080px',
          overflow: 'hidden',
          ...scaleStyle,
        }}
      >
        {/* 顶部标题栏 */}
        <div className="bs-header">
          <div className="bs-header-left">
            <span
              style={{ color: '#8B949E', cursor: 'pointer', fontSize: 16 }}
              onClick={() => navigate('/dashboard')}
              title="返回工作台"
            >
              <ArrowLeftOutlined />
            </span>
            <div className="bs-screen-tabs">
              <div className="bs-screen-tab" onClick={() => navigate('/bigscreen/production')}>生产大屏</div>
              <div className="bs-screen-tab active">环境大屏</div>
              <div className="bs-screen-tab" onClick={() => navigate('/bigscreen/management')}>管理大屏</div>
            </div>
          </div>
          <div className="bs-header-center">
            <div className="bs-title">环境监测大屏</div>
          </div>
          <div className="bs-header-right">
            {overview?.lastUpdate && (
              <Space size="small">
                <ClockCircleOutlined style={{ color: '#8B949E' }} />
                <span style={{ color: '#8B949E', fontSize: 12 }}>最后更新: {fmtTime(overview.lastUpdate)}</span>
              </Space>
            )}
            <span
              style={{ color: '#3FB950', cursor: 'pointer', fontSize: 14 }}
              onClick={loadAll}
              title="刷新数据"
            >
              <ReloadOutlined spin={loading} />
            </span>
            <div className="bs-time">{formatTime(currentTime)}</div>
          </div>
        </div>

        <Spin spinning={loading && !overview} style={{ flex: 1, minHeight: 0 }}>
          {/* 第一行：生产车间仪表盘 | 仓库仪表盘 */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, marginBottom: 10 }}>
            {/* 左：生产车间 */}
            <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="bs-panel-title">
                <ShopOutlined style={{ color: '#722ed1', fontSize: 16 }} />
                生产车间
                <span style={{ color: '#8B949E', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                  {overview?.areas.find((a) => a.name === '生产车间')?.factors.length ?? 0} 个监测点
                </span>
              </div>
              <Row style={{ flex: 1, minHeight: 0 }}>
                <Col xs={8}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <div style={{ color: '#ff7875', fontSize: 13, marginBottom: 4 }}>
                      <FireOutlined /> 温度
                    </div>
                    <div ref={workshopTempRef} style={{ height: 210 }} />
                  </div>
                </Col>
                <Col xs={8}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <div style={{ color: '#69c0ff', fontSize: 13, marginBottom: 4 }}>
                      <CloudOutlined /> 湿度
                    </div>
                    <div ref={workshopHumRef} style={{ height: 210 }} />
                  </div>
                </Col>
                <Col xs={8}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <div style={{ color: '#a855f7', fontSize: 13, marginBottom: 4 }}>
                      💧 露点
                    </div>
                    <div ref={workshopDewRef} style={{ height: 210 }} />
                  </div>
                </Col>
              </Row>
            </div>

            {/* 右：仓库 */}
            <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="bs-panel-title">
                <HomeOutlined style={{ color: '#13c2c2', fontSize: 16 }} />
                仓库
                <span style={{ color: '#8B949E', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                  {overview?.areas.find((a) => a.name === '仓库')?.factors.length ?? 0} 个监测点
                </span>
              </div>
              <Row style={{ flex: 1, minHeight: 0 }}>
                <Col xs={8}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <div style={{ color: '#ff7875', fontSize: 13, marginBottom: 4 }}>
                      <FireOutlined /> 温度
                    </div>
                    <div ref={warehouseTempRef} style={{ height: 210 }} />
                  </div>
                </Col>
                <Col xs={8}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <div style={{ color: '#69c0ff', fontSize: 13, marginBottom: 4 }}>
                      <CloudOutlined /> 湿度
                    </div>
                    <div ref={warehouseHumRef} style={{ height: 210 }} />
                  </div>
                </Col>
                <Col xs={8}>
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <div style={{ color: '#f59e0b', fontSize: 13, marginBottom: 4 }}>
                      💧 露点
                    </div>
                    <div ref={warehouseDewRef} style={{ height: 210 }} />
                  </div>
                </Col>
              </Row>
            </div>
          </div>

          {/* 第二行：温度趋势 | 湿度趋势（最近12小时） */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            {/* 左：温度趋势 */}
            <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="bs-panel-title">
                <FireOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                温度趋势
                <span style={{ color: '#8B949E', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>（最近12h）</span>
              </div>
              <div ref={tempTrendRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </div>

            {/* 右：湿度趋势 */}
            <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="bs-panel-title">
                <CloudOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                湿度趋势
                <span style={{ color: '#8B949E', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>（最近12h）</span>
              </div>
              <div ref={humTrendRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </div>
          </div>
        </Spin>
      </div>
    </div>
  )
}
