import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Table, Button, Select, Space, Row, Col, Progress } from 'antd'
import {
  ThunderboltOutlined, DashboardOutlined, ToolOutlined, TeamOutlined,
  ExportOutlined, ReloadOutlined, SearchOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import {
  workOrders, processReports, productionLines, manpowerRecords, exceptionRecords
} from '../../mock/data'

// 工时按0.5小时取值（四舍五入到最近的0.5）
const roundHalf = (h) => Math.round(h * 2) / 2

// ECharts 通用封装
function Chart({ option, height = 320 }) {
  const containerRef = useRef(null)
  const instanceRef = useRef(null)
  useEffect(() => {
    if (!containerRef.current) return
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(containerRef.current)
    }
    instanceRef.current.setOption(option, true)
  }, [option])
  useEffect(() => {
    const handleResize = () => instanceRef.current && instanceRef.current.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (instanceRef.current) {
        instanceRef.current.dispose()
        instanceRef.current = null
      }
    }
  }, [])
  return <div ref={containerRef} style={{ width: '100%', height }} />
}

// 标准性能率（mock）
const STANDARD_PERFORMANCE = 0.88
// 目标效率
const TARGET_EFFICIENCY = 85

// 效率趋势 mock 数据（6月每日 OEE）
const trendDays = Array.from({ length: 30 }, (_, i) => `06-${String(i + 1).padStart(2, '0')}`)
const trendOee = [82, 85, 79, 88, 84, 86, 81, 83, 87, 89, 84, 82, 86, 80, 85, 88, 83, 84, 86, 87, 82, 85, 89, 86, 84, 83, 87, 85, 88, 86]

