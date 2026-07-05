import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Typography } from 'antd'
import {
  EnvironmentOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, SearchOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons, getQuickFilterRange } from '../../components/ThreeSectionPage'
import { envInspections } from '../../mock/data'

const { Text, Title } = Typography

// 环境检验结果明细 mock 数据
const envDetailMap = {
  ev1: [
    { item_name: '温度', standard_value: '18-26℃', actual_value: '23.5℃', judge: '合格' },
    { item_name: '相对湿度', standard_value: '45-65%', actual_value: '55%', judge: '合格' },
    { item_name: '沉降菌', standard_value: '≤15 CFU/皿', actual_value: '8 CFU/皿', judge: '合格' },
    { item_name: '表面微生物', standard_value: '≤25 CFU/25cm²', actual_value: '12 CFU/25cm²', judge: '合格' },
  ],
  ev2: [
    { item_name: '温度', standard_value: '18-26℃', actual_value: '24.0℃', judge: '合格' },
    { item_name: '相对湿度', standard_value: '45-65%', actual_value: '70%', judge: '不合格' },
    { item_name: '沉降菌', standard_value: '≤15 CFU/皿', actual_value: '22 CFU/皿', judge: '不合格' },
    { item_name: '表面微生物', standard_value: '≤25 CFU/25cm²', actual_value: '18 CFU/25cm²', judge: '合格' },
  ],
}

const resultColor = { '合格': 'success', '不合格': 'error' }
const triggerColor = { '自动': 'blue', '手工': 'purple' }
const statusColor = { '已完成': 'success', '检验中': 'processing' }

export default function EnvironmentInspection() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [quickFilter, setQuickFilter] = useState(() => {
    const { dateStart, dateEnd } = getQuickFilterRange('month')
    return { dateStart, dateEnd }
  })

  const handleQuickFilterChange = (val) => {
    const { dateStart, dateEnd } = getQuickFilterRange(val)
    setQuickFilter({ dateStart, dateEnd })
  }

  const filteredData = useMemo(() => {
    return envInspections.filter(item => {
      if (!quickFilter.dateStart || !quickFilter.dateEnd) return true
      if (!item.inspection_date) return false
      const t = dayjs(item.inspection_date)
      return t.isAfter(dayjs(quickFilter.dateStart).subtract(1, 'day')) && t.isBefore(dayjs(quickFilter.dateEnd).add(1, 'day'))
    })
  }, [quickFilter])

  const passCount = filteredData.filter(i => i.result === '合格').length
  const failCount = filteredData.filter(i => i.result === '不合格').length
  const passRate = filteredData.length > 0
    ? Math.round((passCount / filteredData.length) * 100)
    : 0

  const stats = [
    { label: '总检验数', value: filteredData.length, icon: <EnvironmentOutlined />, color: '#2196F3' },
    { label: '合格', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '合格率', value: `${passRate}%`, icon: <CheckCircleOutlined />, color: '#00BCD4' },
  ]

  const filters = [
    { type: 'input', placeholder: '检验编号', icon: <SearchOutlined /> },
    { type: 'input', placeholder: '检验区域' },
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
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 160, fixed: 'left' },
    { title: '检验区域', dataIndex: 'area_name', key: 'area_name', width: 120 },
    {
      title: '触发方式', dataIndex: 'trigger_type', key: 'trigger_type', width: 100,
      render: v => <Tag color={triggerColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: v => v ? <Tag color={resultColor[v]}>{v}</Tag> : <Tag>待检</Tag>
    },
    {
      title: '纠正措施', dataIndex: 'correction_action', key: 'correction_action', width: 220,
      render: v => v ? v : <Text type="secondary">-</Text>
    },
    {
      title: '复查日期', dataIndex: 'recheck_date', key: 'recheck_date', width: 110,
      render: v => v || <Text type="secondary">-</Text>
    },
    {
      title: '复查结果', dataIndex: 'recheck_result', key: 'recheck_result', width: 100,
      render: v => v ? <Tag color={resultColor[v] || 'default'}>{v}</Tag> : <Text type="secondary">-</Text>
    },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 100 },
    { title: '检验日期', dataIndex: 'inspection_date', key: 'inspection_date', width: 110 },
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
        title="环境检验"
        breadcrumbs="质量管理 / 环境检验"
        stats={stats}
        filters={filters}
        onQuickFilterChange={handleQuickFilterChange}
        actions={<ActionButtons />}
        table={
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="inspection_id"
            size="small"
            scroll={{ x: 1400 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Drawer
        title="环境检验详情"
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
              <Descriptions.Item label="检验区域">{current.area_name}</Descriptions.Item>
              <Descriptions.Item label="触发方式">
                <Tag color={triggerColor[current.trigger_type] || 'default'}>{current.trigger_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验人">{current.inspector_name}</Descriptions.Item>
              <Descriptions.Item label="检验日期">{current.inspection_date}</Descriptions.Item>
              <Descriptions.Item label="检验结果">
                {current.result ? <Tag color={resultColor[current.result]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="复查日期">{current.recheck_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="复查结果">
                {current.recheck_result ? <Tag color={resultColor[current.recheck_result] || 'default'}>{current.recheck_result}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="纠正措施" span={2}>
                {current.correction_action || '-'}
              </Descriptions.Item>
            </Descriptions>
            <Title level={5}>检验结果明细</Title>
            <Table
              columns={detailColumns}
              dataSource={envDetailMap[current.inspection_id] || []}
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
