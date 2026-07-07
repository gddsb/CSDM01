import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
import { Row, Col, Table, Tag, Button } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  workOrders, orders, incomingInspections, finishedInspections,
  microbeInspections, envInspections, complaints, instruments,
  processReports, devices, productionLines, materials
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
    .concat(extractDates(orders, 'plan_start_time', 'release_time', 'created_at'))
    .concat(extractDates(workOrders, 'start_time', 'created_at'))
    .concat(extractDates(processReports, 'report_time'))
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

// 暗色主题通用配置
const AXIS_LABEL = '#C9D1D9'
const SPLIT_LINE = 'rgba(255,255,255,0.06)'
const AXIS_LINE = 'rgba(255,255,255,0.2)'
// 大屏图表配色
const CHART_COLORS = {
  cyan: '#00d4ff',
  green: '#00ff88',
  red: '#ff6b6b',
  yellow: '#ffd93d',
  purple: '#a78bfa',
}
// 设备状态 -> 颜色映射
const DEVICE_STATUS_COLOR = {
  '运行中': CHART_COLORS.green,
  '待机': CHART_COLORS.cyan,
  '维修': CHART_COLORS.yellow,
  '停机': CHART_COLORS.red,
}

export default function ManagementBigScreen() {
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeDate, setActiveDate] = useState(getActiveDate())
  const [idle, setIdle] = useState(false)
  const [envData, setEnvData] = useState({ temperature: 21.5, humidity: 60.5, pressure: 18.0 })

  // ECharts 图表容器引用
  const orderTrendRef = useRef(null)
  const lineUtilRef = useRef(null)
  const qualityTrendRef = useRef(null)
  const deviceStatusRef = useRef(null)
  const lineOutputRef = useRef(null)

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

  // 通用图表配置：禁用动画（定期更新数据不要动画）
  const noAnimation = { animation: false, animationDuration: 0, animationDurationUpdate: 0, animationEasingUpdate: 'linear' }

  // 按当日过滤数据
  const dateOrders = filterByDate(orders, activeDate, 'plan_start_time', 'release_time', 'created_at')
  const dateWorkOrders = filterByDate(workOrders, activeDate, 'start_time', 'created_at')
  const dateProcessReports = filterByDate(processReports, activeDate, 'report_time')
  const dateIncoming = filterByDate(incomingInspections, activeDate, 'inspection_time', 'arrival_date')
  const dateFinished = filterByDate(finishedInspections, activeDate, 'inspection_time')
  const dateMicrobe = filterByDate(microbeInspections, activeDate, 'inspection_time')
  const dateEnv = filterByDate(envInspections, activeDate, 'inspection_date')
  const dateComplaints = filterByDate(complaints, activeDate, 'complaint_time')
  // 当日无数据时回退到全部
  const hasDateData = dateOrders.length > 0 || dateWorkOrders.length > 0 || dateProcessReports.length > 0
    || dateIncoming.length > 0 || dateFinished.length > 0 || dateMicrobe.length > 0 || dateEnv.length > 0
  const useOrders = hasDateData ? dateOrders : orders
  const useWorkOrders = hasDateData ? dateWorkOrders : workOrders
  const useProcessReports = hasDateData ? dateProcessReports : processReports
  const useIncoming = hasDateData ? dateIncoming : incomingInspections
  const useFinished = hasDateData ? dateFinished : finishedInspections
  const useMicrobe = hasDateData ? dateMicrobe : microbeInspections
  const useEnv = hasDateData ? dateEnv : envInspections
  const useComplaints = dateComplaints.length > 0 ? dateComplaints : complaints

  // 生产指标（基于当日过滤后的数据）
  const activeOrders = useOrders.filter(o => o.status !== '完工').length
  const closedOrders = useOrders.filter(o => o.status === '完工').length
  const activeWorkOrders = useWorkOrders.filter(w => w.status === '开工').length
  const completedWorkOrders = useWorkOrders.filter(w => w.status === '完工').length

  // 质量指标（基于当日过滤后的数据）
  const incomingPass = useIncoming.filter(i => i.result === '合格').length
  const incomingFail = useIncoming.filter(i => i.result === '不合格').length
  const incomingPending = useIncoming.filter(i => i.status === '检验中').length
  const finishedPass = useFinished.filter(i => i.result === '合格').length
  const finishedTotal = useFinished.length
  const microbePass = useMicrobe.filter(i => i.result === '合格').length
  const envPass = useEnv.filter(i => i.result === '合格').length
  const envTotal = useEnv.length
  const activeComplaints = useComplaints.filter(c => c.status !== '已关闭').length

  // 设备指标
  const runningDevices = devices.filter(d => d.status === '运行').length
  const faultDevices = devices.filter(d => d.status === '故障').length
  const standbyDevices = devices.filter(d => d.status === '待机').length
  const deviceUtilization = devices.length > 0 ? (runningDevices / devices.length * 100).toFixed(1) : 0

  // 仪器指标
  const normalInstruments = instruments.filter(i => i.status === '正常').length
  const expiringInstruments = instruments.filter(i => i.status === '即将到期').length
  const expiredInstruments = instruments.filter(i => i.status === '已超期').length

  // 生产数据（基于当日过滤后的数据）
  const totalInput = useProcessReports.filter(r => r.process_name === '裁剪下料').reduce((s, r) => s + r.input_qty, 0)
  const totalDefect = useProcessReports.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
  const totalOutput = useProcessReports.reduce((s, r) => s + r.output_qty, 0)
  const yieldRate = totalInput > 0 ? ((totalInput - totalDefect) / totalInput * 100).toFixed(1) : 0

  // KPI数据
  const kpiData = [
    { label: '活跃订单', value: activeOrders, unit: '', color: '#58A6FF', icon: '📋' },
    { label: '生效工单', value: activeWorkOrders, unit: '', color: '#3FB950', icon: '🔧' },
    { label: '生产良率', value: yieldRate, unit: '%', color: '#3FB950', icon: '✓' },
    { label: '来料合格率', value: incomingPass + incomingFail > 0 ? (incomingPass / (incomingPass + incomingFail) * 100).toFixed(1) : 0, unit: '%', color: '#58A6FF', icon: '🔬' },
    { label: '设备利用率', value: deviceUtilization, unit: '%', color: '#F0883E', icon: '⚙' },
    { label: '活跃客诉', value: activeComplaints, unit: '', color: '#F85149', icon: '⚠' },
  ]

  // 质量检验汇总（基于当日过滤后的数据）
  const qualitySummary = [
    { category: '来料检验', total: useIncoming.length, pass: incomingPass, fail: incomingFail, pending: incomingPending },
    { category: '成品检验', total: finishedTotal, pass: finishedPass, fail: finishedTotal - finishedPass, pending: 0 },
    { category: '微生物检验', total: useMicrobe.length, pass: microbePass, fail: useMicrobe.length - microbePass, pending: 0 },
    { category: '环境检验', total: envTotal, pass: envPass, fail: envTotal - envPass, pending: 0 },
  ]

  const qualityColumns = [
    { title: '检验类别', dataIndex: 'category', key: 'category', render: v => <span style={{ color: '#58A6FF', fontWeight: 600 }}>{v}</span> },
    { title: '总数', dataIndex: 'total', key: 'total', align: 'center' },
    { title: '合格', dataIndex: 'pass', key: 'pass', align: 'center', render: v => <span style={{ color: '#3FB950' }}>{v}</span> },
    { title: '不合格', dataIndex: 'fail', key: 'fail', align: 'center', render: v => v > 0 ? <span style={{ color: '#F85149' }}>{v}</span> : '-' },
    { title: '待检', dataIndex: 'pending', key: 'pending', align: 'center', render: v => v > 0 ? <span style={{ color: '#D29922' }}>{v}</span> : '-' },
    {
      title: '合格率', key: 'rate', align: 'center',
      render: (_, r) => r.total > 0 ? <span style={{ color: '#3FB950' }}>{(r.pass / r.total * 100).toFixed(0)}%</span> : '-'
    },
  ]

  // 客诉列表
  const complaintColumns = [
    { title: '客诉编号', dataIndex: 'complaint_no', key: 'complaint_no', width: 120 },
    { title: '客户', dataIndex: 'customer_name', key: 'customer_name', width: 100 },
    { title: '问题分类', dataIndex: 'complaint_type', key: 'complaint_type', width: 90 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={v === '已关闭' ? 'success' : 'processing'} style={{ fontSize: 11 }}>{v}</Tag> },
  ]

  // ============ 图表数据准备 ============
  // 订单完成趋势 - 基于现有订单生成 6 个月的目标/完工数据
  const orderTrendMonths = ['1月', '2月', '3月', '4月', '5月', '6月']
  const orderTrendTarget = [10000, 12000, 15000, 13000, 16000, 17000]
  const orderTrendActual = [9800, 11500, 14800, 12600, 15800, 14948]

  // 产线利用率 - 各产线 75-95% 区间模拟数据
  const lineNames = productionLines.map(l => l.line_name)
  const lineUtilData = [88, 85, 78]

  // 质量合格率趋势 - 4 周，4 类检验
  const qualityTrendWeeks = ['第1周', '第2周', '第3周', '第4周']
  const qualityTrendSeries = {
    '来料': [95, 96, 94, 97],
    '成品': [98, 99, 97, 99],
    '微生物': [100, 100, 98, 100],
    '环境': [92, 94, 96, 95],
  }

  // 设备运行状态分布 - 基于设备 mock 数据
  const deviceStatusData = [
    { value: devices.filter(d => d.status === '运行').length, name: '运行中' },
    { value: devices.filter(d => d.status === '待机').length, name: '待机' },
    { value: devices.filter(d => d.status === '故障').length, name: '维修' },
    { value: 0, name: '停机' },
  ].filter(d => d.value > 0)

  // 各产线产出对比 - 按产品类型堆叠
  const lineOutputProducts = ['900g奶粉罐', '400g奶粉罐', '800g奶粉罐']
  const lineOutputSeries = [
    { name: '900g奶粉罐', data: [4983, 0, 2500] },
    { name: '400g奶粉罐', data: [0, 1500, 3200] },
    { name: '800g奶粉罐', data: [0, 9965, 0] },
  ]

  // ============ 图表初始化 ============
  useEffect(() => {
    if (!orderTrendRef.current) return
    const chart = echarts.init(orderTrendRef.current)
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['目标数量', '完工数量'], textStyle: { color: AXIS_LABEL }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: orderTrendMonths,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisLabel: { color: AXIS_LABEL },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: AXIS_LABEL },
        splitLine: { lineStyle: { color: SPLIT_LINE } },
      },
      series: [
        {
          name: '目标数量', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
          data: orderTrendTarget,
          itemStyle: { color: CHART_COLORS.cyan },
          lineStyle: { width: 3, color: CHART_COLORS.cyan },
          areaStyle: { color: 'rgba(0,212,255,0.15)' },
        },
        {
          name: '完工数量', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
          data: orderTrendActual,
          itemStyle: { color: CHART_COLORS.green },
          lineStyle: { width: 3, color: CHART_COLORS.green },
          areaStyle: { color: 'rgba(0,255,136,0.15)' },
        },
      ],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [])

  useEffect(() => {
    if (!lineUtilRef.current) return
    const chart = echarts.init(lineUtilRef.current)
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
      grid: { left: '3%', right: '6%', bottom: '3%', top: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: lineNames,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisLabel: { color: AXIS_LABEL },
      },
      yAxis: {
        type: 'value', min: 0, max: 100,
        axisLine: { show: false },
        axisLabel: { color: AXIS_LABEL, formatter: '{value}%' },
        splitLine: { lineStyle: { color: SPLIT_LINE } },
      },
      series: [{
        type: 'bar',
        barWidth: '42%',
        data: lineUtilData,
        label: { show: true, position: 'top', color: AXIS_LABEL, formatter: '{c}%' },
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: CHART_COLORS.cyan },
              { offset: 1, color: CHART_COLORS.green },
            ],
          },
        },
      }],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [])

  useEffect(() => {
    if (!qualityTrendRef.current) return
    const chart = echarts.init(qualityTrendRef.current)
    const colorMap = {
      '来料': CHART_COLORS.cyan,
      '成品': CHART_COLORS.green,
      '微生物': CHART_COLORS.yellow,
      '环境': CHART_COLORS.purple,
    }
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: (p) => p.map(i => `${i.marker}${i.seriesName}: ${i.value}%`).join('<br/>') },
      legend: { data: Object.keys(qualityTrendSeries), textStyle: { color: AXIS_LABEL }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: qualityTrendWeeks,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisLabel: { color: AXIS_LABEL },
      },
      yAxis: {
        type: 'value', min: 85, max: 100,
        axisLine: { show: false },
        axisLabel: { color: AXIS_LABEL, formatter: '{value}%' },
        splitLine: { lineStyle: { color: SPLIT_LINE } },
      },
      series: Object.entries(qualityTrendSeries).map(([name, data]) => ({
        name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
        data,
        itemStyle: { color: colorMap[name] },
        lineStyle: { width: 2.5, color: colorMap[name] },
      })),
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [])

  useEffect(() => {
    if (!deviceStatusRef.current) return
    const chart = echarts.init(deviceStatusRef.current)
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { color: AXIS_LABEL } },
      series: [{
        name: '设备状态',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        label: { color: AXIS_LABEL, formatter: '{b}\n{d}%' },
        labelLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } },
        data: deviceStatusData.map(d => ({
          value: d.value,
          name: d.name,
          itemStyle: { color: DEVICE_STATUS_COLOR[d.name] },
        })),
      }],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [])

  useEffect(() => {
    if (!lineOutputRef.current) return
    const chart = echarts.init(lineOutputRef.current)
    const productColors = [CHART_COLORS.cyan, CHART_COLORS.green, CHART_COLORS.yellow]
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: lineOutputProducts, textStyle: { color: AXIS_LABEL }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
      xAxis: {
        type: 'category',
        data: lineNames,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisLabel: { color: AXIS_LABEL },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: AXIS_LABEL },
        splitLine: { lineStyle: { color: SPLIT_LINE } },
      },
      series: lineOutputSeries.map((s, i) => ({
        name: s.name,
        type: 'bar',
        stack: 'total',
        data: s.data,
        barWidth: '40%',
        itemStyle: { color: productColors[i] },
        emphasis: { focus: 'series' },
      })),
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [])

  return (
    <div className="bigscreen-container">
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
                <div className="bs-screen-tab active">管理大屏</div>
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
            奶粉罐生产管理综合大屏
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

      {/* KPI指标行 */}
      <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
        {kpiData.map((kpi, i) => (
          <Col key={i} span={4}>
            <div className="bs-panel">
              <div className="bs-kpi-card">
                <div className="bs-kpi-value bs-number-glow" style={{ color: kpi.color }}>
                  {kpi.icon} {kpi.value}<span style={{ fontSize: 16, marginLeft: 2 }}>{kpi.unit}</span>
                </div>
                <div className="bs-kpi-label">{kpi.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ECharts 图表区 - 第一行 */}
      <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
        <Col span={12}>
          <div className="bs-panel">
            <div className="bs-panel-title">订单完成趋势</div>
            <div ref={orderTrendRef} style={{ width: '100%', height: 260 }} />
          </div>
        </Col>
        <Col span={6}>
          <div className="bs-panel">
            <div className="bs-panel-title">设备运行状态分布</div>
            <div ref={deviceStatusRef} style={{ width: '100%', height: 260 }} />
          </div>
        </Col>
        <Col span={6}>
          <div className="bs-panel">
            <div className="bs-panel-title">产线利用率</div>
            <div ref={lineUtilRef} style={{ width: '100%', height: 260 }} />
          </div>
        </Col>
      </Row>

      {/* ECharts 图表区 - 第二行 */}
      <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
        <Col span={14}>
          <div className="bs-panel">
            <div className="bs-panel-title">质量合格率趋势</div>
            <div ref={qualityTrendRef} style={{ width: '100%', height: 260 }} />
          </div>
        </Col>
        <Col span={10}>
          <div className="bs-panel">
            <div className="bs-panel-title">各产线产出对比</div>
            <div ref={lineOutputRef} style={{ width: '100%', height: 260 }} />
          </div>
        </Col>
      </Row>

      {/* 主体内容 */}
      <Row gutter={[10, 10]} className="bs-main-row">
        {/* 左侧：生产概况 + 订单 */}
        <Col span={6}>
          <div className="bs-panel">
            <div className="bs-panel-title">生产概况</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(88,166,255,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#58A6FF' }}>{activeOrders}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>活跃订单</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(63,185,80,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3FB950' }}>{activeWorkOrders}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>生效工单</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(240,136,62,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#F0883E' }}>{totalOutput.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>累计产出</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(248,81,73,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#F85149' }}>{totalDefect}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>不良总数</div>
              </div>
            </div>
          </div>

          <div className="bs-panel bs-no-scrollbar" style={{ overflow: 'auto' }}>
            <div className="bs-panel-title">产线利用率</div>
            {productionLines.map(line => {
              const lineDevices = devices.filter(d => d.location.includes(line.line_name))
              const running = lineDevices.filter(d => d.status === '运行').length
              const utilization = lineDevices.length > 0 ? (running / lineDevices.length * 100) : 0
              return (
                <div key={line.line_id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: '#C9D1D9' }}>{line.line_name}</span>
                    <span style={{ color: '#8B949E' }}>{utilization.toFixed(0)}%</span>
                  </div>
                  <div className="bs-progress-bar">
                    <div className="bs-progress-fill" style={{
                      width: `${utilization}%`,
                      background: utilization >= 75 ? '#3FB950' : utilization >= 50 ? '#58A6FF' : '#D29922'
                    }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">料品库存预警</div>
            {materials.map(m => (
              <div key={m.material_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                <span style={{ color: '#C9D1D9' }}>{m.material_name}</span>
                <Tag color={m.status === '启用' ? 'success' : m.status === '试产' ? 'warning' : 'default'} style={{ fontSize: 11 }}>{m.status}</Tag>
              </div>
            ))}
          </div>
        </Col>

        {/* 中间：质量检验汇总 + 良率趋势 */}
        <Col span={12}>
          <div className="bs-panel">
            <div className="bs-panel-title">质量检验综合汇总</div>
            <Table
              className="bs-table"
              columns={qualityColumns}
              dataSource={qualitySummary}
              rowKey="category"
              size="small"
              pagination={false}
            />
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">各检验类别合格率对比</div>
            <Row gutter={[12, 12]}>
              {qualitySummary.map((q, i) => {
                const rate = q.total > 0 ? (q.pass / q.total * 100) : 0
                const color = rate >= 90 ? '#3FB950' : rate >= 70 ? '#D29922' : '#F85149'
                return (
                  <Col key={i} span={6}>
                    <div style={{ textAlign: 'center', padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color }} className="bs-number-glow">{rate.toFixed(0)}%</div>
                      <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4 }}>{q.category}</div>
                      <div style={{ fontSize: 11, color: '#8B949E' }}>合格{q.pass}/总计{q.total}</div>
                    </div>
                  </Col>
                )
              })}
            </Row>
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">客诉处理跟踪</div>
            <Table
              className="bs-table"
              columns={complaintColumns}
              dataSource={useComplaints}
              rowKey="complaint_id"
              size="small"
              pagination={false}
              scroll={{ y: 'calc(100% - 40px)' }}
            />
          </div>
        </Col>

        {/* 右侧：设备 + 仪器 */}
        <Col span={6}>
          <div className="bs-panel bs-no-scrollbar" style={{ overflow: 'auto' }}>
            <div className="bs-panel-title">设备运行状态</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ textAlign: 'center', padding: 10, background: 'rgba(63,185,80,0.08)', borderRadius: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#3FB950' }}>{runningDevices}</div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>运行</div>
              </div>
              <div style={{ textAlign: 'center', padding: 10, background: 'rgba(139,148,158,0.08)', borderRadius: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#8B949E' }}>{standbyDevices}</div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>待机</div>
              </div>
              <div style={{ textAlign: 'center', padding: 10, background: 'rgba(248,81,73,0.08)', borderRadius: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#F85149' }} className="bs-blink">{faultDevices}</div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>故障</div>
              </div>
            </div>
            <div style={{ padding: 10, background: 'rgba(88,166,255,0.06)', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#58A6FF' }} className="bs-number-glow">{deviceUtilization}%</div>
              <div style={{ fontSize: 12, color: '#8B949E' }}>设备综合利用率</div>
            </div>
          </div>

          <div className="bs-panel bs-no-scrollbar" style={{ overflow: 'auto' }}>
            <div className="bs-panel-title">检测仪器校准状态</div>
            {instruments.map(inst => (
              <div key={inst.instrument_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                <div>
                  <div style={{ color: '#C9D1D9' }}>{inst.instrument_name}</div>
                  <div style={{ color: '#8B949E', fontSize: 11 }}>下次校准: {inst.next_calibration_date}</div>
                </div>
                <Tag color={inst.status === '正常' ? 'success' : inst.status === '即将到期' ? 'warning' : 'error'} style={{ fontSize: 11 }}>{inst.status}</Tag>
              </div>
            ))}
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">订单完成情况</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(88,166,255,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#58A6FF' }}>{activeOrders}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>进行中</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(63,185,80,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3FB950' }}>{closedOrders}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>已关闭</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#8B949E', textAlign: 'center' }}>
              本月已完成工单 <span style={{ color: '#3FB950', fontWeight: 600, fontSize: 16 }}>{completedWorkOrders}</span> 个
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}
