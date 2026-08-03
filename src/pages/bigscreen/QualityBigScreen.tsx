import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
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
  const { incomingInspections = [], finishedInspections = [], microbeInspections = [], envInspections = [], complaints = [] } = data || {}
  const allDates = []
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

export default function QualityBigScreen() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeDate, setActiveDate] = useState<string>(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })
  const [idle, setIdle] = useState(false)
  const [dashboardData, setDashboardData] = useState<any>({
    incomingInspections: [],
    finishedInspections: [],
    microbeInspections: [],
    envInspections: [],
    complaints: [],
    instruments: [],
    inspectionStandards: [],
    materials: [],
  })
  const [dataVersion, setDataVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dataUpdateTime, setDataUpdateTime] = useState<string>('')

  const barChartRef = useRef(null)
  const pieChartRef = useRef(null)
  const lineChartRef = useRef(null)
  const gaugeChartRef = useRef(null)

  const barChartRef2 = useRef<any>(null)
  const pieChartRef2 = useRef<any>(null)
  const lineChartRef2 = useRef<any>(null)
  const gaugeChartRef2 = useRef<any>(null)

  const idleTimerRef = useRef<any>(null)

  const resetIdle = useCallback(() => {
    setIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_THRESHOLD)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api.get('/auto/dashboard/quality')
      if (resp?.data) {
        setDashboardData(resp.data)
        setActiveDate(resp.data.activeDate || getActiveDateFromData(resp.data))
        setDataUpdateTime(resp.data.queryTime || new Date().toISOString())
        setDataVersion(v => v + 1)
      }
    } catch (err) {
      console.error('加载质量看板数据失败:', err)
    } finally {
      setLoading(false)
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
  const { style: scaleStyle } = useBigScreenScale({ designWidth: 1280, designHeight: 720 })

  const {
    incomingInspections = [],
    finishedInspections = [],
    microbeInspections = [],
    envInspections = [],
    complaints = [],
    instruments = [],
    inspectionStandards = [],
    materials = [],
  } = dashboardData || {}

  const dateIncoming = filterByDate(incomingInspections, activeDate, 'inspection_time', 'arrival_date', 'created_at')
  const dateFinished = filterByDate(finishedInspections, activeDate, 'inspection_time', 'created_at')
  const dateMicrobe = filterByDate(microbeInspections, activeDate, 'inspection_time', 'created_at')
  const dateEnv = filterByDate(envInspections, activeDate, 'inspection_date', 'inspection_time', 'created_at')
  const dateComplaints = filterByDate(complaints, activeDate, 'complaint_time', 'created_at')
  const hasDateData = dateIncoming.length > 0 || dateFinished.length > 0 || dateMicrobe.length > 0 || dateEnv.length > 0
  const useIncoming = hasDateData ? dateIncoming : incomingInspections
  const useFinished = hasDateData ? dateFinished : finishedInspections
  const useMicrobe = hasDateData ? dateMicrobe : microbeInspections
  const useEnv = hasDateData ? dateEnv : envInspections
  const useComplaints = dateComplaints.length > 0 ? dateComplaints : complaints

  // 规范化检验结果字段
  const getResult = (item: any) => {
    const r = item?.result || item?.inspection_result || item?.conclusion || item?.status
    if (r === '合格' || r === 'Pass' || r === 'pass' || r === 'OK' || r === 1 || r === '通过') return '合格'
    if (r === '不合格' || r === 'Fail' || r === 'fail' || r === 'NG' || r === 0 || r === '不通过') return '不合格'
    return r || '待检'
  }

  const calcPassRate = (list) => {
    const completed = list.filter((i) => getResult(i) === '合格' || getResult(i) === '不合格')
    if (completed.length === 0) return 0
    const pass = completed.filter((i) => getResult(i) === '合格').length
    return Number(((pass / completed.length) * 100).toFixed(1))
  }

  const incomingRate = calcPassRate(useIncoming)
  const finishedRate = calcPassRate(useFinished)
  const microbeRate = calcPassRate(useMicrobe)
  const envRate = calcPassRate(useEnv)
  const activeComplaints = useComplaints.filter((c) => (c.status || '处理中') !== '已关闭' && (c.status || '处理中') !== 'closed').length

  const materialsWithStandard = new Set(
    inspectionStandards.filter((s) => (s.status === 1 || s.status === '生效' || s.status === '启用')).map((s) => s.material_id)
  )
  const standardCoverage =
    materials.length > 0 ? Math.round((materialsWithStandard.size / materials.length) * 100) : 0

  const activeStandards = inspectionStandards.filter((s) => s.status === 1 || s.status === '生效' || s.status === '启用').length
  const standardActiveRate =
    inspectionStandards.length > 0 ? Math.round((activeStandards / inspectionStandards.length) * 100) : 0

  const validInstruments = instruments.filter((i) => i.status === '正常' || i.status === '即将到期').length
  const instrumentValidRate =
    instruments.length > 0 ? Math.round((validInstruments / instruments.length) * 100) : 0

  const kpiData = [
    { label: '来料合格率', value: incomingRate, unit: '%', color: '#00d4ff' },
    { label: '成品合格率', value: finishedRate, unit: '%', color: '#00ff88' },
    { label: '微生物合格率', value: microbeRate, unit: '%', color: '#ffd93d' },
    { label: '环境合格率', value: envRate, unit: '%', color: '#ff6b6b' },
    { label: '活跃客诉数', value: activeComplaints, unit: '件', color: '#ff6b6b' },
  ]

  const noAnimation = { animation: false, animationDuration: 0, animationDurationUpdate: 0, animationEasingUpdate: 'linear' }

  useEffect(() => {
    if (!barChartRef.current) return
    let chart = barChartRef2.current
    if (!chart) {
      chart = echarts.init(barChartRef.current)
      barChartRef2.current = chart
    }
    const barColors = ['#00d4ff', '#00ff88', '#ffd93d', '#ff6b6b']
    const rates = [incomingRate, finishedRate, microbeRate, envRate]
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(0,212,255,0.4)',
        textStyle: { color: '#E6EDF3' },
        formatter: '{b}<br/>合格率：{c}%',
      },
      grid: { left: '8%', right: '6%', top: '22%', bottom: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['来料', '成品', '微生物', '环境'],
        axisLine: { lineStyle: { color: 'rgba(0,212,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9', fontSize: 13, fontWeight: 600 },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#8B949E', formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
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
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [incomingRate, finishedRate, microbeRate, envRate, dataVersion])

  useEffect(() => {
    if (!pieChartRef.current) return
    let chart = pieChartRef2.current
    if (!chart) {
      chart = echarts.init(pieChartRef.current)
      pieChartRef2.current = chart
    }
    const unqualifiedData = [
      { name: '来料检验', value: useIncoming.filter(i => getResult(i) === '不合格').length || 0 },
      { name: '成品检验', value: useFinished.filter(i => getResult(i) === '不合格').length || 0 },
      { name: '微生物检验', value: useMicrobe.filter(i => getResult(i) === '不合格').length || 0 },
      { name: '环境检验', value: useEnv.filter(i => getResult(i) === '不合格').length || 0 },
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
        borderColor: 'rgba(0,212,255,0.4)',
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
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [useIncoming, useFinished, useMicrobe, useEnv, dataVersion])

  // 客诉趋势：优先根据真实 complaints 按月计算，无真实数据时显示演示值
  const computeComplaintTrend = () => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月']
    const newArr = new Array(6).fill(0)
    const closedArr = new Array(6).fill(0)
    const today = new Date()
    const curYear = today.getFullYear()
    const curMonth = today.getMonth()
    useComplaints.forEach(c => {
      const t = c.complaint_time || c.created_at
      if (!t) return
      const d = new Date(t)
      if (isNaN(d.getTime())) return
      const monthOffset = (curYear - d.getFullYear()) * 12 + (curMonth - d.getMonth())
      if (monthOffset >= 0 && monthOffset < 6) {
        const idx = 5 - monthOffset
        newArr[idx] += 1
        const st = c.status
        if (st === '已关闭' || st === 'closed' || st === '已解决' || st === 3) closedArr[idx] += 1
      }
    })
    const hasReal = newArr.some(v => v > 0) || closedArr.some(v => v > 0)
    if (hasReal) return { months, newComplaints: newArr, closedComplaints: closedArr }
    return { months, newComplaints: [3, 2, 4, 3, 5, 2], closedComplaints: [2, 2, 3, 4, 4, 2] }
  }

  useEffect(() => {
    if (!lineChartRef.current) return
    let chart = lineChartRef2.current
    if (!chart) {
      chart = echarts.init(lineChartRef.current)
      lineChartRef2.current = chart
    }
    const { months, newComplaints, closedComplaints } = computeComplaintTrend()
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
        data: ['新增客诉', '已关闭客诉'],
      },
      grid: { left: '8%', right: '6%', top: '24%', bottom: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: months,
        axisLine: { lineStyle: { color: 'rgba(0,212,255,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#C9D1D9' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#8B949E' },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.08)' } },
      },
      series: [
        {
          name: '新增客诉',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          data: newComplaints,
          lineStyle: { color: '#ff6b6b', width: 3 },
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
          lineStyle: { color: '#00ff88', width: 3 },
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
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [dataVersion, activeDate])

  useEffect(() => {
    if (!gaugeChartRef.current) return
    let chart = gaugeChartRef2.current
    if (!chart) {
      chart = echarts.init(gaugeChartRef.current)
      gaugeChartRef2.current = chart
    }
    const gaugeColors = ['#00d4ff', '#00ff88', '#ffd93d']
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(13,27,42,0.92)',
        borderColor: 'rgba(0,212,255,0.4)',
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
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [standardCoverage, standardActiveRate, instrumentValidRate, dataVersion])

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
    <div style={{ width: '100vw', height: '100vh', minWidth: 1280, minHeight: 720, overflow: 'hidden', background: '#0a0e1a' }}>
      <div className="bigscreen-container" style={{ display: 'flex', flexDirection: 'column', height: '720px', overflow: 'hidden', ...scaleStyle }}>
        <BigScreenHeader
          title="质量检测中心"
          extraLeft={leftDateTime}
          extraRight={rightUpdateTime}
        />


        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexShrink: 0 }}>
          {kpiData.map((kpi, i) => (
            <BigScreenPanel key={i} style={{ flex: 1 }}>
              <div className="bs-kpi-card">
                <div className="bs-kpi-value bs-number-glow" style={{ color: kpi.color }}>
                  {kpi.value}
                  <span style={{ fontSize: 16, marginLeft: 2 }}>{kpi.unit}</span>
                </div>
                <div className="bs-kpi-label">{kpi.label}</div>
              </div>
            </BigScreenPanel>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            <BigScreenPanel title="来料 / 成品 / 微生物 / 环境合格率对比" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div ref={barChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
            <BigScreenPanel title="各检验类别不合格分布" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div ref={pieChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
            <BigScreenPanel title="客诉趋势" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div ref={lineChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
            <BigScreenPanel title="检验标准覆盖率" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div ref={gaugeChartRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
            </BigScreenPanel>
          </div>
        </div>
      </div>
    </div>
  )
}
