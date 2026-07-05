import React, { useState } from 'react'
import { Table, Tag, Button, Typography, Alert, Steps } from 'antd'
import {
  WarningOutlined, SendOutlined, MessageOutlined, CheckCircleOutlined,
  FilePdfOutlined, SearchOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { supplierComplaints, incomingInspections } from '../../mock/data'

const { Text } = Typography

const statusColor = { '已创建': 'default', '已发出': 'processing', '已回复': 'warning', '已关闭': 'success' }
const statusOrder = ['已创建', '已发出', '已回复', '已关闭']

export default function SupplierComplaint() {
  const sentCount = supplierComplaints.filter(s => s.status === '已发出').length
  const repliedCount = supplierComplaints.filter(s => s.status === '已回复').length
  const closedCount = supplierComplaints.filter(s => s.status === '已关闭').length

  const stats = [
    { label: '总投诉数', value: supplierComplaints.length, icon: <WarningOutlined />, color: '#2196F3' },
    { label: '已发出', value: sentCount, icon: <SendOutlined />, color: '#FF9800' },
    { label: '已回复', value: repliedCount, icon: <MessageOutlined />, color: '#00BCD4' },
    { label: '已关闭', value: closedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const filters = [
    { type: 'input', placeholder: '投诉编号', icon: <SearchOutlined /> },
    { type: 'input', placeholder: '供应商名称' },
    {
      type: 'select', placeholder: '状态', options: [
        { label: '已创建', value: '已创建' },
        { label: '已发出', value: '已发出' },
        { label: '已回复', value: '已回复' },
        { label: '已关闭', value: '已关闭' },
      ]
    },
  ]

  const getRelatedInspectionNo = (record) => {
    if (!record.related_inspection_id) return '-'
    const inc = incomingInspections.find(i => i.inspection_id === record.related_inspection_id)
    return inc ? inc.inspection_no : '-'
  }

  const getCurrentStep = (status) => {
    const idx = statusOrder.indexOf(status)
    return idx === -1 ? 0 : idx
  }

  const columns = [
    { title: '投诉编号', dataIndex: 'complaint_no', key: 'complaint_no', width: 140, fixed: 'left' },
    { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name', width: 120 },
    { title: '投诉类型', dataIndex: 'complaint_type', key: 'complaint_type', width: 110 },
    { title: '投诉原因', dataIndex: 'complaint_reason', key: 'complaint_reason', width: 260 },
    {
      title: '关联来料检验', key: 'related_inspection', width: 150,
      render: (_, record) => getRelatedInspectionNo(record)
    },
    { title: '投诉日期', dataIndex: 'complaint_date', key: 'complaint_date', width: 110 },
    {
      title: 'PDF路径', dataIndex: 'pdf_path', key: 'pdf_path', width: 180,
      render: v => v ? (
        <Button type="link" size="small" icon={<FilePdfOutlined />} href={v} target="_blank">{v}</Button>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: '回复内容', dataIndex: 'reply_content', key: 'reply_content', width: 220,
      render: v => v ? v : <Text type="secondary">暂无回复</Text>
    },
    {
      title: '回复日期', dataIndex: 'reply_date', key: 'reply_date', width: 110,
      render: v => v || <Text type="secondary">-</Text>
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
  ]

  return (
    <ThreeSectionPage
      title="供应商投诉"
      breadcrumbs="质量管理 / 供应商投诉"
      stats={stats}
      filters={filters}
      actions={<ActionButtons />}
      table={
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="状态流转：已创建 → 已发出 → 已回复 → 已关闭"
          />
          <Table
            columns={columns}
            dataSource={supplierComplaints}
            rowKey="complaint_id"
            size="small"
            scroll={{ x: 1500 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ padding: '8px 0' }}>
                  <Steps
                    size="small"
                    current={getCurrentStep(record.status)}
                    items={[
                      { title: '已创建', description: `登记人：${record.created_by_name}` },
                      { title: '已发出', description: `投诉日期：${record.complaint_date}` },
                      { title: '已回复', description: record.reply_date ? `回复日期：${record.reply_date}` : '等待供应商回复' },
                      { title: '已关闭', description: '投诉处理完成' },
                    ]}
                  />
                  {record.reply_content && (
                    <div style={{ marginTop: 12 }}>
                      <Text strong>供应商回复：</Text>
                      <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{record.reply_content}</div>
                    </div>
                  )}
                </div>
              ),
            }}
          />
        </>
      }
    />
  )
}
