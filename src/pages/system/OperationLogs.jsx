import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, message } from 'antd'
import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'

// 根据 operation 文本前缀推断 Tag 颜色
function getOperationColor(op) {
  if (!op) return 'default'
  if (op.startsWith('查询') || op.startsWith('登录')) return 'blue'
  if (op.startsWith('新增')) return 'green'
  if (op.startsWith('修改') || op.startsWith('编辑')) return 'gold'
  if (op.startsWith('删除')) return 'red'
  if (op.startsWith('导出')) return 'cyan'
  return 'default'
}

function formatTime(v) {
  if (!v) return '-'
  return String(v).replace('T', ' ').slice(0, 19)
}

export default function OperationLogs() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  // 输入态
  const [usernameInput, setUsernameInput] = useState('')
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 15, username: '' })

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.username) params.username = query.username
        const res = await api.get('/system/logs', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取操作日志失败')
          setData([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [query])

  const refresh = () => setQuery(q => ({ ...q }))

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, username: usernameInput }))
  }

  const handleReset = () => {
    setUsernameInput('')
    setQuery(q => ({ ...q, page: 1, username: '' }))
  }

  const stats = [
    { label: '日志总条数', value: total, icon: <HistoryOutlined />, color: '#2196F3' },
  ]

  const filters = [
    { type: 'input', placeholder: '搜索用户名', col: { span: 6 }, value: usernameInput, onChange: e => setUsernameInput(e.target.value) },
  ]

  const columns = [
    {
      title: '操作时间', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: formatTime,
    },
    { title: '用户', dataIndex: 'username', key: 'username', width: 120 },
    { title: '模块', dataIndex: 'module', key: 'module', width: 120 },
    {
      title: '操作内容', dataIndex: 'operation', key: 'operation',
      render: v => <Tag color={getOperationColor(v)}>{v || '-'}</Tag>,
    },
    { title: '请求方法', dataIndex: 'method', key: 'method', width: 90,
      render: v => v ? <Tag>{v}</Tag> : '-' },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', width: 140 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => v === 1 ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
    },
  ]

  return (
    <ThreeSectionPage
      title="操作日志"
      breadcrumbs="系统管理 / 操作日志"
      stats={stats}
      filters={filters}
      onSearch={handleSearch}
      onReset={handleReset}
      actions={
        <Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>
      }
      table={
        <Table
          columns={columns}
          dataSource={data}
          rowKey="log_id"
          size="small"
          loading={loading}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
          }}
        />
      }
    />
  )
}