export default function EfficiencyReport() {
  const [range, setRange] = useState('本月')
  const [lineId, setLineId] = useState(undefined)

  // 按产线汇总效率数据
  const lineData = useMemo(() => {
    return productionLines.map(line => {
      const wos = workOrders.filter(w => w.line_id === line.line_id)
      const woIds = wos.map(w => w.work_order_id)
      const reports = processReports.filter(r => woIds.includes(r.work_order_id))
      const totalOutput = reports.reduce((s, r) => s + r.output_qty, 0)
      const totalInput = reports.reduce((s, r) => s + r.input_qty, 0)
      const manpowers = manpowerRecords.filter(m => woIds.includes(m.work_order_id))
      const workerCount = manpowers.reduce((s, r) => s + r.skilled_workers + r.general_workers + r.contract_workers + r.auxiliary_workers, 0)
      const exceptions = exceptionRecords.filter(e => woIds.includes(e.work_order_id))
      const faultHours = exceptions.reduce((s, e) => s + (e.duration || 0), 0)
      const totalHours = wos.reduce((s, w) => {
        if (!w.start_time) return s
        const start = dayjs(w.start_time)
        const end = w.finish_time ? dayjs(w.finish_time) : dayjs()
        return s + end.diff(start, 'hour', true)
      }, 0)
      const effectiveHours = Math.max(totalHours - faultHours, 0)
      const availability = totalHours > 0 ? effectiveHours / totalHours : 0
      const quality = totalInput > 0 ? totalOutput / totalInput : 0
      // 生产效率 = 可用率 × 性能率
      const efficiency = Math.round(availability * STANDARD_PERFORMANCE * 100)
      // OEE = 可用率 × 性能率 × 质量率
      const oee = Math.round(availability * STANDARD_PERFORMANCE * quality * 100)
      const perCapita = workerCount > 0 ? Math.round(totalOutput / workerCount) : 0
      return {
        ...line,
        woCount: wos.length,
        totalOutput,
        totalHours: roundHalf(totalHours),
        faultHours,
        workerCount,
        perCapita,
        efficiency,
        oee,
      }
    })
  }, [])

  const filtered = lineId ? lineData.filter(l => l.line_id === lineId) : lineData
  const activeLines = filtered.filter(l => l.woCount > 0)

  // 统计汇总
  const avgOee = activeLines.length > 0
    ? (activeLines.reduce((s, l) => s + l.oee, 0) / activeLines.length).toFixed(1)
    : '0.0'
  const avgEfficiency = activeLines.length > 0
    ? (activeLines.reduce((s, l) => s + l.efficiency, 0) / activeLines.length).toFixed(1)
    : '0.0'
  const totalHoursAll = filtered.reduce((s, l) => s + l.totalHours, 0)
  const totalFaultHours = filtered.reduce((s, l) => s + l.faultHours, 0)
  const faultRate = totalHoursAll > 0
    ? ((totalFaultHours / totalHoursAll) * 100).toFixed(2)
    : '0.00'
  const totalOutputAll = filtered.reduce((s, l) => s + l.totalOutput, 0)
  const totalWorkers = filtered.reduce((s, l) => s + l.workerCount, 0)
  const perCapita = totalWorkers > 0 ? Math.round(totalOutputAll / totalWorkers) : 0

  const stats = [
    { label: '平均OEE', value: `${avgOee}%`, icon: <ThunderboltOutlined />, color: '#9C27B0' },
    { label: '平均生产效率', value: `${avgEfficiency}%`, icon: <DashboardOutlined />, color: '#2196F3' },
    { label: '设备故障率', value: `${faultRate}%`, icon: <ToolOutlined />, color: '#FF9800' },
    { label: '人均产出', value: perCapita.toLocaleString(), icon: <TeamOutlined />, color: '#4CAF50' },
  ]

  // 柱状图：各产线效率对比（目标效率 vs 实际效率）
  const barOption = {
    title: { text: '各产线效率对比', left: 0, top: 0, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'axis', formatter: (p) => p.map(i => `${i.marker}${i.seriesName}: ${i.value}%`).join('<br/>') },
    legend: { top: 0, right: 0, data: ['目标效率', '实际效率'] },
    grid: { left: 45, right: 30, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: lineData.map(l => l.line_name), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '效率(%)', max: 100, axisLabel: { fontSize: 11 } },
    series: [
      {
        name: '目标效率',
        type: 'bar',
        barGap: 0,
        data: lineData.map(() => TARGET_EFFICIENCY),
        itemStyle: { color: '#B0BEC5', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '实际效率',
        type: 'bar',
        data: lineData.map(l => l.efficiency),
        itemStyle: { color: '#2196F3', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11 },
      },
    ],
  }

  // 折线图：效率趋势（每日 OEE）
  const lineOption = {
    title: { text: '效率趋势（本月每日 OEE）', left: 0, top: 0, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'axis', formatter: '{b}<br/>OEE: {c}%' },
    legend: { top: 0, right: 0, data: ['OEE'] },
    grid: { left: 45, right: 30, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: trendDays, boundaryGap: false, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: 'OEE(%)', min: 70, max: 100, axisLabel: { fontSize: 11 } },
    series: [
      {
        name: 'OEE',
        type: 'line',
        smooth: true,
        data: trendOee,
        itemStyle: { color: '#9C27B0' },
        areaStyle: { color: 'rgba(156,39,176,0.12)' },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ yAxis: TARGET_EFFICIENCY, name: '目标', lineStyle: { color: '#F44336', type: 'dashed' }, label: { formatter: '目标 85%', position: 'end' } }],
        },
      },
    ],
  }

  const columns = [
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 80, fixed: 'left' },
    { title: '工单数', dataIndex: 'woCount', key: 'woCount', width: 90 },
    { title: '总产出', dataIndex: 'totalOutput', key: 'totalOutput', width: 110, render: v => v > 0 ? v.toLocaleString() : '-' },
    { title: '总工时', key: 'totalHours', width: 100, render: (_, r) => r.totalHours > 0 ? `${r.totalHours.toFixed(1)}h` : '-' },
    { title: '人均产出', dataIndex: 'perCapita', key: 'perCapita', width: 110, render: v => v > 0 ? v.toLocaleString() : '-' },
    {
      title: '生产效率(%)', dataIndex: 'efficiency', key: 'efficiency', width: 160,
      render: v => v > 0
        ? <Progress percent={v} size="small" strokeColor={v >= 80 ? '#52c41a' : v >= 70 ? '#faad14' : '#ff4d4f'} format={p => `${p}%`} />
        : '-'
    },
    {
      title: 'OEE(%)', dataIndex: 'oee', key: 'oee', width: 160,
      render: v => v > 0
        ? <Progress percent={v} size="small" strokeColor={v >= 80 ? '#52c41a' : v >= 70 ? '#faad14' : '#ff4d4f'} format={p => `${p}%`} />
        : '-'
    },
  ]

  return (
    <ThreeSectionPage
      title="效率分析"
      breadcrumbs="报表中心 / 效率分析"
      stats={stats}
      actions={
        <>
          <Button icon={<ExportOutlined />}>导出</Button>
        </>
      }
      table={
        <div>
          <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Select
                style={{ width: '100%' }}
                value={range}
                onChange={setRange}
                options={[
                  { label: '本周', value: '本周' },
                  { label: '本月', value: '本月' },
                  { label: '本季度', value: '本季度' },
                ]}
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="产线选择"
                allowClear
                style={{ width: '100%' }}
                options={productionLines.map(l => ({ label: l.line_name, value: l.line_id }))}
                value={lineId}
                onChange={setLineId}
              />
            </Col>
            <Col>
              <Space>
                <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                <Button icon={<ReloadOutlined />} onClick={() => { setRange('本月'); setLineId(undefined) }}>重置</Button>
              </Space>
            </Col>
          </Row>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Chart option={barOption} height={300} />
          </div>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Chart option={lineOption} height={300} />
          </div>
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="line_id"
            size="small"
            scroll={{ x: 900 }}
            pagination={false}
          />
        </div>
      }
    />
  )
}
