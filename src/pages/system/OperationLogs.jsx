import React, { useState } from 'react'
import { Table, Tag } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { operationLogs } from '../../mock/data'

// 操作类型标签颜色映射
const actionColorMap = {
  '登录': 'blue',
  '新增': 'green',
  '报工': 'processing',
  '检验': 'orange',
  '登记': 'purple',
  '编辑': 'gold',
  '删除': 'red',
  '导出': 'cyan',
}

export default function OperationLogs() {
  const [data] = useState(operationLogs)

  const stats = [
    { label: '日志总条数', value: data.length, icon: <HistoryOutlined />, color: '#2196F3' },
  ]

  const moduleOptions = [...new Set(data.map(d => d.module))].map(m => ({ label: m, value: m }))
  const actionOptions = [...new Set(data.map(d => d.action))].map(a => ({ label: a, value: a }))

  const filters = [
    { type: 'input', placeholder: '搜索模块', col: { span: 6 } },
    { type: 'select', placeholder: '操作类型', options: actionOptions, col: { span: 6 } },
    { type: 'rangepicker', placeholder: '时间范围', col: { span: 8 } },
  ]

  const columns = [
    { title: '操作时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    { title: '用户', dataIndex: 'user_name', key: 'user_name', width: 120 },
    { title: '模块', dataIndex: 'module', key: 'module', width: 120 },
    {
      title: '操作类型', dataIndex: 'action', key: 'action', width: 100,
      render: v => <Tag color={actionColorMap[v] || 'default'}>{v}</Tag>,
    },
    { title: '操作内容', dataIndex: 'content', key: 'content' },
    { title: 'IP地址', dataIndex: 'ip_address', key: 'ip_address', width: 140 },
  ]

  return (
    <ThreeSectionPage
      title="操作日志"
      breadcrumbs="系统管理 / 操作日志"
      stats={stats}
      filters={filters}
      table={
        <Table
          columns={columns}
          dataSource={data}
          rowKey="log_id"
          size="small"
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
        />
      }
    />
  )
}
