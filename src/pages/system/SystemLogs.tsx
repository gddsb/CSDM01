import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, Select, DatePicker, Input, Space } from 'antd'
import { BugOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const levelOptions = [
  { label: '全部级别', value: '' },
  { label: 'DEBUG', value: 'DEBUG' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'ERROR', value: 'ERROR' },
]

function getLevelColor(level: string) {
  switch (level) {
    case 'DEBUG': return 'default'
    case 'INFO': return 'blue'
    case 'WARN': return 'orange'
    case 'ERROR': return 'red'
    default: return 'default'
  }
}

function formatTime(v: string) {
  if (!v) return '-'
  return dayjs(v).format('YYYY-MM-DD HH:mm:ss')
}

export default function SystemLogs() {
  const message = useMessage()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const [keywordInput, setKeywordInput] = useState('')
  const [levelInput, setLevelInput] = useState('')
  const [dateRange, setDateRange] = useState<any>(null)

  const [query, setQuery] = useState({
    page: 1, pageSize: 50, keyword: '', level: '', dateStart: '', dateEnd: '',
  })

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params: any = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.level) params.level = query.level
        if (query.dateStart) params.dateStart = query.dateStart
        if (query.dateEnd) params.dateEnd = query.dateEnd
        const res = await api.get('/system/system-logs', { params })
        if (cancelled) return
        setData(res.data || [])
        setTotal(res.total || 0)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取系统日志失败')
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
    setQuery(q => ({
      ...q,
      page: 1,
      keyword: keywordInput,
      level: levelInput,
      dateStart: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : '',
      dateEnd: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : '',
    }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setLevelInput('')
    setDateRange(null)
    setQuery(q => ({ ...q, page: 1, keyword: '', level: '', dateStart: '', dateEnd: '' }))
  }

  const stats = [
    { label: '日志总条数', value: total, icon: <BugOutlined />, color: '#2196F3' },
  ]

  const filters = [
    {
      type: 'select', placeholder: '日志级别', col: { span: 4 },
      options: levelOptions, value: levelInput, onChange: v => setLevelInput(v),
    },
    {
      type: 'custom', col: { span: 6 },
      render: (
        <RangePicker
          value={dateRange}
          onChange={setDateRange}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      type: 'input', placeholder: '搜索关键词', col: { span: 6 },
      value: keywordInput, onChange: e => setKeywordInput(e.target.value),
      prefix: <SearchOutlined />,
    },
  ]

  const columns = [
    {
      title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 180,
      render: formatTime,
    },
    {
      title: '级别', dataIndex: 'level', key: 'level', width: 90,
      render: v => <Tag color={getLevelColor(v)} style={{ minWidth: 62, textAlign: 'center' }}>{v || '-'}</Tag>,
    },
    {
      title: '日志内容', dataIndex: 'message', key: 'message',
      render: v => (
        <div style={{
          fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap',
          wordBreak: 'break-all', maxHeight: 80, overflow: 'auto',
        }}>{v || '-'}</div>
      ),
    },
  ]

  return (
    <ThreeSectionPage
      title="系统日志"
      breadcrumbs="系统管理 / 系统日志"
      stats={stats}
      filters={filters}
      onSearch={handleSearch}
      onReset={handleReset}
      actions={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>
        </Space>
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
