import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Select, Input, Space, Row, Col, Progress, DatePicker, Card } from 'antd'
import {
  BellOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  ClockCircleOutlined, WarningOutlined, ToolOutlined,
  FallOutlined
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { exceptionRecords, workOrders } from '../../mock/data'

const { RangePicker } = DatePicker

// 异常类型映射（与数据字典 prod_exception_type 保持一致）
const exceptionTypeMap = {
  '换型换线': { name: '换型换线', color: '#1890ff' },
  '停机待料': { name: '停机待料', color: '#faad14' },
  '故障维修': { name: '故障维修', color: '#ff4d4f' },
  '其它停机': { name: '其它停机', color: '#8c8c8c' },
}

export default function ExceptionReport() {
  const [typeFilter, setTypeFilter] = useState(undefined)
  const [search, setSearch] = useState('')

  const filtered = exceptionRecords.filter(r => {
    const matchType = !typeFilter || r.exception_type === typeFilter
    const matchSearch = !search || r.work_order_no.toLowerCase().includes(search.toLowerCase()) || (r.device_name && r.device_name.includes(search))
    return matchType && matchSearch
  })

  // 统计汇总
  const totalExceptions = filtered.length
  const totalDuration = filtered.reduce((s, r) => s + r.duration, 0)
  const avgDuration = totalExceptions > 0 ? (totalDuration / totalExceptions).toFixed(0) : '0'

  // 按异常类型汇总
  const typeSummary = useMemo(() => {
    return Object.entries(exceptionTypeMap).map(([code, info]) => {
      const items = exceptionRecords.filter(r => r.exception_type === code)
      const totalDur = items.reduce((s, r) => s + r.duration, 0)
      const avgDur = items.length > 0 ? (totalDur / items.length).toFixed(0) : '0'
      return {
        exception_type: code,
        exception_type_name: info.name,
        color: info.color,
        count: items.length,
        total_duration: totalDur,
        avg_duration: avgDur,
        percentage: totalExceptions > 0 ? ((items.length / totalExceptions) * 100).toFixed(1) : '0.0',
      }
    }).filter(t => t.count > 0)
  }, [exceptionRecords, totalExceptions])

  // 按工单汇总
  const workOrderSummary = useMemo(() => {
    return workOrders.map(wo => {
      const exceptions = exceptionRecords.filter(r => r.work_order_id === wo.work_order_id)
      const totalDur = exceptions.reduce((s, r) => s + r.duration, 0)
      const types = [...new Set(exceptions.map(r => r.exception_type))]
      return {
        work_order_no: wo.work_order_no,
        line_name: wo.line_name,
        material_name: wo.material_name,
        exception_count: exceptions.length,
        total_duration: totalDur,
        exception_types: types,
        status: wo.status,
      }
    }).filter(w => w.exception_count > 0)
  }, [])

  const stats = [
    { label: '异常总数', value: totalExceptions, icon: <BellOutlined />, color: '#F44336' },
    { label: '总异常时长', value: `${totalDuration}分钟`, icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '平均异常时长', value: `${avgDuration}分钟`, icon: <FallOutlined />, color: '#2196F3' },
    { label: '异常类型数', value: typeSummary.length, icon: <WarningOutlined />, color: '#9C27B0' },
    { label: '受影响工单', value: workOrderSummary.length, icon: <ToolOutlined />, color: '#00BCD4' },
  ]

  // 异常明细列表列
  const detailColumns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150, fixed: 'left' },
    { title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', width: 100, render: v => {
      const info = exceptionTypeMap[v] || { name: v, color: '#8c8c8c' }
      return <Tag color={info.color}>{v} {info.name}</Tag>
    }},
    { title: '异常名称', dataIndex: 'exception_type_name', key: 'exception_type_name', width: 100 },
    { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 130, render: v => v || '-' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150 },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 150 },
    {
      title: '持续时长', dataIndex: 'duration', key: 'duration', width: 100,
      render: v => {
        const hours = Math.floor(v / 60)
        const mins = v % 60
        const color = v >= 60 ? '#F44336' : v >= 30 ? '#FF9800' : '#4CAF50'
        return <span style={{ color, fontWeight: 600 }}>{hours > 0 ? `${hours}小时` : ''}{mins}分钟</span>
      }
    },
    { title: '异常原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '记录人', dataIndex: 'record_user_name', key: 'record_user_name', width: 90 },
  ]

  // 按类型汇总列
  const summaryColumns = [
    { title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', width: 100, render: v => {
      const info = exceptionTypeMap[v] || { name: v, color: '#8c8c8c' }
      return <Tag color={info.color}>{v}</Tag>
    }},
    { title: '异常名称', dataIndex: 'exception_type_name', key: 'exception_type_name', width: 120 },
    { title: '发生次数', dataIndex: 'count', key: 'count', width: 100, render: v => <strong style={{ fontSize: 16 }}>{v}</strong> },
    { title: '总时长(分钟)', dataIndex: 'total_duration', key: 'total_duration', width: 120, render: v => v },
    { title: '平均时长(分钟)', dataIndex: 'avg_duration', key: 'avg_duration', width: 120, render: v => v },
    {
      title: '占比', dataIndex: 'percentage', key: 'percentage', width: 150,
      render: v => <Progress percent={parseFloat(v)} size="small" format={p => `${p}%`} />
    },
  ]

  // 按工单汇总列
  const woColumns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 70 },
    { title: '产品名称', dataIndex: 'material_name', key: 'material_name', width: 120 },
    { title: '异常次数', dataIndex: 'exception_count', key: 'exception_count', width: 100, render: v => <strong style={{ color: v > 2 ? '#F44336' : '#FF9800' }}>{v}</strong> },
    { title: '异常总时长(分钟)', dataIndex: 'total_duration', key: 'total_duration', width: 140, render: v => v },
    { title: '异常类型', dataIndex: 'exception_types', key: 'exception_types', render: types => types.map((t, i) => <Tag key={i} style={{ marginBottom: 2 }}>{t}</Tag>) },
    { title: '工单状态', dataIndex: 'status', key: 'status', width: 90, render: v => <Tag>{v}</Tag> },
  ]

  return (
    <ThreeSectionPage
      title="异常分析报表"
      breadcrumbs="报表中心 / 异常分析报表"
      stats={stats}
      actions={<Button icon={<ExportOutlined />}>导出Excel</Button>}
      table={
        <div>
          {/* 按异常类型汇总卡片 */}
          <Row gutter={12} style={{ marginBottom: 12 }}>
            {typeSummary.map((ts, i) => (
              <Col key={i} span={Math.floor(24 / typeSummary.length) || 6}>
                <Card size="small" style={{ borderRadius: 8, borderLeft: `3px solid ${ts.color}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ts.exception_type} {ts.exception_type_name}
                  </div>
                  <Row gutter={4} style={{ marginTop: 8 }}>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>次数</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: ts.color }}>{ts.count}</div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>总时长</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{ts.total_duration}'</div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>占比</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{ts.percentage}%</div>
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
            <Col span={8}>
              <Input
                placeholder="搜索工单号/设备名称"
                allowClear
                prefix={<SearchOutlined />}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="异常类型筛选"
                allowClear
                style={{ width: '100%' }}
                value={typeFilter}
                onChange={setTypeFilter}
                options={Object.entries(exceptionTypeMap).map(([code, info]) => ({
                  label: `${code} ${info.name}`,
                  value: code,
                }))}
              />
            </Col>
            <Col span={6}>
              <RangePicker style={{ width: '100%' }} />
            </Col>
            <Col>
              <Space>
                <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setTypeFilter(undefined) }}>重置</Button>
              </Space>
            </Col>
          </Row>

          {/* 异常明细列表 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>异常明细</div>
            <Table
              columns={detailColumns}
              dataSource={filtered}
              rowKey="record_id"
              size="small"
              scroll={{ x: 1200 }}
              pagination={{ pageSize: 30, showTotal: t => `共 ${t} 条` }}
            />
          </div>

          {/* 按类型汇总表 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>按异常类型汇总</div>
            <Table
              columns={summaryColumns}
              dataSource={typeSummary}
              rowKey="exception_type"
              size="small"
              pagination={false}
            />
          </div>

          {/* 按工单汇总表 */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>按工单汇总</div>
            <Table
              columns={woColumns}
              dataSource={workOrderSummary}
              rowKey="work_order_no"
              size="small"
              pagination={{ pageSize: 30, showTotal: t => `共 ${t} 条` }}
            />
          </div>
        </div>
      }
    />
  )
}
