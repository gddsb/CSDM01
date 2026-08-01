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
  factorType: 'temperature' | 'humidity'
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
      center: ['50%', '52%'],
      radius: '80%',
      min: 0, max: 40, splitNumber: 8,
      startAngle: 225, endAngle: -45,
      axisLine: {
        lineStyle: {
          width: 14,
          color: [
            [0.45, '#00d4ff'],
            [upper / 40, '#52c41a'],
            [1, '#ff4d4f'],
          ],
        },
      },
      pointer: { itemStyle: { color }, width: 4, length: '60%' },
      axisTick: { length: 6, lineStyle: { color: 'auto', width: 1.5 } },
      splitLine: { length: 14, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#5b8ca8', distance: 20, fontSize: 10 },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '72%'],
        formatter: (v: number) => `${v.toFixed(1)}`,
        fontSize: 24, fontWeight: 700, color,
      },
      data: [{ value: Math.round(value * 10) / 10 }],
    }],
  }
}

function gaugeHum(value: number): EChartsOption {
  const color = value > 65 ? '#ff4d4f' : '#52c41a'
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '52%'],
      radius: '80%',
      min: 35, max: 100, splitNumber: 5,
      startAngle: 225, endAngle: -45,
      axisLine: {
        lineStyle: {
          width: 14,
          color: [[0.4615, '#52c41a'], [1, '#ff4d4f']],
        },
      },
      pointer: { itemStyle: { color }, width: 4, length: '60%' },
      axisTick: { length: 6, lineStyle: { color: 'auto', width: 1.5 } },
      splitLine: { length: 14, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#5b8ca8', distance: 20, fontSize: 10 },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '72%'],
        formatter: (v: number) => `${v.toFixed(1)}%`,
        fontSize: 22, fontWeight: 700, color,
      },
      data: [{ value: Math.round(value * 10) / 10 }],
    }],
  }
}

function gaugeDew(value: number): EChartsOption {
  const color = value < 5 ? '#00d4ff' : value > 20 ? '#fa8c16' : '#a855f7'
  return {
    series: [{
      type: 'gauge',
      center: ['50%', '52%'],
      radius: '80%',
      min: -10, max: 35, splitNumber: 9,
      startAngle: 225, endAngle: -45,
      axisLine: {
        lineStyle: {
          width: 14,
          color: [[15 / 45, '#00d4ff'], [30 / 45, '#a855f7'], [1, '#fa8c16']],
        },
      },
      pointer: { itemStyle: { color }, width: 4, length: '60%' },
      axisTick: { length: 6, lineStyle: { color: 'auto', width: 1.5 } },
      splitLine: { length: 14, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#5b8ca8', distance: 20, fontSize: 10 },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '72%'],
        formatter: (v: number) => `${v.toFixed(1)}℃`,
        fontSize: 22, fontWeight: 700, color,
      },
      data: [{ value: value != null && !Number.isNaN(value) ? Math.round(value * 10) / 10 : 0 }],
    }],
  }
}

