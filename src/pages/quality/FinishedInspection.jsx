import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Typography } from 'antd'
import {
  ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, SearchOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { finishedInspections } from '../../mock/data'

const { Text, Title } = Typography

// 成品检验结果明细 mock 数据
const finishedDetailMap = {
  fc1: [
    { item_name: '外观-印刷色差', standard_value: '无明显色差', actual_value: '合格', judge: '合格' },
    { item_name: '罐体高度', standard_value: '90.0±0.3mm', actual_value: '90.1mm', judge: '合格' },
    { item_name: '罐体直径', standard_value: 'Φ74.0±0.2mm', actual_value: 'Φ74.0mm', judge: '合格' },
    { item_name: '焊缝强度', standard_value: '≥200N', actual_value: '235N', judge: '合格' },
    { item_name: '耐压性能', standard_value: '0.1MPa保压30s无渗漏', actual_value: '保压通过', judge: '合格' },
  ],
  fc2: [
    { item_name: '外观-印刷色差', standard_value: '无明显色差', actual_value: '合格', judge: '合格' },
    { item_name: '罐体高度', standard_value: '90.0±0.3mm', actual_value: '90.0mm', judge: '合格' },
    { item_name: '罐体直径', standard_value: 'Φ74.0±0.2mm', actual_value: 'Φ73.9mm', judge: '合格' },
    { item_name: '焊缝强度', standard_value: '≥200N', actual_value: '228N', judge: '合格' },
    { item_name: '耐压性能', standard_value: '0.1MPa保压30s无渗漏', actual_value: '保压通过', judge: '合格' },
  ],
}

const resultColor = { '合格': 'success', '不合格': 'error' }
const handleColor = { '入库': 'green', '退货': 'red', '让步接收': 'orange', '报废': 'red' }
const triggerColor = { '自动': 'blue', '手工': 'purple' }
const statusColor = { '已完成': 'success', '检验中': 'processing' }

export default function FinishedInspection() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState(null)

  const passCount = finishedInspections.filter(i => i.result === '合格').length
  const failCount = finishedInspections.filter(i => i.result === '不合格').length

  const stats = [
    { label: '总检验数', value: finishedInspections.length, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '合格', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
  ]

  const filters = [
    { type: 'input', placeholder: '检验编号', icon: <SearchOutlined /> },
    { type: 'input', placeholder: '关联工单编号' },
    {
      type: 'select', placeholder: '检验结果', options: [
        { label: '合格', value: '合格' },
        { label: '不合格', value: '不合格' },
      ]
    },
  ]

  const showDetail = (record) => {
    setCurrent(record)
    setDrawerOpen(true)
  }

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 150, fixed: 'left' },
    { title: '关联工单', dataIndex: 'work_order_no', key: 'work_order_no', width: 160 },
    {
      title: '触发方式', dataIndex: 'trigger_type', key: 'trigger_type', width: 100,
      render: v => <Tag color={triggerColor[v] || 'default'}>{v}</Tag>
    },
    { title: '关联标准', dataIndex: 'standard_name', key: 'standard_name', width: 200 },
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
        title="成品检验"
        breadcrumbs="质量管理 / 成品检验"
        stats={stats}
        filters={filters}
        actions={<ActionButtons />}
        table={
          <Table
            columns={columns}
            dataSource={finishedInspections}
            rowKey="inspection_id"
            size="small"
            scroll={{ x: 1300 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Drawer
        title="成品检验详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={820}
        destroyOnHidden
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检验编号">{current.inspection_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[current.status] || 'default'}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联工单">{current.work_order_no}</Descriptions.Item>
              <Descriptions.Item label="触发方式">
                <Tag color={triggerColor[current.trigger_type] || 'default'}>{current.trigger_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验标准" span={2}>{current.standard_name}</Descriptions.Item>
              <Descriptions.Item label="检验人">{current.inspector_name}</Descriptions.Item>
              <Descriptions.Item label="检验时间">{current.inspection_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验结果">
                {current.result ? <Tag color={resultColor[current.result]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="处理方式">
                {current.handle_type ? <Tag color={handleColor[current.handle_type] || 'default'}>{current.handle_type}</Tag> : '-'}
              </Descriptions.Item>
            </Descriptions>
            <Title level={5}>检验结果明细</Title>
            <Table
              columns={detailColumns}
              dataSource={finishedDetailMap[current.inspection_id] || []}
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
