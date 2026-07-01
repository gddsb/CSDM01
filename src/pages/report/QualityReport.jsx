import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Select, Input, Space, Row, Col, Progress, DatePicker, Card } from 'antd'
import {
  ExperimentOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SafetyCertificateOutlined,
  RiseOutlined
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import {
  incomingInspections, finishedInspections, microbeInspections,
  envInspections, complaints
} from '../../mock/data'

const { RangePicker } = DatePicker

const resultColorMap = {
  '合格': 'success',
  '不合格': 'error',
  null: 'default',
}

export default function QualityReport() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState(undefined)
  const [search, setSearch] = useState('')

  // 汇总所有检验数据
  const allInspections = useMemo(() => {
    const incoming = incomingInspections.map(i => ({
      ...i,
      inspection_category: '来料检验',
      batch_no: i.internal_batch_no,
      target: i.supplier_name,
      qty: i.quantity,
    }))
    const finished = finishedInspections.map(i => ({
      ...i,
      inspection_category: '成品检验',
      batch_no: i.work_order_no,
      target: i.work_order_no,
      qty: null,
    }))
    const microbe = microbeInspections.map(i => ({
      ...i,
      inspection_category: '微生物检验',
      batch_no: i.work_order_no || i.incoming_id,
      target: i.object_type,
      qty: null,
    }))
    const env = envInspections.map(i => ({
      ...i,
      inspection_category: '环境检验',
      batch_no: i.inspection_no,
      target: i.area_name,
      qty: null,
    }))
    return [...incoming, ...finished, ...microbe, ...env]
  }, [])

  const filtered = allInspections.filter(r => {
    const matchType = typeFilter === 'all' || r.inspection_category === typeFilter
    const matchResult = !resultFilter || r.result === resultFilter
    const matchSearch = !search || (r.inspection_no && r.inspection_no.toLowerCase().includes(search.toLowerCase()))
    return matchType && matchResult && matchSearch
  })

  // 统计
  const totalInspections = filtered.length
  const passCount = filtered.filter(r => r.result === '合格').length
  const failCount = filtered.filter(r => r.result === '不合格').length
  const pendingCount = filtered.filter(r => r.result === null).length
  const passRate = totalInspections > 0 ? ((passCount / (passCount + failCount || 1)) * 100).toFixed(1) : '0.0'
  const complaintCount = complaints.length

  const stats = [
    { label: '检验总数', value: totalInspections, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '合格数', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格数', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '检验中', value: pendingCount, icon: <SafetyCertificateOutlined />, color: '#FF9800' },
    { label: '合格率', value: `${passRate}%`, icon: <RiseOutlined />, color: '#9C27B0' },
    { label: '客诉数', value: complaintCount, icon: <CloseCircleOutlined />, color: '#E91E63' },
  ]

  // 按检验类别汇总
  const categorySummary = useMemo(() => {
    const categories = ['来料检验', '成品检验', '微生物检验', '环境检验']
    return categories.map(cat => {
      const items = allInspections.filter(i => i.inspection_category === cat)
      const pass = items.filter(i => i.result === '合格').length
      const fail = items.filter(i => i.result === '不合格').length
      const pending = items.filter(i => i.result === null).length
      const rate = (pass + fail) > 0 ? ((pass / (pass + fail)) * 100).toFixed(1) : '-'
      return { category: cat, total: items.length, pass, fail, pending, pass_rate: rate }
    })
  }, [allInspections])

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 160, fixed: 'left' },
    { title: '检验类别', dataIndex: 'inspection_category', key: 'inspection_category', width: 100, render: v => <Tag color="blue">{v}</Tag> },
    { title: '检验对象', dataIndex: 'target', key: 'target', width: 140 },
    { title: '批次/工单号', dataIndex: 'batch_no', key: 'batch_no', width: 160 },
    { title: '物料名称', dataIndex: 'material_name', key: 'material_name', width: 120, render: v => v || '-' },
    { title: '标准名称', dataIndex: 'standard_name', key: 'standard_name', width: 180, render: v => v || '-' },
    { title: '数量', dataIndex: 'qty', key: 'qty', width: 80, render: v => v ? v.toLocaleString() : '-' },
    { title: '检验结果', dataIndex: 'result', key: 'result', width: 90, render: v => v ? <Tag color={resultColorMap[v]}>{v}</Tag> : <Tag>检验中</Tag> },
    { title: '处理方式', dataIndex: 'handle_type', key: 'handle_type', width: 90, render: v => v || '-' },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 90 },
    { title: '检验时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160, render: v => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: v => <Tag color={v === '已完成' ? 'success' : 'processing'}>{v}</Tag> },
  ]

  return (
    <ThreeSectionPage
      title="质量报表"
      breadcrumbs="报表中心 / 质量报表"
      stats={stats}
      actions={<Button icon={<ExportOutlined />}>导出Excel</Button>}
      table={
        <div>
          {/* 按类别汇总 */}
          <Row gutter={12} style={{ marginBottom: 12 }}>
            {categorySummary.map((cs, i) => (
              <Col key={i} span={6}>
                <Card size="small" style={{ borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{cs.category}</div>
                  <Row gutter={8}>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>总数</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{cs.total}</div>
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: '#4CAF50' }}>合格</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#4CAF50' }}>{cs.pass}</div>
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: '#F44336' }}>不合格</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#F44336' }}>{cs.fail}</div>
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>合格率</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{cs.pass_rate === '-' ? '-' : `${cs.pass_rate}%`}</div>
                    </Col>
                  </Row>
                  {cs.pass_rate !== '-' && (
                    <Progress
                      percent={parseFloat(cs.pass_rate)}
                      size="small"
                      strokeColor={parseFloat(cs.pass_rate) >= 95 ? '#52c41a' : parseFloat(cs.pass_rate) >= 85 ? '#faad14' : '#ff4d4f'}
                      style={{ marginTop: 8, marginBottom: 0 }}
                    />
                  )}
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Input
                placeholder="搜索检验编号"
                allowClear
                prefix={<SearchOutlined />}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </Col>
            <Col span={5}>
              <Select
                placeholder="检验类别"
                allowClear
                style={{ width: '100%' }}
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '来料检验', value: '来料检验' },
                  { label: '成品检验', value: '成品检验' },
                  { label: '微生物检验', value: '微生物检验' },
                  { label: '环境检验', value: '环境检验' },
                ]}
              />
            </Col>
            <Col span={5}>
              <Select
                placeholder="检验结果"
                allowClear
                style={{ width: '100%' }}
                value={resultFilter}
                onChange={setResultFilter}
                options={[
                  { label: '合格', value: '合格' },
                  { label: '不合格', value: '不合格' },
                ]}
              />
            </Col>
            <Col span={6}>
              <RangePicker style={{ width: '100%' }} />
            </Col>
            <Col>
              <Space>
                <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setTypeFilter('all'); setResultFilter(undefined) }}>重置</Button>
              </Space>
            </Col>
          </Row>
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey={(r) => r.inspection_id}
            size="small"
            scroll={{ x: 1600 }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        </div>
      }
    />
  )
}
