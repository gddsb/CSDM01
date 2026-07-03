import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Typography, Alert } from 'antd'
import {
  ExperimentOutlined, SafetyCertificateOutlined, WarningOutlined,
  CheckCircleOutlined, EyeOutlined, SearchOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { microbeInspections, incomingInspections } from '../../mock/data'

const { Text, Title } = Typography

// 微生物检验结果明细 mock 数据
const microbeDetailMap = {
  mb1: [
    { item_name: '菌落总数', standard_value: '≤100', actual_value: '25', unit: 'CFU/g', judge: '合格' },
    { item_name: '大肠菌群', standard_value: '不得检出', actual_value: '未检出', unit: '-', judge: '合格' },
    { item_name: '霉菌和酵母', standard_value: '≤50', actual_value: '12', unit: 'CFU/g', judge: '合格' },
    { item_name: '沙门氏菌', standard_value: '不得检出', actual_value: '未检出', unit: '-', judge: '合格' },
  ],
  mb2: [
    { item_name: '菌落总数', standard_value: '≤500', actual_value: '120', unit: 'CFU/g', judge: '合格' },
    { item_name: '大肠菌群', standard_value: '≤30', actual_value: '<3', unit: 'MPN/g', judge: '合格' },
    { item_name: '霉菌和酵母', standard_value: '≤100', actual_value: '30', unit: 'CFU/g', judge: '合格' },
  ],
}

const resultColor = { '合格': 'success', '不合格': 'error' }
const typeColor = { '正常': 'success', '加严': 'warning' }
const objectColor = { '成品': 'blue', '原材料': 'cyan' }
const statusColor = { '已完成': 'success', '检验中': 'processing' }
const handleColor = { '入库': 'green', '判退': 'red', '报废': 'red', '让步接收': 'orange' }

// 处理方式映射（mock）
const handleMap = {
  mb1: '入库',
  mb2: '入库',
}

export default function MicrobeInspection() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState(null)

  const normalCount = microbeInspections.filter(i => i.inspection_type === '正常').length
  const strictCount = microbeInspections.filter(i => i.inspection_type === '加严').length
  const passCount = microbeInspections.filter(i => i.result === '合格').length
  const passRate = microbeInspections.length > 0
    ? Math.round((passCount / microbeInspections.length) * 100)
    : 0

  const stats = [
    { label: '总检验数', value: microbeInspections.length, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '正常检验', value: normalCount, icon: <SafetyCertificateOutlined />, color: '#4CAF50' },
    { label: '加严检验', value: strictCount, icon: <WarningOutlined />, color: '#FF9800' },
    { label: '合格率', value: `${passRate}%`, icon: <CheckCircleOutlined />, color: '#00BCD4' },
  ]

  const filters = [
    { type: 'input', placeholder: '检验编号', icon: <SearchOutlined /> },
    {
      type: 'select', placeholder: '检验对象', options: [
        { label: '成品', value: '成品' },
        { label: '原材料', value: '原材料' },
      ]
    },
    {
      type: 'select', placeholder: '检验结果', options: [
        { label: '合格', value: '合格' },
        { label: '不合格', value: '不合格' },
      ]
    },
  ]

  const getRelatedNo = (record) => {
    if (record.object_type === '成品' && record.work_order_no) {
      return record.work_order_no
    }
    if (record.object_type === '原材料' && record.incoming_id) {
      const inc = incomingInspections.find(i => i.inspection_id === record.incoming_id)
      return inc ? inc.inspection_no : '-'
    }
    return '-'
  }

  const showDetail = (record) => {
    setCurrent(record)
    setDrawerOpen(true)
  }

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 150, fixed: 'left' },
    {
      title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 90,
      render: v => <Tag color={typeColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '检验对象', dataIndex: 'object_type', key: 'object_type', width: 90,
      render: v => <Tag color={objectColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '关联工单/来料', key: 'related_no', width: 170,
      render: (_, record) => getRelatedNo(record)
    },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: v => v ? <Tag color={resultColor[v]}>{v}</Tag> : <Tag>待检</Tag>
    },
    {
      title: '处理方式', key: 'handle_type', width: 100,
      render: (_, record) => {
        const h = handleMap[record.inspection_id]
        return h ? <Tag color={handleColor[h] || 'default'}>{h}</Tag> : <Text type="secondary">-</Text>
      }
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
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: '判定', dataIndex: 'judge', key: 'judge', width: 90,
      render: v => <Tag color={v === '合格' ? 'success' : v === '不合格' ? 'error' : 'default'}>{v}</Tag>
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="微生物检验"
        breadcrumbs="质量管理 / 微生物检验"
        stats={stats}
        filters={filters}
        actions={<ActionButtons />}
        table={
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="不合格处理流程：正常检验 → 不合格 → 加严检验(样本翻倍) → 仍不合格 → 判退/报废"
            />
            <Table
              columns={columns}
              dataSource={microbeInspections}
              rowKey="inspection_id"
              size="small"
              scroll={{ x: 1300 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </>
        }
      />
      <Drawer
        title="微生物检验详情"
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
              <Descriptions.Item label="检验类型">
                <Tag color={typeColor[current.inspection_type] || 'default'}>{current.inspection_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验对象">
                <Tag color={objectColor[current.object_type] || 'default'}>{current.object_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联工单/来料" span={2}>{getRelatedNo(current)}</Descriptions.Item>
              <Descriptions.Item label="检验人">{current.inspector_name}</Descriptions.Item>
              <Descriptions.Item label="检验时间">{current.inspection_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验结果">
                {current.result ? <Tag color={resultColor[current.result]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="处理方式">
                {(() => { const h = handleMap[current.inspection_id]; return h ? <Tag color={handleColor[h] || 'default'}>{h}</Tag> : '-' })()}
              </Descriptions.Item>
            </Descriptions>
            <Title level={5}>检验结果明细</Title>
            <Table
              columns={detailColumns}
              dataSource={microbeDetailMap[current.inspection_id] || []}
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
