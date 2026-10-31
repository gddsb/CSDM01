import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, Select, DatePicker, Input, Space } from 'antd'
import { BugOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'
import dayjs from 'dayjs'
import { formatDateTime } from '../../utils'

const { RangePicker } = DatePicker

const LEVEL_LABEL_MAP: Record<string, string> = {
  DEBUG: '调试', INFO: '信息', WARN: '警告', ERROR: '错误',
}

const levelOptions = [
  { label: '全部级别', value: '' },
  { label: '调试 (DEBUG)', value: 'DEBUG' },
  { label: '信息 (INFO)', value: 'INFO' },
  { label: '警告 (WARN)', value: 'WARN' },
  { label: '错误 (ERROR)', value: 'ERROR' },
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

  const stats: StatItem[] = [
    { label: '日志总条数', value: total, icon: <BugOutlined />, color: '#2196F3' },
  ]

  const filters: FilterItem[] = [
    {
      type: 'select', placeholder: '日志级别', col: { span: 4 },
      options: levelOptions, value: levelInput, onChange: (v) => setLevelInput(v as string),
    },
    {
      type: 'rangepicker', col: { span: 6 },
      value: dateRange, onChange: setDateRange,
    },
    {
      type: 'input', placeholder: '搜索关键词', col: { span: 6 },
      value: keywordInput, onChange: (e) => setKeywordInput((e as React.ChangeEvent<HTMLInputElement>).target.value),
      prefix: <SearchOutlined />,
    },
  ]

  const columns = [
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180, fixed: 'left' as const,
      render: formatDateTime,
    },
    {
      title: '级别', dataIndex: 'level', key: 'level', width: 80,
      render: v => <Tag color={getLevelColor(v)} style={{ margin: 0 }}>{LEVEL_LABEL_MAP[v] || v || '-'}</Tag>,
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 100,
      render: v => v || '-',
    },
    {
      title: '请求路径', dataIndex: 'path', key: 'path', width: 280,
      render: (v: string, record: any) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {v ? (
            <>
              {record.method && <Tag color="blue" style={{ marginRight: 4 }}>{record.method}</Tag>}
              {v}
              {record.status != null && (
                <Tag color={record.status >= 400 ? 'red' : 'green'} style={{ marginLeft: 4 }}>{record.status}</Tag>
              )}
              {record.duration_ms != null && <span style={{ marginLeft: 6, color: '#889' }}>{record.duration_ms}ms</span>}
            </>
          ) : '-'}
        </span>
      ),
    },
    {
      title: '耗时(ms)', dataIndex: 'duration_ms', key: 'duration_ms', width: 90, align: 'right' as const,
      render: v => v != null ? v : '-',
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
        <ResizableTable tableKey="pages_system_SystemLogs"           columns={columns}
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
