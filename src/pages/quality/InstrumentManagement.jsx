import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Space, Typography } from 'antd'
import {
  ToolOutlined, CheckCircleOutlined, WarningOutlined,
  ClockCircleOutlined, SearchOutlined, HistoryOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { instruments } from '../../mock/data'

const { Text, Title } = Typography

// 校准历史记录 mock 数据（按仪器id分组）
const calibrationHistoryMap = {
  i1: [
    { calibration_date: '2026-06-15', calibration_result: '合格', calibration_org: '上海市计量测试技术研究院', operator: '质量检验员' },
    { calibration_date: '2025-06-15', calibration_result: '合格', calibration_org: '上海市计量测试技术研究院', operator: '质量检验员' },
    { calibration_date: '2024-06-15', calibration_result: '合格', calibration_org: '上海市计量测试技术研究院', operator: '质量管理员' },
  ],
  i2: [
    { calibration_date: '2026-01-10', calibration_result: '合格', calibration_org: '广州计量检测院', operator: '质量检验员' },
    { calibration_date: '2025-07-10', calibration_result: '合格', calibration_org: '广州计量检测院', operator: '质量管理员' },
  ],
  i3: [
    { calibration_date: '2025-05-01', calibration_result: '合格', calibration_org: '北京中测院', operator: '质量管理员' },
    { calibration_date: '2024-05-01', calibration_result: '合格', calibration_org: '北京中测院', operator: '质量管理员' },
  ],
}

const statusColor = { '正常': 'success', '即将到期': 'warning', '已超期': 'error', '停用': 'default' }

export default function InstrumentManagement() {
  const [modalOpen, setModalOpen] = useState(false)
  const [current, setCurrent] = useState(null)

  const normalCount = instruments.filter(i => i.status === '正常').length
  const expiringCount = instruments.filter(i => i.status === '即将到期').length
  const expiredCount = instruments.filter(i => i.status === '已超期').length

  const stats = [
    { label: '仪器总数', value: instruments.length, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '正常', value: normalCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '即将到期', value: expiringCount, icon: <WarningOutlined />, color: '#FF9800' },
    { label: '已超期', value: expiredCount, icon: <ClockCircleOutlined />, color: '#F44336' },
  ]

  const filters = [
    { type: 'input', placeholder: '仪器编号 / 仪器名称', icon: <SearchOutlined /> },
    {
      type: 'select', placeholder: '状态', options: [
        { label: '正常', value: '正常' },
        { label: '即将到期', value: '即将到期' },
        { label: '已超期', value: '已超期' },
        { label: '停用', value: '停用' },
      ]
    },
  ]

  const showHistory = (record) => {
    setCurrent(record)
    setModalOpen(true)
  }

  const columns = [
    { title: '仪器编号', dataIndex: 'instrument_no', key: 'instrument_no', width: 140, fixed: 'left' },
    { title: '仪器名称', dataIndex: 'instrument_name', key: 'instrument_name', width: 130 },
    { title: '型号', dataIndex: 'instrument_model', key: 'instrument_model', width: 110 },
    { title: '所属部门', dataIndex: 'department', key: 'department', width: 120 },
    { title: '存放地点', dataIndex: 'location', key: 'location', width: 110 },
    {
      title: '校准周期(天)', dataIndex: 'calibration_cycle', key: 'calibration_cycle', width: 120,
      render: v => v
    },
    { title: '上次校准日期', dataIndex: 'last_calibration_date', key: 'last_calibration_date', width: 120 },
    { title: '下次校准日期', dataIndex: 'next_calibration_date', key: 'next_calibration_date', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => showHistory(record)}>校准记录</Button>
      )
    },
  ]

  const historyColumns = [
    { title: '校准日期', dataIndex: 'calibration_date', key: 'calibration_date', width: 130 },
    {
      title: '校准结果', dataIndex: 'calibration_result', key: 'calibration_result', width: 100,
      render: v => <Tag color={v === '合格' ? 'success' : 'error'}>{v}</Tag>
    },
    { title: '校准机构', dataIndex: 'calibration_org', key: 'calibration_org' },
    { title: '录入人', dataIndex: 'operator', key: 'operator', width: 110 },
  ]

  return (
    <>
      <ThreeSectionPage
        title="检测仪器"
        breadcrumbs="质量管理 / 检测仪器"
        stats={stats}
        filters={filters}
        actions={<ActionButtons />}
        table={
          <Table
            columns={columns}
            dataSource={instruments}
            rowKey="instrument_id"
            size="small"
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title="校准记录"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {current && (
          <>
            <Space size="large" style={{ marginBottom: 16 }}>
              <div>
                <Text type="secondary">仪器编号：</Text>
                <Text strong>{current.instrument_no}</Text>
              </div>
              <div>
                <Text type="secondary">仪器名称：</Text>
                <Text strong>{current.instrument_name}</Text>
              </div>
              <div>
                <Text type="secondary">型号：</Text>
                <Text strong>{current.instrument_model}</Text>
              </div>
              <div>
                <Text type="secondary">状态：</Text>
                <Tag color={statusColor[current.status] || 'default'}>{current.status}</Tag>
              </div>
            </Space>
            <Title level={5}>校准历史记录</Title>
            <Table
              columns={historyColumns}
              dataSource={calibrationHistoryMap[current.instrument_id] || []}
              rowKey={(r, i) => i}
              size="small"
              pagination={false}
            />
            {current.remarks && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">备注：</Text>
                <Text>{current.remarks}</Text>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  )
}
