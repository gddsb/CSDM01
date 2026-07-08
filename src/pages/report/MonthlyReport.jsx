import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Table, Button, DatePicker, Select, Space, Row, Col, Progress } from 'antd'
import {
  AuditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PercentageOutlined, ExportOutlined, ReloadOutlined, SearchOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import {
  incomingInspections, finishedInspections, microbeInspections, envInspections
} from '../../mock/data'

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

export default function MonthlyReport() {
  const [month, setMonth] = useState(dayjs())
  const [category, setCategory] = useState(undefined)

  // 汇总所有检验数据，标注检验类别
  const allInspections = useMemo(() => {
    return [
      ...incomingInspections.map(i => ({ ...i, category: '来料检验' })),
      ...finishedInspections.map(i => ({ ...i, category: '成品检验' })),
      ...microbeInspections.map(i => ({ ...i, category: '微生物检验' })),
      ...envInspections.map(i => ({ ...i, category: '环境检验' })),
    ]
  }, [])

  const filtered = allInspections.filter(i => !category || i.category === category)

  const totalCount = filtered.length
  const passCount = filtered.filter(i => i.result === '合格').length
  const failCount = filtered.filter(i => i.result === '不合格').length
  // 让步接收：不合格但经评估让步接收入库（处理方式为让步接收）
  const concessionCount = filtered.filter(i => i.handle_type === '让步接收').length
  const passRate = (passCount + failCount) > 0
    ? ((passCount / (passCount + failCount)) * 100).toFixed(1)
    : '0.0'

  const stats = [
    { label: '本月检验批次', value: totalCount, icon: <AuditOutlined />, color: '#2196F3' },
    { label: '合格批次', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格批次', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '合格率', value: `${passRate}%`, icon: <PercentageOutlined />, color: '#9C27B0' },
  ]

  // 饼图：检验结果分布
  const pieOption = {
    title: { text: '检验结果分布', left: 0, top: 0, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      name: '检验结果分布',
      type: 'pie',
      radius: ['38%', '68%'],
      center: ['50%', '52%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
      data: [
        { value: passCount, name: '合格', itemStyle: { color: '#4CAF50' } },
        { value: failCount, name: '不合格', itemStyle: { color: '#F44336' } },
        { value: concessionCount, name: '让步接收', itemStyle: { color: '#FF9800' } },
      ],
    }],
  }

  // 柱状图：各检验类别合格率对比
  const categories = ['来料检验', '成品检验', '微生物检验', '环境检验']
  const categoryRates = categories.map(cat => {
    const items = allInspections.filter(i => i.category === cat)
    const completed = items.filter(i => i.result === '合格' || i.result === '不合格')
    const pass = completed.filter(i => i.result === '合格').length
    return completed.length > 0 ? Math.round((pass / completed.length) * 100) : 0
  })

  const barOption = {
    title: { text: '各检验类别合格率对比', left: 0, top: 0, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'axis', formatter: '{b}<br/>合格率: {c}%' },
    legend: { top: 0, right: 0, data: ['合格率'] },
    grid: { left: 45, right: 30, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '合格率(%)', max: 100, axisLabel: { fontSize: 11 } },
    series: [{
      name: '合格率',
      type: 'bar',
      data: categoryRates,
      barWidth: '45%',
      itemStyle: { color: '#2196F3', borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11 },
    }],
  }

  // 表格数据：各检验类别汇总
  const tableData = categories.map(cat => {
    const items = allInspections.filter(i => i.category === cat)
    const pass = items.filter(i => i.result === '合格').length
    const fail = items.filter(i => i.result === '不合格').length
    const completed = pass + fail
    const rate = completed > 0 ? ((pass / completed) * 100).toFixed(1) : '0.0'
    return { key: cat, category: cat, total: items.length, pass, fail, rate: parseFloat(rate) }
  })

  const columns = [
    { title: '检验类别', dataIndex: 'category', key: 'category', width: 160 },
    { title: '检验批次', dataIndex: 'total', key: 'total', width: 110 },
    { title: '合格数', dataIndex: 'pass', key: 'pass', width: 110, render: v => <span style={{ color: '#4CAF50' }}>{v}</span> },
    { title: '不合格数', dataIndex: 'fail', key: 'fail', width: 110, render: v => v > 0 ? <span style={{ color: '#F44336' }}>{v}</span> : '-' },
    {
      title: '合格率(%)', dataIndex: 'rate', key: 'rate', width: 200,
      render: v => <Progress percent={v} size="small" strokeColor={v >= 95 ? '#52c41a' : v >= 85 ? '#faad14' : '#ff4d4f'} format={p => `${p}%`} />
    },
  ]

  return (
    <ThreeSectionPage
      title="质量月报"
      breadcrumbs="报表中心 / 质量月报"
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
                picker="month"
                style={{ width: '100%' }}
                value={month}
                onChange={v => setMonth(v)}
                allowClear={false}
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="检验类别"
                allowClear
                style={{ width: '100%' }}
                options={categories.map(c => ({ label: c, value: c }))}
                value={category}
                onChange={setCategory}
              />
            </Col>
            <Col>
              <Space>
                <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                <Button icon={<ReloadOutlined />} onClick={() => { setCategory(undefined); setMonth(dayjs()) }}>重置</Button>
              </Space>
            </Col>
          </Row>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={10}>
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
                <Chart option={pieOption} height={300} />
              </div>
            </Col>
            <Col span={14}>
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
                <Chart option={barOption} height={300} />
              </div>
            </Col>
          </Row>
          <Table
            columns={columns}
            dataSource={tableData}
            rowKey="key"
            size="small"
            pagination={false}
          />
        </div>
      }
    />
  )
}
