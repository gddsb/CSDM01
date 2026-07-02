import React, { useState, useEffect, useRef } from 'react'
import { Tag, Button } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import * as echarts from 'echarts'
import { workOrders, processReports, productionLines, devices, orders } from '../../mock/data'
import logoRect from '../../assets/logo-rect.png'
import '../../styles/bigscreen.css'

export default function ProductionBigScreen() {
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())

  // ECharts 图表容器 ref
  const lineChartRef = useRef(null)
  const processBarRef = useRef(null)
  const defectPieRef = useRef(null)
  const orderProgressRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  // ============ 数据计算 ============
  const activeWorkOrders = workOrders.filter(w => w.status === '开工')
  const totalTarget = activeWorkOrders.reduce((s, w) => s + w.target_qty, 0)
  const totalOutput = processReports
    .filter(r => activeWorkOrders.some(w => w.work_order_id === r.work_order_id))
    .reduce((s, r) => s + r.output_qty, 0)
  const totalDefect = processReports.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
  const totalInput = processReports.filter(r => r.process_name === '裁剪下料').reduce((s, r) => s + r.input_qty, 0)
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

  // 工单进度（包含开工/完工/开立，排除已关闭工单，用于横向柱状图）
  const chartWorkOrders = workOrders
    .filter(w => w.status !== '关闭')
    .map(w => {
      const reported = processReports
        .filter(r => r.work_order_id === w.work_order_id)
        .reduce((s, r) => s + r.output_qty, 0)
      const pct = w.target_qty > 0 ? Math.round(reported / w.target_qty * 100) : 0
      return { ...w, reported, pct }
    })

  // 工序产出统计聚合
  const processStats = {}
  processReports.forEach(r => {
    if (!processStats[r.process_name]) {
      processStats[r.process_name] = { name: r.process_name, input: 0, output: 0, defect: 0 }
    }
    processStats[r.process_name].input += r.input_qty
    processStats[r.process_name].output += r.output_qty
    processStats[r.process_name].defect += r.defect_material + r.defect_process + r.defect_scrap
  })
  const processList = Object.values(processStats)

  // 不良分布聚合
  const defectDistribution = {}
  processReports.forEach(r => {
    defectDistribution['来料不良'] = (defectDistribution['来料不良'] || 0) + r.defect_material
    defectDistribution['制程不良'] = (defectDistribution['制程不良'] || 0) + r.defect_process
    defectDistribution['检验报废'] = (defectDistribution['检验报废'] || 0) + r.defect_scrap
  })
  const totalDefectAll = Object.values(defectDistribution).reduce((s, v) => s + v, 0)

  // ============ ECharts 图表初始化 ============

  // 1. 产线产出趋势 - 折线图（各产线全天每小时产出 08:00-20:00）
  useEffect(() => {
    if (!lineChartRef.current) return
    const chart = echarts.init(lineChartRef.current)
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
    // A线/B线全天运行（午休12-13点产能下降），C线上午维护下午恢复生产
    const lineA = [520, 580, 610, 590, 540, 480, 560, 600, 620, 580, 530, 450, 380]
    const lineB = [480, 520, 550, 530, 500, 460, 510, 540, 560, 530, 490, 420, 360]
    const lineC = [0, 0, 0, 0, 0, 0, 0, 360, 420, 440, 410, 350, 0]
    chart.setOption({
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
          lineStyle: { color: '#00d4ff', width: 3, shadowColor: 'rgba(0,212,255,0.5)', shadowBlur: 8 },
          itemStyle: { color: '#00d4ff', borderColor: '#0d1b2a', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0,212,255,0.35)' },
              { offset: 1, color: 'rgba(0,212,255,0)' },
            ]),
          },
        },
        {
          name: 'B线', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, data: lineB,
          lineStyle: { color: '#00ff88', width: 3, shadowColor: 'rgba(0,255,136,0.5)', shadowBlur: 8 },
          itemStyle: { color: '#00ff88', borderColor: '#0d1b2a', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0,255,136,0.3)' },
              { offset: 1, color: 'rgba(0,255,136,0)' },
            ]),
          },
        },
        {
          name: 'C线', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, data: lineC,
          lineStyle: { color: '#a78bfa', width: 3, shadowColor: 'rgba(167,139,250,0.5)', shadowBlur: 8 },
          itemStyle: { color: '#a78bfa', borderColor: '#0d1b2a', borderWidth: 2 },
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
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [])

  // 2. 各工序产出统计 - 柱状图（产出数量 vs 不良数量，双Y轴）
  useEffect(() => {
    if (!processBarRef.current) return
    const chart = echarts.init(processBarRef.current)
    const names = processList.map(p => p.name)
    const outputs = processList.map(p => p.output)
    const defects = processList.map(p => p.defect)
    chart.setOption({
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
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [processList])

  // 3. 不良分布分析 - 环形饼图（来料不良/制程不良/检验报废）
  useEffect(() => {
    if (!defectPieRef.current) return
    const chart = echarts.init(defectPieRef.current)
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
          data,
        },
      ],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [totalDefectAll])

  // 4. 工单进度 - 横向柱状图（目标数量 vs 完工数量）
  useEffect(() => {
    if (!orderProgressRef.current) return
    const chart = echarts.init(orderProgressRef.current)
    const labels = chartWorkOrders.map(w => `${w.work_order_no} · ${w.line_name}`)
    const targets = chartWorkOrders.map(w => w.target_qty)
    const completeds = chartWorkOrders.map(w => w.reported)
    chart.setOption({
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
            formatter: (p) => `${chartWorkOrders[p.dataIndex].pct}%`,
          },
        },
      ],
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize) }
  }, [chartWorkOrders])

  return (
    <div className="bigscreen-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 顶部标题栏 */}
      <div className="bs-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
            style={{ color: '#8B949E' }}
          />
          <div className="bs-screen-tabs">
            <div className="bs-screen-tab active">生产大屏</div>
            <div className="bs-screen-tab" onClick={() => navigate('/bigscreen/management')}>管理大屏</div>
          </div>
        </div>
        <div className="bs-title">
          <img src={logoRect} alt="logo" style={{ height: 40, width: 'auto', marginRight: 12, verticalAlign: 'middle' }} />
          奶粉罐生产实时监控大屏
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
          {/* 左：产线运行状态 + 设备状态概览 */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="bs-panel" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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

            <div className="bs-panel" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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

        {/* 第二行：工序产出柱状 | 工单进度横向柱状 | 订单概览 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
          {/* 左：各工序产出统计（柱状图） */}
          <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">各工序产出统计</div>
            <div ref={processBarRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>

          {/* 中：生产工单实时进度（横向柱状图） */}
          <div className="bs-panel" style={{ flex: 2, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="bs-panel-title">生产工单实时进度</div>
            <div ref={orderProgressRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
          </div>

          {/* 右：生产订单概览 */}
          <div className="bs-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <div className="bs-panel-title">生产订单概览</div>
            {orders.map(o => (
              <div key={o.order_id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{o.order_no}</span>
                  <Tag color={o.status === '已下达' ? 'processing' : o.status === '已关闭' ? 'success' : 'default'} style={{ fontSize: 11 }}>{o.status}</Tag>
                </div>
                <div style={{ color: '#8B949E' }}>{o.material_name} · {o.planned_qty.toLocaleString()}件</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