function miniGauge(value: number, unit: string, type: 'temp' | 'hum' | 'dew'): EChartsOption {
  const colors = {
    temp: value < 18 ? ['#00d4ff', '#52c41a', '#ff4d4f'] : value > 30 ? ['#00d4ff', '#fa8c16', '#ff4d4f'] : ['#00d4ff', '#52c41a', '#ff4d4f'],
    hum: value > 65 ? ['#52c41a', '#ff4d4f'] : ['#52c41a', '#ff4d4f'],
    dew: value < 5 ? ['#00d4ff', '#a855f7', '#fa8c16'] : value > 20 ? ['#00d4ff', '#a855f7', '#ff4d4f'] : ['#00d4ff', '#a855f7', '#fa8c16'],
  }
  const ranges = {
    temp: { min: 0, max: 40, split: 4 },
    hum: { min: 35, max: 100, split: 2 },
    dew: { min: -10, max: 35, split: 3 },
  }
  const r = ranges[type]
  const cs = colors[type]
  const stops = type === 'temp'
    ? [[0.45, cs[0]], [25 / 40, cs[1]], [1, cs[2]]]
    : type === 'hum'
      ? [[0.4615, cs[0]], [1, cs[1]]]
      : [[15 / 45, cs[0]], [30 / 45, cs[1]], [1, cs[2]]]

  const mainColor = type === 'temp'
    ? (value < 18 ? '#00d4ff' : value > (type === 'temp' ? 30 : 20) ? '#ff4d4f' : '#52c41a')
    : type === 'hum'
      ? (value > 65 ? '#ff4d4f' : '#52c41a')
      : (value < 5 ? '#00d4ff' : value > 20 ? '#fa8c16' : '#a855f7')

  return {
    series: [{
      type: 'gauge',
      center: ['50%', '58%'],
      radius: '88%',
      min: r.min, max: r.max,
      startAngle: 210, endAngle: -30,
      axisLine: { lineStyle: { width: 10, color: stops } },
      pointer: { itemStyle: { color: mainColor }, width: 3, length: '50%' },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { color: 'rgba(0,212,255,0.3)', width: 1 } },
      axisLabel: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '65%'],
        formatter: (v: number) => `${v.toFixed(1)}`,
        fontSize: 20, fontWeight: 700, color: mainColor,
        textShadowColor: mainColor, textShadowBlur: 10,
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
    grid: { left: 60, right: 60, top: 40, bottom: 36 },
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
            data: cfg.markLines.map((ml) => ({
              yAxis: ml.yAxis,
              label: { formatter: ml.label, color: ml.color, fontSize: 10 },
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

export default function EnvironmentBigScreen() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1920, designHeight: 1080 })

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
            if (!name.includes('温度') && !name.includes('湿度')) continue
            const item: FactorItem = {
              factor_name: name, device_name: f.device_name || '',
              factorType: name.includes('温度') ? 'temperature' : 'humidity',
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
    const calc = (name: string, type: 'temperature' | 'humidity') => {
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

  const tempCfg = { leftName: '温度(℃)', rightName: '温度(℃)', isLeftAxis: () => true,
    markLines: [{ yAxis: 18, label: '下限18℃', color: '#00d4ff' }, { yAxis: 25, label: '上限25℃', color: '#ff4d4f' }] }
  const humCfg = { leftName: '湿度(%)', rightName: '湿度(%)', isLeftAxis: () => true,
    markLines: [{ yAxis: 65, label: '限值65%', color: '#ff4d4f' }] }

  const wsTempRef = useChart(gaugeTemp(areaAvg.wsTemp, 'workshop'), [areaAvg.wsTemp])
  const wsHumRef = useChart(gaugeHum(areaAvg.wsHum), [areaAvg.wsHum])
  const wsDewRef = useChart(gaugeDew(areaAvg.wsDew), [areaAvg.wsDew])
  const whTempRef = useChart(gaugeTemp(areaAvg.whTemp, 'warehouse'), [areaAvg.whTemp])
  const whHumRef = useChart(gaugeHum(areaAvg.whHum), [areaAvg.whHum])
  const whDewRef = useChart(gaugeDew(areaAvg.whDew), [areaAvg.whDew])

  const g1 = useChart(miniGauge(areaAvg.wsTemp, '℃', 'temp'), [areaAvg.wsTemp])
  const g2 = useChart(miniGauge(areaAvg.wsHum, '%RH', 'hum'), [areaAvg.wsHum])
  const g3 = useChart(miniGauge(areaAvg.whTemp, '℃', 'temp'), [areaAvg.whTemp])
  const g4 = useChart(miniGauge(areaAvg.whHum, '%RH', 'hum'), [areaAvg.whHum])

  const tempRef = useChart(tempSeries.length ? trendOption(tempSeries, trend?.times || [], tempCfg) : null, [tempSeries, trend?.times])
  const humRef = useChart(humSeries.length ? trendOption(humSeries, trend?.times || [], humCfg) : null, [humSeries, trend?.times])

  const alarms = overview?.alarms
  const hasAlarm = (alarms?.unhandled || 0) > 0

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div className="bigscreen-container" style={{ display: 'flex', flexDirection: 'column', height: '1080px', overflow: 'hidden', ...scaleStyle }}>
        <BigScreenHeader
          title="环境监测中心"
          onRefresh={loadAll}
          refreshing={loading}
        />

        {/* 主体三栏布局 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12, padding: 12, flexDirection: 'column', position: 'relative' }}>
          {loading && !overview && (
            <div className="bs-loading-overlay">
              <Spin size="large" />
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
            {/* 左栏：生产车间 + 仓库 */}
            <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <BigScreenPanel
                title="生产车间"
                titleIcon={<ShopOutlined />}
                titleExtra={`${overview?.areas.find(a => a.name === '生产车间')?.factors.length ?? 0} 个监测点`}
                style={{ flex: 1 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column' }}
              >
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <div className="bs-gauge-card">
                      <div className="bs-gauge-label"><FireOutlined /> 温度</div>
                      <div ref={wsTempRef} style={{ height: 130 }} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="bs-gauge-card">
                      <div className="bs-gauge-label"><CloudOutlined /> 湿度</div>
                      <div ref={wsHumRef} style={{ height: 130 }} />
                    </div>
                  </Col>
                  <Col span={24}>
                    <div className="bs-gauge-card" style={{ padding: 6 }}>
                      <div className="bs-gauge-label" style={{ textAlign: 'center' }}>💧 露点温度</div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                        <div ref={wsDewRef} style={{ height: 90, width: 120 }} />
                        <span className="bs-gauge-value" style={{ fontSize: 22 }}>{areaAvg.wsDew.toFixed(1)}℃</span>
                      </div>
                    </div>
                  </Col>
                </Row>
              </BigScreenPanel>

              <BigScreenPanel
                title="仓库区域"
                titleIcon={<HomeOutlined />}
                titleExtra={`${overview?.areas.find(a => a.name === '仓库区域')?.factors.length ?? 0} 个监测点`}
                style={{ flex: 1 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column' }}
              >
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <div className="bs-gauge-card">
                      <div className="bs-gauge-label"><FireOutlined /> 温度</div>
                      <div ref={whTempRef} style={{ height: 130 }} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="bs-gauge-card">
                      <div className="bs-gauge-label"><CloudOutlined /> 湿度</div>
                      <div ref={whHumRef} style={{ height: 130 }} />
                    </div>
                  </Col>
                  <Col span={24}>
                    <div className="bs-gauge-card" style={{ padding: 6 }}>
                      <div className="bs-gauge-label" style={{ textAlign: 'center' }}>💧 露点温度</div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                        <div ref={whDewRef} style={{ height: 90, width: 120 }} />
                        <span className="bs-gauge-value" style={{ fontSize: 22 }}>{areaAvg.whDew.toFixed(1)}℃</span>
                      </div>
                    </div>
                  </Col>
                </Row>
              </BigScreenPanel>
            </div>

            {/* 中栏：温度趋势图 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <BigScreenPanel
                title="过去12小时温湿度趋势"
                titleIcon={<ThunderboltOutlined />}
                style={{ flex: 1 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column' }}
              >
                <div ref={tempRef} className="bs-chart-container" style={{ flex: 1 }} />
              </BigScreenPanel>
            </div>

            {/* 右栏：分区监测仪表 */}
            <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <BigScreenPanel
                title="分区监测仪表"
                titleIcon={<DashboardOutlined />}
                style={{ flex: 1 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div ref={g1} style={{ height: 130 }} />
                      <div className="bs-gauge-label" style={{ marginTop: -4 }}>车间温度</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div ref={g2} style={{ height: 130 }} />
                      <div className="bs-gauge-label" style={{ marginTop: -4 }}>车间湿度</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div ref={g3} style={{ height: 130 }} />
                      <div className="bs-gauge-label" style={{ marginTop: -4 }}>仓库温度</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div ref={g4} style={{ height: 130 }} />
                      <div className="bs-gauge-label" style={{ marginTop: -4 }}>仓库湿度</div>
                    </div>
                  </Col>
                </Row>
              </BigScreenPanel>

              <BigScreenPanel
                title="湿度趋势"
                titleIcon={<CloudOutlined />}
                style={{ flex: 1 }}
                bodyStyle={{ display: 'flex', flexDirection: 'column' }}
              >
                <div ref={humRef} className="bs-chart-container" style={{ flex: 1 }} />
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
