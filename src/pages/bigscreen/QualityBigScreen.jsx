import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import {
  incomingInspections,
  finishedInspections,
  microbeInspections,
  envInspections,
  complaints,
  instruments,
  inspectionStandards,
  materials,
} from '../../mock/data'
import logoRect from '../../assets/logo-rect.png'
import '../../styles/bigscreen.css'

// 环境数据更新间隔
const ENV_REFRESH_INTERVAL = 8 * 1000
// 无操作自动隐藏阈值
const IDLE_THRESHOLD = 15 * 1000

// 提取数据中所有日期
function extractDates(items, ...fields) {
  const set = new Set()
  items.forEach(item => {
    fields.forEach(f => {
      const v = item[f]
      if (v && typeof v === 'string') {
        const m = v.match(/^(\d{4}-\d{2}-\d{2})/)
        if (m) set.add(m[1])
      }
    })
  })
  return Array.from(set).sort()
}

// 获取当日数据日期：今天优先，无数据则取最近有数据的日期
function getActiveDate() {
  const allDates = []
    .concat(extractDates(incomingInspections, 'inspection_time', 'arrival_date'))
    .concat(extractDates(finishedInspections, 'inspection_time'))
    .concat(extractDates(microbeInspections, 'inspection_time'))
    .concat(extractDates(envInspections, 'inspection_date'))
    .concat(extractDates(complaints, 'complaint_time'))
  if (allDates.length === 0) return null
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (allDates.includes(todayStr)) return todayStr
  const pastDates = allDates.filter(d => d <= todayStr)
  return pastDates.length > 0 ? pastDates[pastDates.length - 1] : allDates[allDates.length - 1]
}

function filterByDate(items, dateStr, ...fields) {
  if (!dateStr) return items
  return items.filter(item =>
    fields.some(f => {
      const v = item[f]
      return v && typeof v === 'string' && v.startsWith(dateStr)
    })
  )
}

function nextEnvValue(prev, min, max) {
  let delta = (Math.random() * 4 - 2)
  let next = prev + delta
  if (next < min) next = min + (min - next)
  if (next > max) next = max - (next - max)
  next = Math.max(min, Math.min(max, next))
  return Number(next.toFixed(1))
}

