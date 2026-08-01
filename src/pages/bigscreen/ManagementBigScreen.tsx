import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
import { Row, Col, Tag } from 'antd'
import api from '../../utils/api'
import BigScreenHeader from '../../components/BigScreenHeader'
import BigScreenPanel from '../../components/BigScreenPanel'
import '../../styles/bigscreen.css'
import { useBigScreenScale } from '../../hooks/useBigScreenScale'

const DATA_REFRESH_INTERVAL = 60 * 1000
const IDLE_THRESHOLD = 15 * 1000

function extractDates(items: any[], ...fields: string[]) {
  const set = new Set<string>()
  ;(items || []).forEach(item => {
    fields.forEach(f => {
      const v = item?.[f]
      if (v && typeof v === 'string') {
        const m = v.match(/^(\d{4}-\d{2}-\d{2})/)
        if (m) set.add(m[1])
      }
    })
  })
  return Array.from(set).sort()
}

function getActiveDateFromData(data: any) {
  const { orders = [], workOrders = [], processReports = [], incomingInspections = [], finishedInspections = [], microbeInspections = [], envInspections = [], complaints = [] } = data || {}
  const allDates = []
    .concat(extractDates(orders, 'plan_start_time', 'release_time', 'created_at'))
    .concat(extractDates(workOrders, 'start_time', 'report_time', 'created_at'))
    .concat(extractDates(processReports, 'report_time', 'created_at'))
    .concat(extractDates(incomingInspections, 'inspection_time', 'arrival_date', 'created_at'))
    .concat(extractDates(finishedInspections, 'inspection_time', 'created_at'))
    .concat(extractDates(microbeInspections, 'inspection_time', 'created_at'))
    .concat(extractDates(envInspections, 'inspection_date', 'inspection_time', 'created_at'))
    .concat(extractDates(complaints, 'complaint_time', 'created_at'))
  if (allDates.length === 0) {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (allDates.includes(todayStr)) return todayStr
  const pastDates = allDates.filter(d => d <= todayStr)
  return pastDates.length > 0 ? pastDates[pastDates.length - 1] : allDates[allDates.length - 1]
}

function filterByDate(items: any[], dateStr: string, ...fields: string[]) {
  if (!dateStr) return items || []
  return (items || []).filter(item =>
    fields.some(f => {
      const v = item?.[f]
      return v && typeof v === 'string' && v.startsWith(dateStr)
    })
  )
}

const AXIS_LABEL = '#C9D1D9'
const SPLIT_LINE = 'rgba(255,255,255,0.06)'
const AXIS_LINE = 'rgba(255,255,255,0.2)'
const CHART_COLORS = {
  cyan: '#00d4ff',
  green: '#00ff88',
  red: '#ff6b6b',
  yellow: '#ffd93d',
  purple: '#a78bfa',
}
const DEVICE_STATUS_COLOR: any = {
  '运行中': CHART_COLORS.green,
  '运行': CHART_COLORS.green,
  '待机': CHART_COLORS.cyan,
  '维修': CHART_COLORS.yellow,
  '停机': CHART_COLORS.red,
  '故障': CHART_COLORS.red,
}

export default function ManagementBigScreen() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeDate, setActiveDate] = useState<string>(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })
  const [idle, setIdle] = useState(false)
  const [dashboardData, setDashboardData] = useState<any>({
    orders: [], workOrders: [], processReports: [], productionLines: [], devices: [],
    incomingInspections: [], finishedInspections: [], microbeInspections: [], envInspections: [],
    complaints: [], instruments: [], materials: [],
  })
  const [dataVersion, setDataVersion] = useState(0)
  const [dataUpdateTime, setDataUpdateTime] = useState<string>('')

  const orderTrendRef = useRef(null)
  const lineUtilRef = useRef(null)
  const qualityTrendRef = useRef(null)
  const deviceStatusRef = useRef(null)
  const lineOutputRef = useRef(null)

  const orderTrendRef2 = useRef<any>(null)
  const lineUtilRef2 = useRef<any>(null)
  const qualityTrendRef2 = useRef<any>(null)
  const deviceStatusRef2 = useRef<any>(null)
  const lineOutputRef2 = useRef<any>(null)

  const idleTimerRef = useRef<any>(null)

  const resetIdle = useCallback(() => {
    setIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_THRESHOLD)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const resp = await api.get('/auto/dashboard/management')
      if (resp?.data) {
        setDashboardData(resp.data)
        setActiveDate(resp.data.activeDate || getActiveDateFromData(resp.data))
        setDataUpdateTime(resp.data.queryTime || new Date().toISOString())
        setDataVersion(v => v + 1)
      }
    } catch (err) {
      console.error('加载经营看板数据失败:', err)
    }
  }, [])

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, DATA_REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [loadData])

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

  const formatClock = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const formatDateTime = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const getWeekday = (d) => ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()]
  const formatQueryTime = (iso) => {
    if (!iso) return '--:--:--'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '--:--:--'
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1920, designHeight: 1080 })

  const noAnimation = { animation: false, animationDuration: 0, animationDurationUpdate: 0, animationEasingUpdate: 'linear' }

  // 解构真实数据
  const {
    orders = [],
    workOrders = [],
    processReports = [],
    productionLines = [],
    devices = [],
    incomingInspections = [],
    finishedInspections = [],
    microbeInspections = [],
    envInspections = [],
    complaints = [],
    instruments = [],
    materials = [],
  } = dashboardData || {}

  const dateOrders = filterByDate(orders, activeDate, 'plan_start_time', 'release_time', 'created_at')
  const dateWorkOrders = filterByDate(workOrders, activeDate, 'start_time', 'report_time', 'created_at')
  const dateProcessReports = filterByDate(processReports, activeDate, 'report_time', 'created_at')
  const dateIncoming = filterByDate(incomingInspections, activeDate, 'inspection_time', 'arrival_date', 'created_at')
  const dateFinished = filterByDate(finishedInspections, activeDate, 'inspection_time', 'created_at')
  const dateMicrobe = filterByDate(microbeInspections, activeDate, 'inspection_time', 'created_at')
  const dateEnv = filterByDate(envInspections, activeDate, 'inspection_date', 'inspection_time', 'created_at')
  const dateComplaints = filterByDate(complaints, activeDate, 'complaint_time', 'created_at')
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

  // 订单/工单状态兼容
  const orderOpenSet = new Set(['开立', '未下发', 0, '待下发'])
  const orderActiveSet = new Set(['下发', '开工', '已开工', '进行中', '已下达', 1, 2])
  const orderClosedSet = new Set(['完工', '已关闭', '关闭', 3, 4])
  const workOrderActiveSet = new Set(['已开工', '开工', '进行中', '生产中', 1, 2])
  const workOrderClosedSet = new Set(['已关闭', '完工', '关闭', '已完工', 3, 4])

  const activeOrders = useOrders.filter(o => !orderClosedSet.has(o.status)).length
  const closedOrders = useOrders.filter(o => orderClosedSet.has(o.status)).length
  const activeWorkOrders = useWorkOrders.filter(w => workOrderActiveSet.has(w.status)).length
  const completedWorkOrders = useWorkOrders.filter(w => workOrderClosedSet.has(w.status)).length

  // 检验结果规范化
  const getResult = (item: any) => {
    const r = item?.result || item?.inspection_result || item?.conclusion || item?.status
    if (r === '合格' || r === 'Pass' || r === 'pass' || r === 'OK' || r === 1 || r === '通过') return '合格'
    if (r === '不合格' || r === 'Fail' || r === 'fail' || r === 'NG' || r === 0 || r === '不通过') return '不合格'
    return '待检'
  }
  const getStatusText = (item: any) => {
    const s = item?.status
    if (s === 0) return '待检'
    if (s === 1) return '检验中'
    if (s === 2) return '完成'
    return s || '待检'
  }

  const incomingPass = useIncoming.filter(i => getResult(i) === '合格').length
  const incomingFail = useIncoming.filter(i => getResult(i) === '不合格').length
  const incomingPending = useIncoming.filter(i => getStatusText(i) === '检验中' || getResult(i) === '待检').length
  const finishedPass = useFinished.filter(i => getResult(i) === '合格').length
  const finishedTotal = useFinished.length
  const microbePass = useMicrobe.filter(i => getResult(i) === '合格').length
  const envPass = useEnv.filter(i => getResult(i) === '合格').length
  const envTotal = useEnv.length
  const activeComplaints = useComplaints.filter(c => (c.status || '处理中') !== '已关闭' && (c.status || '处理中') !== 'closed').length

  const runningDevices = devices.filter(d => d.status === '运行' || d.status === '运行中' || DEVICE_STATUS_COLOR[d.status] === CHART_COLORS.green).length
  const faultDevices = devices.filter(d => d.status === '故障' || d.status === '维修' || DEVICE_STATUS_COLOR[d.status] === CHART_COLORS.red).length
  const standbyDevices = devices.filter(d => d.status === '待机' || DEVICE_STATUS_COLOR[d.status] === CHART_COLORS.cyan).length
  const deviceUtilization = devices.length > 0 ? (runningDevices / devices.length * 100).toFixed(1) : '0'

  const normalInstruments = instruments.filter(i => i.status === '正常').length
  const expiringInstruments = instruments.filter(i => i.status === '即将到期').length
  const expiredInstruments = instruments.filter(i => i.status === '已超期').length

  const totalInput = useProcessReports.filter(r => (r.process_name || '').includes('裁剪')).reduce((s, r) => s + Number(r.input_qty || 0), 0)
  const totalDefect = useProcessReports.reduce((s, r) => s + Number(r.defect_material || 0) + Number(r.defect_process || 0) + Number(r.defect_scrap || 0), 0)
  const totalOutput = useProcessReports.reduce((s, r) => s + Number(r.output_qty || 0), 0)
  const yieldRate = totalInput > 0 ? ((totalInput - totalDefect) / totalInput * 100).toFixed(1) : '0'

  const kpiData = [
    { label: '活跃订单', value: activeOrders, unit: '', color: '#00d4ff', icon: '📋' },
    { label: '生效工单', value: activeWorkOrders, unit: '', color: '#3FB950', icon: '🔧' },
    { label: '生产良率', value: yieldRate, unit: '%', color: '#3FB950', icon: '✓' },
    { label: '来料合格率', value: incomingPass + incomingFail > 0 ? (incomingPass / (incomingPass + incomingFail) * 100).toFixed(1) : '0', unit: '%', color: '#00d4ff', icon: '🔬' },
    { label: '设备利用率', value: deviceUtilization, unit: '%', color: '#F0883E', icon: '⚙' },
    { label: '活跃客诉', value: activeComplaints, unit: '', color: '#F85149', icon: '⚠' },
  ]

  const qualitySummary = [
    { category: '来料检验', total: useIncoming.length, pass: incomingPass, fail: incomingFail, pending: incomingPending },
    { category: '成品检验', total: finishedTotal, pass: finishedPass, fail: finishedTotal - finishedPass, pending: 0 },
    { category: '微生物检验', total: useMicrobe.length, pass: microbePass, fail: useMicrobe.length - microbePass, pending: 0 },
    { category: '环境检验', total: envTotal, pass: envPass, fail: envTotal - envPass, pending: 0 },
  ]

  const qualityColumns = [
    { title: '检验类别', dataIndex: 'category', key: 'category', render: v => <span style={{ color: '#00d4ff', fontWeight: 600 }}>{v}</span> },
    { title: '总数', dataIndex: 'total', key: 'total', align: 'center' },
    { title: '合格', dataIndex: 'pass', key: 'pass', align: 'center', render: v => <span style={{ color: '#3FB950' }}>{v}</span> },
    { title: '不合格', dataIndex: 'fail', key: 'fail', align: 'center', render: v => v > 0 ? <span style={{ color: '#F85149' }}>{v}</span> : '-' },
    { title: '待检', dataIndex: 'pending', key: 'pending', align: 'center', render: v => v > 0 ? <span style={{ color: '#D29922' }}>{v}</span> : '-' },
    {
      title: '合格率', key: 'rate', align: 'center',
      render: (_: any, r: any) => r.total > 0 ? <span style={{ color: '#3FB950' }}>{(r.pass / r.total * 100).toFixed(0)}%</span> : '-'
    },
  ]

  const complaintColumns = [
    { title: '客诉编号', dataIndex: 'complaint_no', key: 'complaint_no', width: 120, render: (v: any, r: any) => v || r.complaint_id || '-' },
    { title: '客户', dataIndex: 'customer_name', key: 'customer_name', width: 100, render: (v: any, r: any) => v || r.customer || '-' },
    { title: '问题分类', dataIndex: 'complaint_type', key: 'complaint_type', width: 90, render: (v: any, r: any) => v || r.type || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={v === '已关闭' ? 'success' : 'processing'} style={{ fontSize: 11 }}>{v || '处理中'}</Tag> },
  ]

  // 计算订单完成趋势（近6个月），无数据时演示值
  const computeOrderTrend = () => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月']
    const targetArr = new Array(6).fill(0)
    const actualArr = new Array(6).fill(0)
    const today = new Date()
    const curYear = today.getFullYear()
    const curMonth = today.getMonth()
    ;[...useOrders, ...useWorkOrders].forEach(o => {
      const t = o.release_time || o.plan_start_time || o.start_time || o.created_at || o.report_time
      if (!t) return
      const d = new Date(t)
      if (isNaN(d.getTime())) return
      const monthOffset = (curYear - d.getFullYear()) * 12 + (curMonth - d.getMonth())
      if (monthOffset >= 0 && monthOffset < 6) {
        const idx = 5 - monthOffset
        const target = Number(o.planned_qty || o.order_qty || o.target_qty || 0)
        const actual = Number(o.report_qty || o.completed_qty || o.output_qty || (orderClosedSet.has(o.status) ? target : 0))
        targetArr[idx] += target
        actualArr[idx] += actual
      }
    })
    const hasReal = targetArr.some(v => v > 0) || actualArr.some(v => v > 0)
    if (hasReal) {
      // 如果没有目标，用上月实际值的 1.05 做平滑目标
      const smoothTarget = targetArr.map((v, i) => v > 0 ? v : (i > 0 ? Math.round(actualArr[i - 1] * 1.05) : 10000))
      return { months, orderTrendTarget: smoothTarget, orderTrendActual: actualArr }
    }
    return { months, orderTrendTarget: [10000, 12000, 15000, 13000, 16000, 17000], orderTrendActual: [9800, 11500, 14800, 12600, 15800, 14948] }
  }

  const lineNames = productionLines.map(l => l.line_name || l.name || `L${l.line_id}`)

  // 产线利用率：根据设备 location 匹配产线做统计，无匹配显示默认
  const computeLineUtil = () => {
    const palette = ['#00d4ff', '#00ff88', '#a78bfa', '#ffd93d', '#ff6b6b', '#F0883E']
    const arr = productionLines.map((l, idx) => {
      const ln = l.line_name || l.name || ''
      const matched = devices.filter(d =>
        (d.location || '').includes(ln) ||
        (d.production_line_id === l.line_id) ||
        (d.line_name === ln)
      )
      const matchedRunning = matched.filter(d => d.status === '运行' || d.status === '运行中').length
      const util = matched.length > 0 ? Math.round(matchedRunning / matched.length * 100) : 0
      return util
    })
    const hasReal = arr.some(v => v > 0)
    if (hasReal) return { lineNames, lineUtilData: arr }
    return { lineNames, lineUtilData: lineNames.map((_, i) => [88, 85, 78, 82, 90][i] || 70) }
  }

  // 质量合格率周趋势：优先根据真实数据按周聚合
  const computeQualityTrend = () => {
    const weeks = ['第1周', '第2周', '第3周', '第4周']
    const calc = (list: any[]) => {
      const byWeek = new Array(4).fill(0).map(() => ({ total: 0, pass: 0 }))
      const today = new Date()
      const startOf4WeeksAgo = new Date(today)
      startOf4WeeksAgo.setDate(today.getDate() - 27)
      startOf4WeeksAgo.setHours(0, 0, 0, 0)
      list.forEach(i => {
        const t = i.inspection_time || i.created_at || i.inspection_date
        if (!t) return
        const d = new Date(t)
        if (isNaN(d.getTime()) || d < startOf4WeeksAgo) return
        const daysDiff = Math.floor((today.getTime() - d.getTime()) / 86400000)
        const weekIdx = daysDiff < 7 ? 3 : daysDiff < 14 ? 2 : daysDiff < 21 ? 1 : 0
        const r = getResult(i)
        if (r === '合格' || r === '不合格') {
          byWeek[weekIdx].total += 1
          if (r === '合格') byWeek[weekIdx].pass += 1
        }
      })
      return byWeek.map(b => b.total > 0 ? Number((b.pass / b.total * 100).toFixed(0)) : 0)
    }
    const incomingArr = calc(useIncoming)
    const finishedArr = calc(useFinished)
    const microbeArr = calc(useMicrobe)
    const envArr = calc(useEnv)
    const hasReal = [incomingArr, finishedArr, microbeArr, envArr].some(arr => arr.some(v => v > 0))
    if (hasReal) {
      const fill = (arr: number[]) => arr.map(v => v === 0 ? 95 : v)
      return {
        weeks,
        series: {
          '来料': fill(incomingArr),
          '成品': fill(finishedArr),
          '微生物': fill(microbeArr),
          '环境': fill(envArr),
        },
      }
    }
    return {
      weeks,
      series: {
        '来料': [95, 96, 94, 97],
        '成品': [98, 99, 97, 99],
        '微生物': [100, 100, 98, 100],
        '环境': [92, 94, 96, 95],
      },
    }
  }

  const deviceStatusData = [
    { value: runningDevices, name: '运行中' },
    { value: standbyDevices, name: '待机' },
    { value: faultDevices, name: '维修' },
    { value: 0, name: '停机' },
  ].filter(d => d.value > 0)

  // 各产线产出：根据 processReports 按 line_name + material 聚合
  const computeLineOutput = () => {
    const products = new Set<string>()
    const byLineAndProduct: any = {}
    useProcessReports.forEach(r => {
      const ln = r.line_name || (productionLines[0] && productionLines[0].line_name) || '未知'
      const mat = r.material_name || r.product_name || '成品'
      products.add(mat)
      const key = `${ln}__${mat}`
      byLineAndProduct[key] = (byLineAndProduct[key] || 0) + Number(r.output_qty || 0)
    })
    const productList = Array.from(products).slice(0, 3)
    while (productList.length < 3) productList.push(`成品${productList.length + 1}`)
    const seriesData = productList.map(p => ({
      name: p,
      data: lineNames.map(ln => byLineAndProduct[`${ln}__${p}`] || 0),
    }))
    const hasReal = seriesData.some(s => s.data.some(v => v > 0))
    if (hasReal) return { lineNames, lineOutputProducts: productList, lineOutputSeries: seriesData }
    return {
      lineNames,
      lineOutputProducts: ['900g奶粉罐', '400g奶粉罐', '800g奶粉罐'],
      lineOutputSeries: [
        { name: '900g奶粉罐', data: [4983, 0, 2500].concat(new Array(Math.max(0, lineNames.length - 3)).fill(0)) },
        { name: '400g奶粉罐', data: [0, 1500, 3200].concat(new Array(Math.max(0, lineNames.length - 3)).fill(0)) },
        { name: '800g奶粉罐', data: [0, 9965, 0].concat(new Array(Math.max(0, lineNames.length - 3)).fill(0)) },
      ],
    }
  }

  useEffect(() => {
    if (!orderTrendRef.current) return
    let chart = orderTrendRef2.current
    if (!chart) {
      chart = echarts.init(orderTrendRef.current)
      orderTrendRef2.current = chart
    }
    const { months, orderTrendTarget, orderTrendActual } = computeOrderTrend()
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['目标数量', '完工数量'], textStyle: { color: AXIS_LABEL }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: months,
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
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [dataVersion, activeDate])

  useEffect(() => {
    if (!lineUtilRef.current) return
    let chart = lineUtilRef2.current
    if (!chart) {
      chart = echarts.init(lineUtilRef.current)
      lineUtilRef2.current = chart
    }
    const { lineNames: names, lineUtilData } = computeLineUtil()
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
      grid: { left: '3%', right: '6%', bottom: '3%', top: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: names,
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
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [dataVersion, activeDate])

  useEffect(() => {
    if (!qualityTrendRef.current) return
    let chart = qualityTrendRef2.current
    if (!chart) {
      chart = echarts.init(qualityTrendRef.current)
      qualityTrendRef2.current = chart
    }
    const { weeks, series: qSeries } = computeQualityTrend()
    const colorMap: any = {
      '来料': CHART_COLORS.cyan,
      '成品': CHART_COLORS.green,
      '微生物': CHART_COLORS.yellow,
      '环境': CHART_COLORS.purple,
    }
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: (p: any) => p.map((i: any) => `${i.marker}${i.seriesName}: ${i.value}%`).join('<br/>') },
      legend: { data: Object.keys(qSeries), textStyle: { color: AXIS_LABEL }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: weeks,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisLabel: { color: AXIS_LABEL },
      },
      yAxis: {
        type: 'value', min: 85, max: 100,
        axisLine: { show: false },
        axisLabel: { color: AXIS_LABEL, formatter: '{value}%' },
        splitLine: { lineStyle: { color: SPLIT_LINE } },
      },
      series: Object.entries(qSeries).map(([name, data]: any) => ({
        name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
        data,
        itemStyle: { color: colorMap[name] },
        lineStyle: { width: 2.5, color: colorMap[name] },
      })),
    })
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [dataVersion, activeDate])

  useEffect(() => {
    if (!deviceStatusRef.current) return
    let chart = deviceStatusRef2.current
    if (!chart) {
      chart = echarts.init(deviceStatusRef.current)
      deviceStatusRef2.current = chart
    }
    const dataSrc = deviceStatusData.length > 0 ? deviceStatusData : [{ name: '暂无数据', value: 1 }]
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
        data: dataSrc.map(d => ({
          value: d.value,
          name: d.name,
          itemStyle: { color: DEVICE_STATUS_COLOR[d.name] || '#8B949E' },
        })),
      }],
    })
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [dataVersion, runningDevices, standbyDevices, faultDevices])

  useEffect(() => {
    if (!lineOutputRef.current) return
    let chart = lineOutputRef2.current
    if (!chart) {
      chart = echarts.init(lineOutputRef.current)
      lineOutputRef2.current = chart
    }
    const { lineNames: names, lineOutputProducts, lineOutputSeries } = computeLineOutput()
    const productColors = [CHART_COLORS.cyan, CHART_COLORS.green, CHART_COLORS.yellow]
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: lineOutputProducts, textStyle: { color: AXIS_LABEL }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
      xAxis: {
        type: 'category',
        data: names,
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
        itemStyle: { color: productColors[i % productColors.length] },
        emphasis: { focus: 'series' },
      })),
    })
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [dataVersion, activeDate])

  const leftDateTime = (
    <div className="bs-header-date">
      <span className="bs-header-date-main">{formatDateTime(currentTime)}</span>
      <span className="bs-header-date-week">{getWeekday(currentTime)}</span>
    </div>
  )

  const rightUpdateTime = (
    <div className="bs-header-update">
      <span>更新时间</span>
      <span className="bs-header-update-time">{formatQueryTime(dataUpdateTime)}</span>
    </div>
  )

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0e1a' }}>
      <div className="bigscreen-container" style={{ display: 'flex', flexDirection: 'column', height: '1080px', overflow: 'hidden', ...scaleStyle }}>
        <BigScreenHeader
          title="经营管理中心"
          extraLeft={leftDateTime}
          extraRight={rightUpdateTime}
        />

        {/* KPI 行 - 固定高度 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexShrink: 0 }}>
          {kpiData.map((kpi, i) => (
            <BigScreenPanel key={i} style={{ flex: 1 }}>
              <div className="bs-kpi-card">
                <div className="bs-kpi-value bs-number-glow" style={{ color: kpi.color, fontSize: 32 }}>
                  {kpi.icon} {kpi.value}<span style={{ fontSize: 14, marginLeft: 2 }}>{kpi.unit}</span>
                </div>
                <div className="bs-kpi-label" style={{ fontSize: 12 }}>{kpi.label}</div>
              </div>
            </BigScreenPanel>
          ))}
        </div>

        {/* 中间图表区 - flex 1 自适应 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 第一行图表 */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            <BigScreenPanel title="订单完成趋势" style={{ flex: 2, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={orderTrendRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
            <BigScreenPanel title="设备运行状态分布" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={deviceStatusRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
            <BigScreenPanel title="产线利用率" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={lineUtilRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
          </div>

          {/* 第二行图表 */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            <BigScreenPanel title="质量合格率趋势" style={{ flex: 3, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={qualityTrendRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
            <BigScreenPanel title="各产线产出对比" style={{ flex: 2, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div ref={lineOutputRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
          </div>
        </div>

        {/* 底部主区 - flex 1 自适应 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, marginTop: 10 }}>
          {/* 左列 */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BigScreenPanel title="生产概况" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ textAlign: 'center', padding: 10, background: 'rgba(0,212,255,0.06)', borderRadius: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#00d4ff' }}>{activeOrders}</div>
                  <div style={{ fontSize: 11, color: '#8B949E' }}>活跃订单</div>
                </div>
                <div style={{ textAlign: 'center', padding: 10, background: 'rgba(63,185,80,0.06)', borderRadius: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#3FB950' }}>{activeWorkOrders}</div>
                  <div style={{ fontSize: 11, color: '#8B949E' }}>生效工单</div>
                </div>
                <div style={{ textAlign: 'center', padding: 10, background: 'rgba(240,136,62,0.06)', borderRadius: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#F0883E' }}>{Number(totalOutput).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#8B949E' }}>累计产出</div>
                </div>
                <div style={{ textAlign: 'center', padding: 10, background: 'rgba(248,81,73,0.06)', borderRadius: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#F85149' }}>{totalDefect}</div>
                  <div style={{ fontSize: 11, color: '#8B949E' }}>不良总数</div>
                </div>
              </div>
            </BigScreenPanel>

            <BigScreenPanel title="产线利用率" className="bs-no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {(productionLines.length > 0 ? productionLines : [{ line_id: 'nodata', line_name: '暂无产线数据', workshop: '-' }]).map(line => {
                const ln = line.line_name || ''
                const lineDevices = devices.filter(d =>
                  (d.location || '').includes(ln) ||
                  d.production_line_id === line.line_id ||
                  d.line_name === ln
                )
                const running = lineDevices.filter(d => d.status === '运行' || d.status === '运行中').length
                const utilization = lineDevices.length > 0 ? (running / lineDevices.length * 100) : 0
                return (
                  <div key={line.line_id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                      <span style={{ color: '#C9D1D9' }}>{ln || line.line_name}</span>
                      <span style={{ color: '#8B949E' }}>{utilization.toFixed(0)}%</span>
                    </div>
                    <div className="bs-progress-bar">
                      <div className="bs-progress-fill" style={{
                        width: `${utilization}%`,
                        background: utilization >= 75 ? '#3FB950' : utilization >= 50 ? '#00d4ff' : '#D29922'
                      }} />
                    </div>
                  </div>
                )
              })}
            </BigScreenPanel>

            <BigScreenPanel title="料品库存预警" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {(materials.length > 0 ? materials.slice(0, 10) : [{ material_id: 'nodata', material_name: '暂无料品', status: '-' }]).map(m => (
                <div key={m.material_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(0,212,255,0.06)', fontSize: 11 }}>
                  <span style={{ color: '#C9D1D9' }}>{m.material_name}</span>
                  <Tag color={m.status === '启用' || m.status === 1 ? 'success' : m.status === '试产' ? 'warning' : 'default'} style={{ fontSize: 10 }}>{typeof m.status === 'number' ? ({ 0: '停用', 1: '启用', 2: '试产' } as any)[m.status] : (m.status || '-')}</Tag>
                </div>
              ))}
            </BigScreenPanel>
          </div>

          {/* 中列 */}
          <div style={{ flex: 2, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BigScreenPanel title="质量检验综合汇总" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ResizableTable tableKey="pages_bigscreen_ManagementBigScreen_quality"
                className="bs-table"
                columns={qualityColumns}
                dataSource={qualitySummary}
                rowKey="category"
                size="small"
                pagination={false}
              />
            </BigScreenPanel>

            <BigScreenPanel title="各检验类别合格率对比" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {qualitySummary.map((q, i) => {
                  const rate = q.total > 0 ? (q.pass / q.total * 100) : 0
                  const color = rate >= 90 ? '#3FB950' : rate >= 70 ? '#D29922' : '#F85149'
                  return (
                    <div key={i} style={{ textAlign: 'center', padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color }} className="bs-number-glow">{rate.toFixed(0)}%</div>
                      <div style={{ fontSize: 11, color: '#8B949E', marginTop: 2 }}>{q.category}</div>
                      <div style={{ fontSize: 10, color: '#8B949E' }}>合格{q.pass}/总计{q.total}</div>
                    </div>
                  )
                })}
              </div>
            </BigScreenPanel>

            <BigScreenPanel title="客诉处理跟踪" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ResizableTable tableKey="pages_bigscreen_ManagementBigScreen_complaint"
                className="bs-table"
                columns={complaintColumns}
                dataSource={useComplaints.slice(0, 30)}
                rowKey={(r: any) => r.complaint_id || r.id || Math.random()}
                size="small"
                pagination={false}
                scroll={{ y: 'calc(100% - 40px)' }}
              />
            </BigScreenPanel>
          </div>

          {/* 右列 */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BigScreenPanel title="设备运行状态" className="bs-no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div style={{ textAlign: 'center', padding: 8, background: 'rgba(63,185,80,0.08)', borderRadius: 6 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#3FB950' }}>{runningDevices}</div>
                  <div style={{ fontSize: 10, color: '#8B949E' }}>运行</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'rgba(139,148,158,0.08)', borderRadius: 6 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#8B949E' }}>{standbyDevices}</div>
                  <div style={{ fontSize: 10, color: '#8B949E' }}>待机</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'rgba(248,81,73,0.08)', borderRadius: 6 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#F85149' }} className="bs-blink">{faultDevices}</div>
                  <div style={{ fontSize: 10, color: '#8B949E' }}>故障</div>
                </div>
              </div>
              <div style={{ padding: 8, background: 'rgba(0,212,255,0.06)', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#00d4ff' }} className="bs-number-glow">{deviceUtilization}%</div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>设备综合利用率</div>
              </div>
            </BigScreenPanel>

            <BigScreenPanel title="检测仪器校准状态" className="bs-no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {(instruments.length > 0 ? instruments.slice(0, 15) : [{ instrument_id: 'nodata', instrument_name: '暂无仪器数据', next_calibration_date: '-', status: '正常' }]).map(inst => (
                <div key={inst.instrument_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(0,212,255,0.06)', fontSize: 11 }}>
                  <div>
                    <div style={{ color: '#C9D1D9' }}>{inst.instrument_name}</div>
                    <div style={{ color: '#8B949E', fontSize: 10 }}>下次校准: {inst.next_calibration_date || '-'}</div>
                  </div>
                  <Tag color={inst.status === '正常' ? 'success' : inst.status === '即将到期' ? 'warning' : 'error'} style={{ fontSize: 10 }}>{inst.status || '-'}</Tag>
                </div>
              ))}
              {(normalInstruments + expiringInstruments + expiredInstruments > 0) && (
                <div style={{ marginTop: 6, padding: 6, background: 'rgba(0,212,255,0.05)', borderRadius: 4, display: 'flex', justifyContent: 'space-around', fontSize: 10 }}>
                  <span style={{ color: '#3FB950' }}>正常 {normalInstruments}</span>
                  <span style={{ color: '#D29922' }}>即将到期 {expiringInstruments}</span>
                  <span style={{ color: '#F85149' }}>已超期 {expiredInstruments}</span>
                </div>
              )}
            </BigScreenPanel>

            <BigScreenPanel title="订单完成情况" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div style={{ textAlign: 'center', padding: 8, background: 'rgba(0,212,255,0.06)', borderRadius: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#00d4ff' }}>{activeOrders}</div>
                  <div style={{ fontSize: 11, color: '#8B949E' }}>进行中</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'rgba(63,185,80,0.06)', borderRadius: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#3FB950' }}>{closedOrders}</div>
                  <div style={{ fontSize: 11, color: '#8B949E' }}>已关闭</div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#8B949E', textAlign: 'center' }}>
                本月已完成工单 <span style={{ color: '#3FB950', fontWeight: 600, fontSize: 14 }}>{completedWorkOrders}</span> 个
              </div>
            </BigScreenPanel>
          </div>
        </div>
      </div>
    </div>
  )
}
