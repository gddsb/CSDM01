import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Table, Tag, Button, DatePicker, Select, Space, Row, Col, Progress } from 'antd'
import {
  FileTextOutlined, RiseOutlined, CheckCircleOutlined, WarningOutlined,
  FallOutlined, ExportOutlined, ReloadOutlined, SearchOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { workOrders, processReports, productionLines } from '../../mock/data'

const statusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '关闭': 'warning',
  '完工': 'success',
}

// 各时段产出趋势 mock 数据（08:00 - 20:00）
const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
const hourlyOutput = [820, 932, 901, 934, 1290, 1180, 1320, 1100, 980, 850, 760, 680, 520]
const hourlyDefect = [12, 15, 10, 18, 22, 14, 16, 9, 11, 8, 7, 6, 5]

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

export default function DailyReport() {
  const [date, setDate] = useState(dayjs())
  const [lineId, setLineId] = useState(undefined)

  // 按工单汇总生产数据
  const reportData = useMemo(() => {
    return workOrders.map(wo => {
      const reports = processReports.filter(r => r.work_order_id === wo.work_order_id)
      const totalInput = reports.reduce((s, r) => s + r.input_qty, 0)
      const totalOutput = reports.reduce((s, r) => s + r.output_qty, 0)
      const totalDefect = reports.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
      const yieldRate = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(1) : '0.0'
      return {
        ...wo,
        total_input: totalInput,
        total_output: totalOutput,
        total_defect: totalDefect,
        yield_rate: parseFloat(yieldRate),
      }
    })
  }, [])

  const filtered = reportData.filter(r => !lineId || r.line_id === lineId)

  // 统计汇总
  const todayOrders = filtered.length
  const totalOutput = filtered.reduce((s, r) => s + r.total_output, 0)
  const totalInput = filtered.reduce((s, r) => s + r.total_input, 0)
  const totalDefect = filtered.reduce((s, r) => s + r.total_defect, 0)
  const avgYield = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(1) : '0.0'

  const stats = [
    { label: '今日工单数', value: todayOrders, icon: <FileTextOutlined />, color: '#2196F3' },
    { label: '今日产出总量', value: totalOutput.toLocaleString(), icon: <RiseOutlined />, color: '#4CAF50' },
    { label: '今日投入总量', value: totalInput.toLocaleString(), icon: <CheckCircleOutlined />, color: '#00BCD4' },
    { label: '今日不良数', value: totalDefect.toLocaleString(), icon: <WarningOutlined />, color: '#FF9800' },
    { label: '良率', value: `${avgYield}%`, icon: <FallOutlined />, color: '#9C27B0' },
  ]

  // 各时段产出趋势 折线图
  const lineOption = {
    title: { text: '各时段产出趋势', left: 0, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['产出数量', '不良数'], top: 0, right: 0 },
    grid: { left: 50, right: 50, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: hours, boundaryGap: false, axisLabel: { fontSize: 11 } },
    yAxis: [
      { type: 'value', name: '产出', axisLabel: { fontSize: 11 } },
      { type: 'value', name: '不良', axisLabel: { fontSize: 11 } },
    ],
    series: [
      {
        name: '产出数量',
        type: 'line',
        smooth: true,
        data: hourlyOutput,
        itemStyle: { color: '#2196F3' },
        areaStyle: { color: 'rgba(33,150,243,0.15)' },
      },
      {
        name: '不良数',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: hourlyDefect,
        itemStyle: { color: '#FF9800' },
      },
    ],
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 160, fixed: 'left' },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 130 },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 70 },
    { title: '目标数量', dataIndex: 'target_qty', key: 'target_qty', width: 100, render: v => v.toLocaleString() },
    { title: '产出数量', dataIndex: 'total_output', key: 'total_output', width: 100, render: v => v.toLocaleString() },
    { title: '不良数', dataIndex: 'total_defect', key: 'total_defect', width: 90, render: v => v > 0 ? <span style={{ color: '#F44336' }}>{v}</span> : '-' },
    {
      title: '良率(%)', dataIndex: 'yield_rate', key: 'yield_rate', width: 140,
      render: v => <Progress percent={v} size="small" strokeColor={v >= 95 ? '#52c41a' : v >= 90 ? '#faad14' : '#ff4d4f'} format={p => `${p}%`} />
    },
    { title: '工单状态', dataIndex: 'status', key: 'status', width: 90, render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
  ]

  return (
    <ThreeSectionPage
      title="生产日报"
      breadcrumbs="报表中心 / 生产日报"
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
              <DatePicker
                style={{ width: '100%' }}
                value={date}
                onChange={v => setDate(v)}
                allowClear={false}
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
                <Button icon={<ReloadOutlined />} onClick={() => { setLineId(undefined); setDate(dayjs()) }}>重置</Button>
              </Space>
            </Col>
          </Row>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Chart option={lineOption} height={300} />
          </div>
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="work_order_id"
            size="small"
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        </div>
      }
    />
  )
}