export default function QualityBigScreen() {
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeDate, setActiveDate] = useState(getActiveDate())
  const [idle, setIdle] = useState(false)
  const [envData, setEnvData] = useState({ temperature: 21.5, humidity: 60.5, pressure: 18.0 })

  // ECharts 图表容器 ref
  const barChartRef = useRef(null)
  const pieChartRef = useRef(null)
  const lineChartRef = useRef(null)
  const gaugeChartRef = useRef(null)

  const idleTimerRef = useRef(null)

  const resetIdle = useCallback(() => {
    setIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_THRESHOLD)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel']
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [resetIdle])

  // 定期更新环境数据
  useEffect(() => {
    const timer = setInterval(() => {
      setEnvData(prev => ({
        temperature: nextEnvValue(prev.temperature, 20, 23),
        humidity: nextEnvValue(prev.humidity, 58, 63),
        pressure: nextEnvValue(prev.pressure, 15, 21),
      }))
    }, ENV_REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const formatClock = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  // 按当日过滤数据
  const dateIncoming = filterByDate(incomingInspections, activeDate, 'inspection_time', 'arrival_date')
  const dateFinished = filterByDate(finishedInspections, activeDate, 'inspection_time')
  const dateMicrobe = filterByDate(microbeInspections, activeDate, 'inspection_time')
  const dateEnv = filterByDate(envInspections, activeDate, 'inspection_date')
  const dateComplaints = filterByDate(complaints, activeDate, 'complaint_time')
  // 当日无任何数据时回退到全部
  const hasDateData = dateIncoming.length > 0 || dateFinished.length > 0 || dateMicrobe.length > 0 || dateEnv.length > 0
  const useIncoming = hasDateData ? dateIncoming : incomingInspections
  const useFinished = hasDateData ? dateFinished : finishedInspections
  const useMicrobe = hasDateData ? dateMicrobe : microbeInspections
  const useEnv = hasDateData ? dateEnv : envInspections
  const useComplaints = dateComplaints.length > 0 ? dateComplaints : complaints

  // ============ 数据计算 ============

  // 合格率计算：只统计已完成且有检验结果的记录
  const calcPassRate = (list) => {
    const completed = list.filter((i) => i.result === '合格' || i.result === '不合格')
    if (completed.length === 0) return 0
    const pass = completed.filter((i) => i.result === '合格').length
    return Number(((pass / completed.length) * 100).toFixed(1))
  }

  const incomingRate = calcPassRate(useIncoming)
  const finishedRate = calcPassRate(useFinished)
  const microbeRate = calcPassRate(useMicrobe)
  const envRate = calcPassRate(useEnv)
  const activeComplaints = useComplaints.filter((c) => c.status === '处理中').length

  // 检验标准覆盖率：被生效标准覆盖的料品数 / 料品总数
  const materialsWithStandard = new Set(
    inspectionStandards.filter((s) => s.status === '生效').map((s) => s.material_id)
  )
  const standardCoverage =
    materials.length > 0 ? Math.round((materialsWithStandard.size / materials.length) * 100) : 0

  // 标准生效率
  const activeStandards = inspectionStandards.filter((s) => s.status === '生效').length
  const standardActiveRate =
    inspectionStandards.length > 0 ? Math.round((activeStandards / inspectionStandards.length) * 100) : 0

  // 仪器有效校准率（正常 + 即将到期视为有效）
  const validInstruments = instruments.filter((i) => i.status === '正常' || i.status === '即将到期').length
  const instrumentValidRate =
    instruments.length > 0 ? Math.round((validInstruments / instruments.length) * 100) : 0

  // KPI 指标行
  const kpiData = [
    { label: '来料合格率', value: incomingRate, unit: '%', color: '#00d4ff' },
    { label: '成品合格率', value: finishedRate, unit: '%', color: '#00ff88' },
    { label: '微生物合格率', value: microbeRate, unit: '%', color: '#ffd93d' },
    { label: '环境合格率', value: envRate, unit: '%', color: '#ff6b6b' },
    { label: '活跃客诉数', value: activeComplaints, unit: '件', color: '#ff6b6b' },
  ]

  // ============ ECharts 图表初始化 ============

  // 通用图表配置：禁用动画（定期更新数据不要动画）
  const noAnimation = { animation: false, animationDuration: 0, animationDurationUpdate: 0, animationEasingUpdate: 'linear' }

  // 1. 来料/成品/微生物/环境合格率对比 - 柱状图
  useEffect(() => {
    if (!barChartRef.current) return
    const chart = echarts.init(barChartRef.current)
    const barColors = ['#00d4ff', '#00ff88', '#ffd93d', '#ff6b6b']
    const rates = [incomingRate, finishedRate, microbeRate, envRate]
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(88,166,255,0.4)',
        textStyle: { color: '#E6EDF3' },
        formatter: '{b}<br/>合格率：{c}%',
      },
      grid: { left: '8%', right: '6%', top: '22%', bottom: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['来料', '成品', '微生物', '环境'],
        axisLine: { lineStyle: { color: 'rgba(88,166,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9', fontSize: 13, fontWeight: 600 },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#8B949E', formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(88,166,255,0.08)' } },
      },
      series: [
        {
          type: 'bar',
          barWidth: '42%',
          data: rates.map((v, i) => ({
            value: v,
            itemStyle: {
              borderRadius: [8, 8, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: barColors[i] },
                { offset: 1, color: barColors[i] + '33' },
              ]),
            },
          })),
          label: {
            show: true,
            position: 'top',
            color: '#E6EDF3',
            fontSize: 15,
            fontWeight: 700,
            formatter: '{c}%',
          },
          markLine: {
            symbol: 'none',
            lineStyle: { color: '#3FB950', type: 'dashed', width: 1.5 },
            label: { color: '#3FB950', formatter: '目标 95%', fontSize: 11 },
            data: [{ yAxis: 95 }],
          },
        },
      ],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      chart.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, [incomingRate, finishedRate, microbeRate, envRate])

  // 2. 各检验类别不合格分布 - 饼图（环形）
  useEffect(() => {
    if (!pieChartRef.current) return
    const chart = echarts.init(pieChartRef.current)
    // 当日不合格聚合数据（基于过滤后的数据）
    const unqualifiedData = [
      { name: '来料检验', value: useIncoming.filter(i => i.result === '不合格').length || 0 },
      { name: '成品检验', value: useFinished.filter(i => i.result === '不合格').length || 0 },
      { name: '微生物检验', value: useMicrobe.filter(i => i.result === '不合格').length || 0 },
      { name: '环境检验', value: useEnv.filter(i => i.result === '不合格').length || 0 },
    ].filter(d => d.value > 0)
    const fallback = unqualifiedData.length > 0 ? unqualifiedData : [{ name: '暂无数据', value: 1 }]
    const pieColors = ['#00d4ff', '#00ff88', '#ffd93d', '#ff6b6b']
    const total = fallback.reduce((s, d) => s + d.value, 0)
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(88,166,255,0.4)',
        textStyle: { color: '#E6EDF3' },
        formatter: '{b}<br/>不合格：{c}件 ({d}%)',
      },
      legend: {
        bottom: 6,
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#8B949E', fontSize: 12 },
      },
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '38%',
          style: { text: String(total), fill: '#ff6b6b', font: 'bold 30px DIN, Courier New', textAlign: 'center' },
        },
        {
          type: 'text',
          left: 'center',
          top: '55%',
          style: { text: '不合格总数(件)', fill: '#8B949E', font: '12px sans-serif', textAlign: 'center' },
        },
      ],
      series: [
        {
          type: 'pie',
          radius: ['52%', '72%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#0d1b2a', borderWidth: 2 },
          label: {
            show: true,
            color: '#C9D1D9',
            formatter: '{b}\n{d}%',
            fontSize: 12,
          },
          labelLine: { lineStyle: { color: 'rgba(139,148,158,0.4)' } },
          emphasis: {
            label: { fontSize: 14, fontWeight: 700, color: '#E6EDF3' },
            itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,212,255,0.4)' },
          },
          data: fallback.map((d, i) => ({
            ...d,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                { offset: 0, color: pieColors[i] || '#8B949E' },
                { offset: 1, color: (pieColors[i] || '#8B949E') + 'aa' },
              ]),
            },
          })),
        },
      ],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      chart.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, [useIncoming, useFinished, useMicrobe, useEnv])

  // 3. 客诉趋势 - 折线图
  useEffect(() => {
    if (!lineChartRef.current) return
    const chart = echarts.init(lineChartRef.current)
    const months = ['1月', '2月', '3月', '4月', '5月', '6月']
    const newComplaints = [3, 2, 4, 3, 5, 2]
    const closedComplaints = [2, 2, 3, 4, 4, 2]
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(88,166,255,0.4)',
        textStyle: { color: '#E6EDF3' },
      },
      legend: {
        top: 6,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 4,
        textStyle: { color: '#8B949E', fontSize: 12 },
        data: ['新增客诉', '已关闭客诉'],
      },
      grid: { left: '8%', right: '6%', top: '24%', bottom: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: months,
        axisLine: { lineStyle: { color: 'rgba(88,166,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#8B949E' },
        splitLine: { lineStyle: { color: 'rgba(88,166,255,0.08)' } },
      },
      series: [
        {
          name: '新增客诉',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          data: newComplaints,
          lineStyle: { color: '#ff6b6b', width: 3, shadowColor: 'rgba(255,107,107,0.5)', shadowBlur: 8 },
          itemStyle: { color: '#ff6b6b', borderColor: '#0d1b2a', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(255,107,107,0.35)' },
              { offset: 1, color: 'rgba(255,107,107,0)' },
            ]),
          },
        },
        {
          name: '已关闭客诉',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          data: closedComplaints,
          lineStyle: { color: '#00ff88', width: 3, shadowColor: 'rgba(0,255,136,0.5)', shadowBlur: 8 },
          itemStyle: { color: '#00ff88', borderColor: '#0d1b2a', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0,255,136,0.35)' },
              { offset: 1, color: 'rgba(0,255,136,0)' },
            ]),
          },
        },
      ],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      chart.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // 4. 检验标准覆盖率 - 径向柱状图
  useEffect(() => {
    if (!gaugeChartRef.current) return
    const chart = echarts.init(gaugeChartRef.current)
    const gaugeColors = ['#00d4ff', '#00ff88', '#ffd93d']
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(88,166,255,0.4)',
        textStyle: { color: '#E6EDF3' },
        formatter: '{b}: {c}%',
      },
      polar: { center: ['50%', '52%'], radius: '78%' },
      angleAxis: {
        max: 100,
        startAngle: 90,
        axisLine: { show: false },
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      radiusAxis: {
        type: 'category',
        data: ['检验标准覆盖率', '标准生效率', '仪器有效校准率'],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9', fontSize: 12 },
      },
      series: [
        {
          type: 'bar',
          coordinateSystem: 'polar',
          barWidth: 14,
          showBackground: true,
          backgroundStyle: { color: 'rgba(255,255,255,0.05)', borderRadius: 7 },
          itemStyle: { borderRadius: 7 },
          label: {
            show: true,
            position: 'end',
            color: '#E6EDF3',
            fontSize: 13,
            fontWeight: 700,
            formatter: '{c}%',
          },
          data: [standardCoverage, standardActiveRate, instrumentValidRate].map((v, i) => ({
            value: v,
            name: ['检验标准覆盖率', '标准生效率', '仪器有效校准率'][i],
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: gaugeColors[i] + '66' },
                { offset: 1, color: gaugeColors[i] },
              ]),
            },
          })),
        },
      ],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      chart.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, [standardCoverage, standardActiveRate, instrumentValidRate])

  return (
    <div className="bigscreen-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 顶部标题栏 */}
      <div className="bs-header">
        {/* 左上角：闲置态切换为系统时间显示 */}
        <div className="bs-header-left">
          {!idle ? (
            <>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/dashboard')}
                style={{ color: '#8B949E' }}
              />
              <div className="bs-screen-tabs">
                <div className="bs-screen-tab" onClick={() => navigate('/bigscreen/production')}>生产大屏</div>
                <div className="bs-screen-tab" onClick={() => navigate('/bigscreen/management')}>管理大屏</div>
                <div className="bs-screen-tab active">质量大屏</div>
              </div>
            </>
          ) : (
            <div className="bs-idle-clock">
              <span style={{ color: '#3FB950' }}>●</span>
              <span>{formatClock(currentTime)}</span>
              <span style={{ fontSize: 12, color: '#8B949E' }}>系统时间</span>
            </div>
          )}
        </div>
        <div className="bs-header-center">
          <div className="bs-title">
            <img src={logoRect} alt="logo" style={{ height: 40, width: 'auto', marginRight: 12, verticalAlign: 'middle' }} />
            质量分析看板
          </div>
        </div>
        {/* 右上角：环境数据（温度/湿度/压差）+ 时间 */}
        <div className="bs-header-right">
          <div className="bs-env-group">
            <span className="bs-env-item" title="温度">
              <span className="bs-env-label" style={{ color: '#58A6FF' }}>温度</span>
              <span className="bs-env-value">{envData.temperature.toFixed(1)}°C</span>
            </span>
            <span className="bs-env-item" title="湿度">
              <span className="bs-env-label" style={{ color: '#3FB950' }}>湿度</span>
              <span className="bs-env-value">{envData.humidity.toFixed(1)}%</span>
            </span>
            <span className="bs-env-item" title="压差">
              <span className="bs-env-label" style={{ color: '#F0883E' }}>压差</span>
              <span className="bs-env-value">{envData.pressure.toFixed(1)}Pa</span>
            </span>
          </div>
          <ReloadOutlined style={{ color: '#3FB950' }} className="bs-blink" />
          <div className="bs-time">{formatTime(currentTime)}</div>
        </div>
      </div>

      {/* KPI 指标行 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexShrink: 0 }}>
        {kpiData.map((kpi, i) => (
          <div key={i} className="bs-panel" style={{ flex: 1 }}>
            <div className="bs-kpi-card">
              <div className="bs-kpi-value bs-number-glow" style={{ color: kpi.color }}>
                {kpi.value}
                <span style={{ fontSize: 16, marginLeft: 2 }}>{kpi.unit}</span>
              </div>
              <div className="bs-kpi-label">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 图表区域 - 2x2 网格 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
          {/* 来料/成品/微生物/环境合格率对比 */}
          <div className="bs-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">来料 / 成品 / 微生物 / 环境合格率对比</div>
            <div ref={barChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>
          {/* 各检验类别不合格分布 */}
          <div className="bs-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">各检验类别不合格分布</div>
            <div ref={pieChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
          {/* 客诉趋势 */}
          <div className="bs-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">客诉趋势</div>
            <div ref={lineChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>
          {/* 检验标准覆盖率 */}
          <div className="bs-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">检验标准覆盖率</div>
            <div ref={gaugeChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
