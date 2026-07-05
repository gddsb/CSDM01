import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Tag } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import { workOrders, processReports, productionLines, devices, orders } from '../../mock/data'
import logoRect from '../../assets/logo-rect.png'
import '../../styles/bigscreen.css'

// 数据刷新间隔（毫秒）—— 工序产出与工单进度定期更新
const DATA_REFRESH_INTERVAL = 30 * 1000
// 环境数据更新间隔（温度/湿度/压差）
const ENV_REFRESH_INTERVAL = 8 * 1000
// 无操作自动隐藏看板名称按钮阈值
const IDLE_THRESHOLD = 15 * 1000

// 提取数据中所有日期（YYYY-MM-DD）
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

// 获取当日数据日期：优先今天，无数据则取最近有数据的日期
function getActiveDate() {
  const allDates = extractDates(processReports, 'report_time')
    .concat(extractDates(workOrders, 'start_time', 'created_at'))
    .concat(extractDates(orders, 'created_at', 'release_time'))
  if (allDates.length === 0) return null
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (allDates.includes(todayStr)) return todayStr
  // 取不超过今天的最近日期
  const pastDates = allDates.filter(d => d <= todayStr)
  return pastDates.length > 0 ? pastDates[pastDates.length - 1] : allDates[allDates.length - 1]
}

// 按日期过滤数据
function filterByDate(items, dateStr, ...fields) {
  if (!dateStr) return items
  return items.filter(item =>
    fields.some(f => {
      const v = item[f]
      return v && typeof v === 'string' && v.startsWith(dateStr)
    })
  )
}

// 环境随机数生成（限定范围且与上次差不超过2）
function nextEnvValue(prev, min, max) {
  let delta = (Math.random() * 4 - 2)  // [-2, 2]
  let next = prev + delta
  if (next < min) next = min + (min - next)
  if (next > max) next = max - (next - max)
  // 边界裁剪
  next = Math.max(min, Math.min(max, next))
  return Number(next.toFixed(1))
}

