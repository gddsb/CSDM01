import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import { workOrders, processReports, productionLines, devices, orders, processes } from '../../mock/data'
import { useBigScreenScale } from '../../hooks/useBigScreenScale'
import BigScreenHeader from '../../components/BigScreenHeader'
import BigScreenPanel from '../../components/BigScreenPanel'
import '../../styles/bigscreen.css'

const DATA_REFRESH_INTERVAL = 30 * 1000
const ENV_REFRESH_INTERVAL = 8 * 1000
const IDLE_THRESHOLD = 15 * 1000

const TABS = [
  { key: 'production', label: '生产大屏', path: '/bigscreen/production' },
  { key: 'quality', label: '质量大屏', path: '/bigscreen/quality' },
  { key: 'environment', label: '环境监测中心', path: '/bigscreen/environment' },
  { key: 'management', label: '管理大屏', path: '/bigscreen/management' },
]

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

function getActiveDate() {
  const allDates = extractDates(processReports, 'report_time')
    .concat(extractDates(workOrders, 'start_time', 'created_at'))
    .concat(extractDates(orders, 'created_at', 'release_time'))
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

export default function ProductionBigScreen() {
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeDate, setActiveDate] = useState(getActiveDate())
  const [dataVersion, setDataVersion] = useState(0)
  const [idle, setIdle] = useState(false)
  const [envData, setEnvData] = useState({ temperature: 21.5, humidity: 60.5, pressure: 18.0 })

  const lineChartRef = useRef(null)
  const processBarRef = useRef(null)
  const defectPieRef = useRef(null)
  const orderProgressRef = useRef(null)

  const lineChartRef2 = useRef(null)
  const processBarRef2 = useRef(null)
  const defectPieRef2 = useRef(null)
  const orderProgressRef2 = useRef(null)

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

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDate(getActiveDate())
      setDataVersion(v => v + 1)
    }, DATA_REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [])

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

  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1920, designHeight: 1080 })

  const onTab = useCallback((key, path) => {
    if (path) navigate(path)
  }, [navigate])

  const dateWorkOrders = filterByDate(workOrders, activeDate, 'start_time', 'created_at')
  const dateProcessReports = filterByDate(processReports, activeDate, 'report_time')
  const displayOrders = orders.filter(o => {
    if (!activeDate) return false
    const releasedToday = o.release_time && o.release_time.startsWith(activeDate) && o.status === '下发'
    const todayWorkOrderIds = workOrders
      .filter(w => w.start_time && w.start_time.startsWith(activeDate))
      .map(w => w.order_id)
    const startedToday = todayWorkOrderIds.includes(o.order_id)
    const finishedToday = workOrders
      .filter(w => w.finish_time && w.finish_time.startsWith(activeDate))
      .some(w => w.order_id === o.order_id)
    return releasedToday || startedToday || finishedToday
  })

  const chartWorkOrders = workOrders
    .filter(w => {
      const startMatch = activeDate && w.start_time && w.start_time.startsWith(activeDate)
      const finishMatch = activeDate && w.finish_time && w.finish_time.startsWith(activeDate)
      return startMatch || finishMatch
    })
    .filter(w => w.status !== '完工')
    .map(w => {
      const reported = processReports
        .filter(r => r.work_order_id === w.work_order_id)
        .reduce((s, r) => s + r.output_qty, 0)
      const pct = w.target_qty > 0 ? Math.round(reported / w.target_qty * 100) : 0
      return { ...w, reported, pct }
    })

  const activeWorkOrders = workOrders.filter(w => w.status === '开工' || w.status === '已开工')
  const totalTarget = activeWorkOrders.reduce((s, w) => s + w.target_qty, 0)
  const todayStartWorkOrders = workOrders.filter(w => activeDate && w.start_time && w.start_time.startsWith(activeDate))
  const todayStartQty = todayStartWorkOrders.reduce((s, w) => s + w.target_qty, 0)
  const currentOutput = activeWorkOrders.reduce((sum, w) => {
    const reported = processReports
      .filter(r => r.work_order_id === w.work_order_id)
      .reduce((s, r) => s + r.output_qty, 0)
    return sum + reported
  }, 0)
  const totalOutput = dateProcessReports.reduce((s, r) => s + r.output_qty, 0)
  const totalDefect = dateProcessReports.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
  const totalInput = dateProcessReports.filter(r => r.process_name === '裁剪下料').reduce((s, r) => s + r.input_qty, 0)
  const yieldRate = totalInput > 0 ? ((totalInput - totalDefect) / totalInput * 100).toFixed(1) : '0.0'
  const runningLines = productionLines.filter(l => l.status === '运行中')
  const faultDevices = devices.filter(d => d.status === '故障')

  const kpiData = [
    { label: '开工工单', value: activeWorkOrders.length, unit: '个', color: '#00d4ff' },
    { label: '今日开工', value: todayStartQty, unit: '罐', color: '#3FB950' },
    { label: '今日投入', value: totalInput, unit: '罐', color: '#F0883E' },
    { label: '当前产出', value: currentOutput, unit: '罐', color: '#a78bfa' },
    { label: '良率', value: yieldRate, unit: '%', color: '#3FB950' },
    { label: '运行产线', value: runningLines.length, unit: '条', color: '#00d4ff' },
  ]

  const mustReportProcessNames = processes.filter(p => Number(p.must_report) === 1).map(p => p.process_name)
  const processStats = {}
  dateProcessReports.forEach(r => {
    if (!mustReportProcessNames.includes(r.process_name)) return
    if (!processStats[r.process_name]) {
      processStats[r.process_name] = { name: r.process_name, input: 0, output: 0, defect: 0 }
    }
    processStats[r.process_name].input += r.input_qty
    processStats[r.process_name].output += r.output_qty
    processStats[r.process_name].defect += r.defect_material + r.defect_process + r.defect_scrap
  })
  const processList = Object.values(processStats)

  const defectDistribution = {}
  dateProcessReports.forEach(r => {
    defectDistribution['来料不良'] = (defectDistribution['来料不良'] || 0) + r.defect_material
    defectDistribution['制程不良'] = (defectDistribution['制程不良'] || 0) + r.defect_process
    defectDistribution['检验报废'] = (defectDistribution['检验报废'] || 0) + r.defect_scrap
  })
  const totalDefectAll = Object.values(defectDistribution).reduce((s, v) => s + v, 0)

  const orderStatusOrder = { '下发': 1, '开工': 1, '已开工': 1, '开立': 2, '完工': 3 }
  const sortedOrders = [...displayOrders].sort((a, b) => {
    const sa = orderStatusOrder[a.status] || 99
    const sb = orderStatusOrder[b.status] || 99
    if (sa !== sb) return sa - sb
    return (a.order_no || '').localeCompare(b.order_no || '')
  })

  const noAnimation = { animation: false, animationDuration: 0, animationDurationUpdate: 0, animationEasingUpdate: 'linear' }

  const activeLines = productionLines.filter(l => l.status !== '停用')
  useEffect(() => {
    if (!lineChartRef.current) return
    const chart = echarts.init(lineChartRef.current)
    lineChartRef2.current = chart
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
    const allLineData = {
      'A线': { data: [520, 580, 610, 590, 540, 480, 560, 600, 620, 580, 530, 450, 380], color: '#00d4ff' },
      'B线': { data: [480, 520, 550, 530, 500, 460, 510, 540, 560, 530, 490, 420, 360], color: '#00ff88' },
      'C线': { data: [0, 0, 0, 0, 0, 0, 0, 360, 420, 440, 410, 350, 0], color: '#a78bfa' },
    }
    const legendData = activeLines.map(l => l.line_name)
    const series = activeLines.map(l => {
      const d = allLineData[l.line_name] || { data: [], color: '#00d4ff' }
      return {
        name: l.line_name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, data: d.data,
        lineStyle: { color: d.color, width: 3 },
        itemStyle: { color: d.color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: d.color + '55' },
            { offset: 1, color: d.color + '00' },
          ]),
        },
      }
    })
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(0,212,255,0.4)',
        textStyle: { color: '#E6EDF3' },
      },
      legend: {
        top: 6,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 4,
        textStyle: { color: '#8B949E', fontSize: 12 },
        data: legendData,
      },
      grid: { left: '6%', right: '5%', top: '22%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: hours,
        axisLine: { lineStyle: { color: 'rgba(0,212,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#8B949E' },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
      },
      series: series,
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize); lineChartRef2.current = null }
  }, [])

  useEffect(() => {
    if (!processBarRef.current) return
    let chart = processBarRef2.current
    if (!chart) {
      chart = echarts.init(processBarRef.current)
      processBarRef2.current = chart
    }
    const names = processList.length > 0 ? processList.map(p => p.name) : ['暂无数据']
    const outputs = processList.length > 0 ? processList.map(p => p.output) : [0]
    const defects = processList.length > 0 ? processList.map(p => p.defect) : [0]
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(0,212,255,0.4)',
        textStyle: { color: '#E6EDF3' },
      },
      legend: {
        top: 6,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 4,
        textStyle: { color: '#8B949E', fontSize: 12 },
        data: ['产出数量', '不良数量'],
      },
      grid: { left: '6%', right: '6%', top: '22%', bottom: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: names,
        axisLine: { lineStyle: { color: 'rgba(0,212,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9', fontSize: 12 },
      },
      yAxis: [
        {
          type: 'value', name: '产出(件)',
          nameTextStyle: { color: '#8B949E', fontSize: 11 },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#8B949E' },
          splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
        },
        {
          type: 'value', name: '不良(件)',
          nameTextStyle: { color: '#8B949E', fontSize: 11 },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#8B949E' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '产出数量', type: 'bar', barWidth: '38%', yAxisIndex: 0, data: outputs,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#00d4ff' },
              { offset: 1, color: 'rgba(0,212,255,0.15)' },
            ]),
          },
          label: { show: true, position: 'top', color: '#E6EDF3', fontSize: 11, formatter: (p) => p.value.toLocaleString() },
        },
        {
          name: '不良数量', type: 'bar', barWidth: '38%', yAxisIndex: 1, data: defects,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#ff6b6b' },
              { offset: 1, color: 'rgba(255,107,107,0.15)' },
            ]),
          },
          label: { show: true, position: 'top', color: '#ff6b6b', fontSize: 11 },
        },
      ],
    })
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [processList, dataVersion])

  useEffect(() => {
    if (!defectPieRef.current) return
    let chart = defectPieRef2.current
    if (!chart) {
      chart = echarts.init(defectPieRef.current)
      defectPieRef2.current = chart
    }
    const pieColors = { '来料不良': '#ffd93d', '制程不良': '#ff6b6b', '检验报废': '#a78bfa' }
    const data = Object.entries(defectDistribution).map(([name, value]) => ({
      name, value,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: pieColors[name] },
          { offset: 1, color: pieColors[name] + 'aa' },
        ]),
      },
    }))
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(0,212,255,0.4)',
        textStyle: { color: '#E6EDF3' },
        formatter: '{b}<br/>数量：{c}件 ({d}%)',
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
          type: 'text', left: 'center', top: '38%',
          style: { text: String(totalDefectAll), fill: '#ff6b6b', font: 'bold 30px DIN, Courier New', textAlign: 'center' },
        },
        {
          type: 'text', left: 'center', top: '55%',
          style: { text: '不良总数(件)', fill: '#8B949E', font: '12px sans-serif', textAlign: 'center' },
        },
      ],
      series: [
        {
          type: 'pie', radius: ['52%', '72%'], center: ['50%', '46%'], avoidLabelOverlap: true,
          itemStyle: { borderColor: '#0d1b2a', borderWidth: 2 },
          label: { show: true, color: '#C9D1D9', formatter: '{b}\n{d}%', fontSize: 12 },
          labelLine: { lineStyle: { color: 'rgba(139,148,158,0.4)' } },
          emphasis: {
            label: { fontSize: 14, fontWeight: 700, color: '#E6EDF3' },
            itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,212,255,0.4)' },
          },
          data: data.length > 0 ? data : [{ name: '暂无数据', value: 1, itemStyle: { color: '#30363d' } }],
        },
      ],
    })
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [totalDefectAll, defectDistribution, dataVersion])

  useEffect(() => {
    if (!orderProgressRef.current) return
    let chart = orderProgressRef2.current
    if (!chart) {
      chart = echarts.init(orderProgressRef.current)
      orderProgressRef2.current = chart
    }
    const labels = chartWorkOrders.map(w => `${w.work_order_no} · ${w.line_name}`)
    const targets = chartWorkOrders.map(w => w.target_qty)
    const completeds = chartWorkOrders.map(w => w.reported)
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(0,212,255,0.4)',
        textStyle: { color: '#E6EDF3' },
        formatter: (params) => {
          const idx = params[0].dataIndex
          const w = chartWorkOrders[idx]
          if (!w) return ''
          return `${w.work_order_no} · ${w.line_name}<br/>${w.material_name}<br/>目标：${w.target_qty.toLocaleString()} 件<br/>完工：${w.reported.toLocaleString()} 件<br/>完成率：${w.pct}%`
        },
      },
      legend: {
        top: 6,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 4,
        textStyle: { color: '#8B949E', fontSize: 12 },
        data: ['目标数量', '完工数量'],
      },
      grid: { left: '4%', right: '10%', top: '20%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: '#8B949E' },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: 'rgba(0,212,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9', fontSize: 11 },
      },
      series: [
        {
          name: '目标数量', type: 'bar', barWidth: '30%', data: targets,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: 'rgba(167,139,250,0.25)' },
              { offset: 1, color: 'rgba(167,139,250,0.6)' },
            ]),
          },
        },
        {
          name: '完工数量', type: 'bar', barWidth: '30%', data: completeds,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#00ff88' },
              { offset: 1, color: 'rgba(0,255,136,0.5)' },
            ]),
          },
          label: {
            show: true, position: 'right', color: '#00ff88', fontSize: 11,
            formatter: (p) => `${chartWorkOrders[p.dataIndex]?.pct || 0}%`,
          },
        },
      ],
    })
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [chartWorkOrders, dataVersion])

  const idleClock = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#8B949E', fontFamily: "'Courier New', monospace", fontSize: 16 }}>
      <span style={{ color: '#3FB950' }}>●</span>
      <span>{formatClock(currentTime)}</span>
      <span style={{ fontSize: 12, opacity: 0.6 }}>系统时间</span>
    </div>
  )

  const envGroup = (
    <div className="bs-env-group">
      <span className="bs-env-item" title="温度">
        <span className="bs-env-label" style={{ color: '#00d4ff' }}>温度</span>
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
  )

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0e1a' }}>
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
        <BigScreenHeader
          title="生产实时监控中心"
          tabs={idle ? [] : TABS}
          activeTab="production"
          onTabChange={onTab}
          showBack={!idle}
          extraRight={envGroup}
          extraLeft={idle ? idleClock : null}
        />

        {activeDate && (
          <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 6, padding: '0 4px' }}>
            数据日期：<span style={{ color: '#00d4ff', fontFamily: "'Courier New', monospace" }}>{activeDate}</span>
            <span style={{ marginLeft: 8, opacity: 0.7 }}>（当日无数据时显示最近有数据的日期，每 30 秒自动刷新）</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexShrink: 0 }}>
          {kpiData.map((kpi, i) => (
            <BigScreenPanel key={i} style={{ flex: 1 }}>
              <div className="bs-kpi-card">
                <div className="bs-kpi-value bs-number-glow" style={{ color: kpi.color }}>
                  {kpi.value}<span style={{ fontSize: 16, marginLeft: 2 }}>{kpi.unit}</span>
                </div>
                <div className="bs-kpi-label">{kpi.label}</div>
              </div>
            </BigScreenPanel>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <BigScreenPanel title="产线运行状态" className="bs-no-scrollbar" style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
                {activeLines.map(line => (
                  <div key={line.line_id} className="bs-line-status" style={{
                    borderLeftColor: line.status === '运行中' ? '#3FB950' : line.status === '维护中' ? '#D29922' : '#F85149'
                  }}>
                    <div className="bs-line-dot" style={{
                      background: line.status === '运行中' ? '#3FB950' : line.status === '维护中' ? '#D29922' : '#F85149'
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3' }}>{line.line_name} · {line.workshop}</div>
                      <div style={{ fontSize: 12, color: '#8B949E' }}>
                        状态：<Tag color={line.status === '运行中' ? 'success' : 'warning'} style={{ fontSize: 11 }}>{line.status}</Tag>
                      </div>
                    </div>
                  </div>
                ))}
              </BigScreenPanel>
            </div>

            <BigScreenPanel title="产线产出趋势" style={{ flex: 2, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={lineChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>

            <BigScreenPanel title="不良分布分析" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={defectPieRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            <BigScreenPanel title="各工序产出统计" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={processBarRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>

            <BigScreenPanel title="生产工单实时进度" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={orderProgressRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>

            <BigScreenPanel title="生产订单概览" className="bs-no-scrollbar" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {sortedOrders.map(o => (
                  <div key={o.order_id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(0,212,255,0.06)', fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{o.order_no}</span>
                      <Tag
                        color={o.status === '下发' ? 'processing' : o.status === '完工' ? 'success' : 'default'}
                        style={{ fontSize: 11 }}
                      >
                        {o.status}
                      </Tag>
                    </div>
                    <div style={{ color: '#8B949E' }}>{o.material_name} · {o.planned_qty.toLocaleString()}件</div>
                  </div>
                ))}
              </div>
            </BigScreenPanel>
          </div>
        </div>
      </div>
    </div>
  )
}
