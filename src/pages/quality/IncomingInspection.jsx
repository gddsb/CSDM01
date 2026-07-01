import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Typography } from 'antd'
import {
  ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, EyeOutlined, SearchOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { incomingInspections } from '../../mock/data'

const { Text, Title } = Typography

// 检验结果明细 mock 数据（按检验id分组）
const inspectionDetailMap = {
  ic1: [
    { item_name: '表面划伤', standard_value: '无明显划伤', actual_value: '合格，无明显划伤', judge: '合格' },
    { item_name: '板材厚度', standard_value: '0.23±0.01mm', actual_value: '0.231mm', judge: '合格' },
    { item_name: '镀锡量', standard_value: '≥2.8 g/m²', actual_value: '3.1 g/m²', judge: '合格' },
    { item_name: '板材宽度', standard_value: '800±1.0mm', actual_value: '800.2mm', judge: '合格' },
  ],
  ic2: [
    { item_name: '表面划伤', standard_value: '无明显划伤', actual_value: '多处划伤超标', judge: '不合格' },
    { item_name: '板材厚度', standard_value: '0.23±0.01mm', actual_value: '0.230mm', judge: '合格' },
    { item_name: '镀锡量', standard_value: '≥2.8 g/m²', actual_value: '2.9 g/m²', judge: '合格' },
    { item_name: '板材宽度', standard_value: '800±1.0mm', actual_value: '800.1mm', judge: '合格' },
  ],
  ic3: [
    { item_name: '表面划伤', standard_value: '无明显划伤', actual_value: '-', judge: '待检' },
    { item_name: '板材厚度', standard_value: '0.23±0.01mm', actual_value: '-', judge: '待检' },
    { item_name: '镀锡量', standard_value: '≥2.8 g/m²', actual_value: '-', judge: '待检' },
  ],
}

const resultColor = { '合格': 'success', '不合格': 'error' }
const handleColor = { '入库': 'green', '退货': 'red', '让步接收': 'orange' }
const statusColor = { '已完成': 'success', '检验中': 'processing' }

export default function IncomingInspection() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState(null)

  const passCount = incomingInspections.filter(i => i.result === '合格').length
  const failCount = incomingInspections.filter(i => i.result === '不合格').length
  const pendingCount = incomingInspections.filter(i => i.status === '检验中').length

  const stats = [
    { label: '总检验数', value: incomingInspections.length, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '合格', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '检验中', value: pendingCount, icon: <ClockCircleOutlined />, color: '#FF9800' },
  ]

  const filters = [
    { type: 'input', placeholder: '检验编号', icon: <SearchOutlined /> },
    { type: 'input', placeholder: '供应商名称' },
    {
      type: 'select', placeholder: '检验结果', options: [
        { label: '合格', value: '合格' },
        { label: '不合格', value: '不合格' },
      ]
    },
    {
      type: 'select', placeholder: '状态', options: [
        { label: '已完成', value: '已完成' },
        { label: '检验中', value: '检验中' },
      ]
    },
  ]

  const showDetail = (record) => {
    setCurrent(record)
    setDrawerOpen(true)
  }

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 150, fixed: 'left' },
    { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name', width: 110 },
    { title: '物料名称', dataIndex: 'material_name', key: 'material_name', width: 120 },
    { title: '供应商批号', dataIndex: 'supplier_batch_no', key: 'supplier_batch_no', width: 130 },
    { title: '内部批号', dataIndex: 'internal_batch_no', key: 'internal_batch_no', width: 150 },
    {
      title: '到货数量', dataIndex: 'quantity', key: 'quantity', width: 100,
      render: v => v ? v.toLocaleString() : '-'
    },
    { title: '到货日期', dataIndex: 'arrival_date', key: 'arrival_date', width: 110 },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: v => v ? <Tag color={resultColor[v]}>{v}</Tag> : <Tag>待检</Tag>
    },
    {
      title: '处理方式', dataIndex: 'handle_type', key: 'handle_type', width: 100,
      render: v => v ? <Tag color={handleColor[v] || 'default'}>{v}</Tag> : <Text type="secondary">-</Text>
    },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 100 },
    { title: '检验时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160, render: v => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => showDetail(record)}>查看详情</Button>
      )
    },
  ]

  const detailColumns = [
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name' },
    { title: '标准值', dataIndex: 'standard_value', key: 'standard_value' },
    { title: '实测值', dataIndex: 'actual_value', key: 'actual_value' },
    {
      title: '判定', dataIndex: 'judge', key: 'judge', width: 90,
      render: v => <Tag color={v === '合格' ? 'success' : v === '不合格' ? 'error' : 'default'}>{v}</Tag>
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="来料检验"
        breadcrumbs="质量管理 / 来料检验"
        stats={stats}
        filters={filters}
        actions={<ActionButtons />}
        table={
          <Table
            columns={columns}
            dataSource={incomingInspections}
            rowKey="inspection_id"
            size="small"
            scroll={{ x: 1500 }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Drawer
        title="来料检验详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={820}
        destroyOnClose
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检验编号">{current.inspection_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[current.status] || 'default'}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="供应商">{current.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="物料名称">{current.material_name}</Descriptions.Item>
              <Descriptions.Item label="供应商批号">{current.supplier_batch_no}</Descriptions.Item>
              <Descriptions.Item label="内部批号">{current.internal_batch_no}</Descriptions.Item>
              <Descriptions.Item label="到货数量">{current.quantity.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="到货日期">{current.arrival_date}</Descriptions.Item>
              <Descriptions.Item label="检验标准">{current.standard_name}</Descriptions.Item>
              <Descriptions.Item label="检验人">{current.inspector_name}</Descriptions.Item>
              <Descriptions.Item label="检验时间">{current.inspection_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验结果">
                {current.result ? <Tag color={resultColor[current.result]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="处理方式">
                {current.handle_type ? <Tag color={handleColor[current.handle_type] || 'default'}>{current.handle_type}</Tag> : '-'}
              </Descriptions.Item>
              {current.handle_reason && (
                <Descriptions.Item label="处理原因" span={2}>{current.handle_reason}</Descriptions.Item>
              )}
            </Descriptions>
            <Title level={5}>检验结果明细</Title>
            <Table
              columns={detailColumns}
              dataSource={inspectionDetailMap[current.inspection_id] || []}
              rowKey={(r, i) => i}
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