export default function ProductionBigScreen() {
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeDate, setActiveDate] = useState(getActiveDate())
  const [dataVersion, setDataVersion] = useState(0)  // 触发数据刷新
  // 闲置状态：true 时隐藏左上角看板名称按钮，改显示系统时间
  const [idle, setIdle] = useState(false)
  // 环境数据：温度/湿度/压差
  const [envData, setEnvData] = useState({ temperature: 21.5, humidity: 60.5, pressure: 18.0 })

  // ECharts 图表容器 ref
  const lineChartRef = useRef(null)
  const processBarRef = useRef(null)
  const defectPieRef = useRef(null)
  const orderProgressRef = useRef(null)

  // 图表实例引用（用于刷新数据时调用 setOption 而不重建）
  const lineChartRef2 = useRef(null)
  const processBarRef2 = useRef(null)
  const defectPieRef2 = useRef(null)
  const orderProgressRef2 = useRef(null)

  // 闲置计时器
  const idleTimerRef = useRef(null)

  // 重置闲置计时
  const resetIdle = useCallback(() => {
    setIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_THRESHOLD)
  }, [])

  // 时钟
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 监听用户操作（鼠标移动/点击/键盘）重置闲置计时
  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel']
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [resetIdle])

  // 定期刷新数据（仅触发数据版本变化，不重建图表，无动画）
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDate(getActiveDate())
      setDataVersion(v => v + 1)
    }, DATA_REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  // 定期更新环境数据（温度/湿度/压差）
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

  // ============ 数据计算（基于 activeDate 当日数据） ============
  const dateWorkOrders = filterByDate(workOrders, activeDate, 'start_time', 'created_at')
  const dateProcessReports = filterByDate(processReports, activeDate, 'report_time')
  // 订单：当天有关的（创建或下达时间），如果当天没有订单，则展示所有订单
  const dateOrders = filterByDate(orders, activeDate, 'created_at', 'release_time')
  const displayOrders = dateOrders.length > 0 ? dateOrders : orders

  // 工单进度（开工/完工/开立，排除已关闭）
  const chartWorkOrders = workOrders
    .filter(w => w.status !== '关闭')
    .map(w => {
      // 用当日报工数据计算进度，没有当日数据则用累计数据
      const reported = processReports
        .filter(r => r.work_order_id === w.work_order_id)
        .reduce((s, r) => s + r.output_qty, 0)
      const pct = w.target_qty > 0 ? Math.round(reported / w.target_qty * 100) : 0
      return { ...w, reported, pct }
    })

  const activeWorkOrders = workOrders.filter(w => w.status === '开工')
  const totalTarget = activeWorkOrders.reduce((s, w) => s + w.target_qty, 0)
  // 当日产出
  const totalOutput = dateProcessReports.reduce((s, r) => s + r.output_qty, 0)
  const totalDefect = dateProcessReports.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
  const totalInput = dateProcessReports.filter(r => r.process_name === '裁剪下料').reduce((s, r) => s + r.input_qty, 0)
  const yieldRate = totalInput > 0 ? ((totalInput - totalDefect) / totalInput * 100).toFixed(1) : '0.0'
  const runningLines = productionLines.filter(l => l.status === '运行中')
  const faultDevices = devices.filter(d => d.status === '故障')

  const kpiData = [
    { label: '生效工单', value: activeWorkOrders.length, unit: '个', color: '#58A6FF' },
    { label: '今日产出', value: totalOutput, unit: '件', color: '#3FB950' },
    { label: '今日投入', value: totalInput, unit: '件', color: '#F0883E' },
    { label: '不良总数', value: totalDefect, unit: '件', color: '#F85149' },
    { label: '良率', value: yieldRate, unit: '%', color: '#3FB950' },
    { label: '运行产线', value: runningLines.length, unit: '条', color: '#58A6FF' },
  ]

  // 工序产出统计聚合（当日数据）
  const processStats = {}
  dateProcessReports.forEach(r => {
    if (!processStats[r.process_name]) {
      processStats[r.process_name] = { name: r.process_name, input: 0, output: 0, defect: 0 }
    }
    processStats[r.process_name].input += r.input_qty
    processStats[r.process_name].output += r.output_qty
    processStats[r.process_name].defect += r.defect_material + r.defect_process + r.defect_scrap
  })
  const processList = Object.values(processStats)

  // 不良分布聚合（当日数据）
  const defectDistribution = {}
  dateProcessReports.forEach(r => {
    defectDistribution['来料不良'] = (defectDistribution['来料不良'] || 0) + r.defect_material
    defectDistribution['制程不良'] = (defectDistribution['制程不良'] || 0) + r.defect_process
    defectDistribution['检验报废'] = (defectDistribution['检验报废'] || 0) + r.defect_scrap
  })
  const totalDefectAll = Object.values(defectDistribution).reduce((s, v) => s + v, 0)

  // 订单概览排序：已开工、待下达、已关闭
  const orderStatusOrder = { '已下达': 1, '已开工': 1, '开工': 1, '待下达': 2, '已关闭': 3, '关闭': 3 }
  const sortedOrders = [...displayOrders].sort((a, b) => {
    const sa = orderStatusOrder[a.status] || 99
    const sb = orderStatusOrder[b.status] || 99
    if (sa !== sb) return sa - sb
    return (a.order_no || '').localeCompare(b.order_no || '')
  })

  // ============ ECharts 图表初始化 ============
  // 通用图表配置：禁用动画（用户要求"定期更新数据不要动画"）
  const noAnimation = { animation: false, animationDuration: 0, animationDurationUpdate: 0, animationEasingUpdate: 'linear' }

  // 1. 产线产出趋势 - 折线图
  useEffect(() => {
    if (!lineChartRef.current) return
    const chart = echarts.init(lineChartRef.current)
    lineChartRef2.current = chart
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
    const lineA = [520, 580, 610, 590, 540, 480, 560, 600, 620, 580, 530, 450, 380]
    const lineB = [480, 520, 550, 530, 500, 460, 510, 540, 560, 530, 490, 420, 360]
    const lineC = [0, 0, 0, 0, 0, 0, 0, 360, 420, 440, 410, 350, 0]
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
        data: ['A线', 'B线', 'C线'],
      },
      grid: { left: '6%', right: '5%', top: '22%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: hours,
        axisLine: { lineStyle: { color: 'rgba(88,166,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9', fontSize: 11 },
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
          name: 'A线', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, data: lineA,
          lineStyle: { color: '#00d4ff', width: 3 },
          itemStyle: { color: '#00d4ff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0,212,255,0.35)' },
              { offset: 1, color: 'rgba(0,212,255,0)' },
            ]),
          },
        },
        {
          name: 'B线', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, data: lineB,
          lineStyle: { color: '#00ff88', width: 3 },
          itemStyle: { color: '#00ff88' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0,255,136,0.3)' },
              { offset: 1, color: 'rgba(0,255,136,0)' },
            ]),
          },
        },
        {
          name: 'C线', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, data: lineC,
          lineStyle: { color: '#a78bfa', width: 3 },
          itemStyle: { color: '#a78bfa' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(167,139,250,0.3)' },
              { offset: 1, color: 'rgba(167,139,250,0)' },
            ]),
          },
        },
      ],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize); lineChartRef2.current = null }
  }, [])

  // 2. 各工序产出统计 - 柱状图（定期更新数据，无动画）
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
        borderColor: 'rgba(88,166,255,0.4)',
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
        axisLine: { lineStyle: { color: 'rgba(88,166,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9', fontSize: 12 },
      },
      yAxis: [
        {
          type: 'value', name: '产出(件)',
          nameTextStyle: { color: '#8B949E', fontSize: 11 },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#8B949E' },
          splitLine: { lineStyle: { color: 'rgba(88,166,255,0.08)' } },
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

  // 3. 不良分布分析 - 环形饼图
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
        borderColor: 'rgba(88,166,255,0.4)',
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

  // 4. 工单进度 - 横向柱状图（定期更新数据，无动画）
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
        borderColor: 'rgba(88,166,255,0.4)',
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
        splitLine: { lineStyle: { color: 'rgba(88,166,255,0.08)' } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: 'rgba(88,166,255,0.3)' } },
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

  return (
    <div
      className="bigscreen-container"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      {/* 顶部标题栏 */}
      <div className="bs-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          {/* 闲置时隐藏左上角看板名称按钮，改显示系统时间 */}
          {!idle ? (
            <>
              <span
                style={{ color: '#8B949E', cursor: 'pointer', fontSize: 16 }}
                onClick={() => navigate('/dashboard')}
                title="返回工作台"
              >
                <ArrowLeftOutlined />
              </span>
              <div className="bs-screen-tabs">
                <div className="bs-screen-tab active">生产大屏</div>
                <div className="bs-screen-tab" onClick={() => navigate('/bigscreen/management')}>管理大屏</div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#8B949E', fontFamily: "'Courier New', monospace", fontSize: 16 }}>
              <span style={{ color: '#3FB950' }}>●</span>
              <span>{formatClock(currentTime)}</span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>系统时间</span>
            </div>
          )}
        </div>
        <div className="bs-title">
          <img src={logoRect} alt="logo" style={{ height: 40, width: 'auto', marginRight: 12, verticalAlign: 'middle' }} />
          奶粉罐生产实时监控大屏
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* 右上角：温度、湿度、压差 */}
          <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#8B949E' }}>
            <span title="温度">
              <span style={{ color: '#58A6FF' }}>温度</span>
              <span style={{ color: '#E6EDF3', fontFamily: "'Courier New', monospace", marginLeft: 4 }}>
                {envData.temperature.toFixed(1)}°C
              </span>
            </span>
            <span title="湿度">
              <span style={{ color: '#3FB950' }}>湿度</span>
              <span style={{ color: '#E6EDF3', fontFamily: "'Courier New', monospace", marginLeft: 4 }}>
                {envData.humidity.toFixed(1)}%
              </span>
            </span>
            <span title="压差">
              <span style={{ color: '#F0883E' }}>压差</span>
              <span style={{ color: '#E6EDF3', fontFamily: "'Courier New', monospace", marginLeft: 4 }}>
                {envData.pressure.toFixed(1)}Pa
              </span>
            </span>
          </div>
          <ReloadOutlined style={{ color: '#3FB950' }} />
          <div className="bs-time">{formatTime(currentTime)}</div>
        </div>
      </div>

      {/* 数据日期提示 */}
      {activeDate && (
        <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 6, padding: '0 4px' }}>
          数据日期：<span style={{ color: '#58A6FF', fontFamily: "'Courier New', monospace" }}>{activeDate}</span>
          <span style={{ marginLeft: 8, opacity: 0.7 }}>（当日无数据时显示最近有数据的日期，每 30 秒自动刷新）</span>
        </div>
      )}

      {/* KPI 指标行 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexShrink: 0 }}>
        {kpiData.map((kpi, i) => (
          <div key={i} className="bs-panel" style={{ flex: 1 }}>
            <div className="bs-kpi-card">
              <div className="bs-kpi-value bs-number-glow" style={{ color: kpi.color }}>
                {kpi.value}<span style={{ fontSize: 16, marginLeft: 2 }}>{kpi.unit}</span>
              </div>
              <div className="bs-kpi-label">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 主体内容：两行图表网格 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 第一行：产线状态 | 产出趋势折线 | 不良分布饼图 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
          {/* 左：产线运行状态 + 设备状态概览（不显示滚动条） */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="bs-panel bs-no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="bs-panel-title">产线运行状态</div>
              {productionLines.map(line => (
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
            </div>

            <div className="bs-panel bs-no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="bs-panel-title">设备状态概览</div>
              {devices.map(d => (
                <div key={d.device_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                  <span style={{ color: '#C9D1D9' }}>{d.device_name}</span>
                  <Tag color={d.status === '运行' ? 'success' : d.status === '故障' ? 'error' : 'default'} style={{ fontSize: 11 }}>{d.status}</Tag>
                </div>
              ))}
              {faultDevices.length > 0 && (
                <div style={{ marginTop: 8, padding: 8, background: 'rgba(248,81,73,0.1)', borderRadius: 6, fontSize: 12, color: '#F85149' }}>
                  ⚠ 当前 {faultDevices.length} 台设备故障，请及时处理
                </div>
              )}
            </div>
          </div>

          {/* 中：产线产出趋势（折线图） */}
          <div className="bs-panel" style={{ flex: 2, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">产线产出趋势</div>
            <div ref={lineChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>

          {/* 右：不良分布分析（饼图） */}
          <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">不良分布分析</div>
            <div ref={defectPieRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>
        </div>

        {/* 第二行：工序产出柱状 | 工单进度横向柱状 | 订单概览（工序产出与工单进度等宽分配） */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
          {/* 左：各工序产出统计（柱状图） - 与工单进度等宽 */}
          <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">各工序产出统计</div>
            <div ref={processBarRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>

          {/* 中：生产工单实时进度（横向柱状图） - 与工序产出等宽 */}
          <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">生产工单实时进度</div>
            <div ref={orderProgressRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>

          {/* 右：生产订单概览（按屏幕可显示记录数自适应，已开工→待下达→已关闭排序） */}
          <div className="bs-panel bs-no-scrollbar" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bs-panel-title">生产订单概览</div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {sortedOrders.map(o => (
                <div key={o.order_id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{o.order_no}</span>
                    <Tag
                      color={o.status === '已下达' || o.status === '已开工' ? 'processing' : o.status === '已关闭' ? 'success' : 'default'}
                      style={{ fontSize: 11 }}
                    >
                      {o.status}
                    </Tag>
                  </div>
                  <div style={{ color: '#8B949E' }}>{o.material_name} · {o.planned_qty.toLocaleString()}件</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
