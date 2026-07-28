import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Table, Button, Select, Space, Row, Col, Progress, Spin, message } from 'antd'
import {
  ThunderboltOutlined, DashboardOutlined, ToolOutlined, TeamOutlined,
  ExportOutlined, ReloadOutlined, SearchOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { processReports as mockProcessReports } from '../../mock/data'

// 工单状态映射：0=开工, 1=完工, 2=关闭
const woStatusNumToText: Record<number, string> = { 0: '开工', 1: '完工', 2: '关闭' }

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
  const [lineId, setLineId] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [productionLines, setProductionLines] = useState<any[]>([])
  const [manpowerRecords, setManpowerRecords] = useState<any[]>([])
  const [exceptionRecords, setExceptionRecords] = useState<any[]>([])
  const [processDefects, setProcessDefects] = useState<any[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const [woRes, lineRes, mpRes, excRes, defectRes] = await Promise.all([
        api.get('/production/report-orders', { params: { pageSize: 100 } }),
        api.get('/basic/production-lines'),
        api.get('/production/manpower-records', { params: { pageSize: 200 } }),
        api.get('/production/process-exceptions', { params: { pageSize: 200 } }),
        api.get('/production/process-defects', { params: { pageSize: 500 } }),
      ])
      if (woRes.success && woRes.data) {
        setWorkOrders(woRes.data.map((item: any) => ({
          work_order_id: item.report_order_id,
          work_order_no: item.report_no,
          order_id: item.order_id,
          order_no: item.order_no,
          line_id: item.line_id,
          line_name: item.line_name,
          material_id: item.material_id,
          material_name: item.material_name,
          target_qty: item.report_qty || 0,
          start_time: item.report_time,
          finish_time: item.finish_time,
          status: woStatusNumToText[item.status] ?? '开工',
          created_by: item.report_user_id,
          created_at: item.report_time,
        })))
      }
      if (lineRes.success && lineRes.data) setProductionLines(lineRes.data)
      if (mpRes.success && mpRes.data) {
        setManpowerRecords(mpRes.data.map((m: any) => ({
          ...m,
          work_order_id: m.report_order_id,
          skilled_workers: m.skilled_count || 0,
          general_workers: m.general_count || 0,
          contract_workers: m.labor_count || 0,
          auxiliary_workers: m.other_count || 0,
        })))
      }
      if (excRes.success && excRes.data) {
        setExceptionRecords(excRes.data.map((e: any) => ({
          ...e,
          work_order_id: e.report_order_id,
          work_order_no: e.report_order_no || '',
        })))
      }
      if (defectRes.success && defectRes.data) setProcessDefects(defectRes.data)
    } catch (err: any) {
      message.error(err.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 将工序不良记录转换为报表所需的 processReports 格式
  const processReports = useMemo(() => {
    if (processDefects.length === 0) return mockProcessReports
    const grouped: Record<string, any> = {}
    processDefects.forEach((d: any) => {
      const key = `${d.report_order_id}_${d.process_id}`
      if (!grouped[key]) {
        grouped[key] = {
          report_id: `rp_${d.report_order_id}_${d.process_id}`,
          work_order_id: d.report_order_id,
          work_order_no: d.report_order_no || '',
          process_id: d.process_id,
          process_name: d.process_name || '',
          input_qty: 0,
          defect_material: 0,
          defect_process: 0,
          defect_scrap: 0,
          output_qty: 0,
          device_id: d.device_id,
          device_name: d.device_name || '-',
          report_user: d.report_user,
          report_user_name: d.report_user_name || '',
          report_time: d.created_at || new Date().toISOString(),
        }
      }
      const defectType = d.defect_type?.defect_type || d.category_name || ''
      const qty = Number(d.quantity) || 0
      if (defectType === '来料不良') {
        grouped[key].defect_material += qty
      } else if (defectType === '制程不良') {
        grouped[key].defect_process += qty
      } else if (defectType === '检验报废') {
        grouped[key].defect_scrap += qty
      } else {
        grouped[key].defect_process += qty
      }
    })
    return Object.values(grouped)
  }, [processDefects])

  // 按产线汇总效率数据
  const lineData = useMemo(() => {
    return productionLines.map(line => {
      const wos = workOrders.filter((w: any) => w.line_id === line.line_id)
      const woIds = wos.map((w: any) => w.work_order_id)
      const reports = processReports.filter((r: any) => woIds.includes(r.work_order_id))
      const totalDefect = reports.reduce((s: number, r: any) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
      const totalOutput = wos.reduce((s: number, w: any) => s + (Number(w.target_qty) || 0), 0)
      const totalInput = totalOutput + totalDefect
      const manpowers = manpowerRecords.filter((m: any) => woIds.includes(m.work_order_id))
      const workerCount = manpowers.reduce((s: number, r: any) => s + (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0), 0)
      const exceptions = exceptionRecords.filter((e: any) => woIds.includes(e.work_order_id))
      const faultHours = exceptions.reduce((s: number, e: any) => s + (Number(e.duration) || 0), 0)
      const totalHours = wos.reduce((s: number, w: any) => {
        if (!w.start_time) return s
        const start = dayjs(w.start_time)
        const end = w.finish_time ? dayjs(w.finish_time) : dayjs()
        return s + end.diff(start, 'hour', true)
      }, 0)
      const effectiveHours = Math.max(totalHours - faultHours, 0)
      const availability = totalHours > 0 ? effectiveHours / totalHours : 0
      const quality = totalInput > 0 ? totalOutput / totalInput : 0
      const efficiency = Math.round(availability * STANDARD_PERFORMANCE * 100)
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
  }, [workOrders, productionLines, processReports, manpowerRecords, exceptionRecords])

  const filtered = lineId ? lineData.filter((l: any) => l.line_id === lineId) : lineData
  const activeLines = filtered.filter((l: any) => l.woCount > 0)

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

  const targetData = trendDays.map(() => TARGET_EFFICIENCY)

  const lineOption = {
    title: { text: '效率趋势（本月每日 OEE）', left: 0, top: 0, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'axis', formatter: (p) => p.map(i => `${i.marker}${i.seriesName}: ${i.value}%`).join('<br/>') },
    legend: { top: 0, right: 0, data: ['OEE', '目标效率'] },
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
      },
      {
        name: '目标效率',
        type: 'line',
        smooth: false,
        symbol: 'none',
        data: targetData,
        lineStyle: { color: '#F44336', type: 'dashed', width: 2 },
        itemStyle: { color: '#F44336' },
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
        <Spin spinning={loading} tip="加载中...">
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
                  <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setRange('本月'); setLineId(undefined); loadData() }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Chart option={barOption} height={300} />
            </div>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Chart option={lineOption} height={300} />
            </div>
            <ResizableTable tableKey="pages_report_EfficiencyReport"             columns={columns}
              dataSource={filtered}
              rowKey="line_id"
              size="small"
              scroll={{ x: 900 }}
              pagination={false}
            />
          </div>
        </Spin>
      }
    />
  )
}
