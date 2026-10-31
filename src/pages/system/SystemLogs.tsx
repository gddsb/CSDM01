import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo } from 'react'
import { Table, Tag, Button, Select, DatePicker, Input, Space, Drawer, Descriptions, Tooltip } from 'antd'
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

/** pino-http / pino 固定英文日志消息 → 中文（纯前端翻译，服务器零消耗） */
const MSG_TRANSLATION_MAP: Record<string, string> = {
  'request completed': '请求完成',
  'request errored': '请求出错',
  'request skip': '请求跳过',
  'request aborted': '请求已中止',
  'request timeout': '请求超时',
}

/** pino-http 固定 msg 的来源标记 */
const PINO_MSG_SOURCE = new Set(Object.keys(MSG_TRANSLATION_MAP))

/** 翻译日志消息（业务写的中文不动；pino 固定英文转中文） */
function translateMessage(raw: string | null | undefined): string {
  if (!raw) return ''
  // pino 固定 msg 都是小写精确匹配，直接查表
  const lower = raw.toLowerCase()
  if (PINO_MSG_SOURCE.has(lower)) return MSG_TRANSLATION_MAP[lower]
  return raw
}

/** 业务日志 category（null/空值）→ 中文；request 不翻 */
function translateCategory(v: string | null | undefined): string {
  if (!v) return '应用日志'
  if (v === 'request') return '请求日志'
  return v
}

function getLevelColor(level: string) {
  switch (level) {
    case 'DEBUG': return 'default'
    case 'INFO': return 'blue'
    case 'WARN': return 'orange'
    case 'ERROR': return 'red'
    default: return 'default'
  }
}

function safeFormatJson(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    const obj = JSON.parse(raw)
    return JSON.stringify(obj, null, 2)
  } catch {
    return raw
  }
}

const levelOptions = [
  { label: '全部级别', value: '' },
  { label: '调试 (DEBUG)', value: 'DEBUG' },
  { label: '信息 (INFO)', value: 'INFO' },
  { label: '警告 (WARN)', value: 'WARN' },
  { label: '错误 (ERROR)', value: 'ERROR' },
]

export default function SystemLogs() {
  const message = useMessage()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const [keywordInput, setKeywordInput] = useState('')
  const [levelInput, setLevelInput] = useState('')
  const [dateRange, setDateRange] = useState<any>(null)

  const [query, setQuery] = useState({
    page: 1, pageSize: 50, keyword: '', level: '', dateStart: '', dateEnd: '',
  })

  // 详情 Drawer 状态
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<any>(null)

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

  const handleViewDetail = (record: any) => {
    setDetailRow(record)
    setDetailOpen(true)
  }

  const stats: StatItem[] = [
    { label: '日志总条数', value: total, icon: <BugOutlined />, color: '#2196F3' },
  ]

  const filters: FilterItem[] = [
    {
      type: 'select', placeholder: '日志级别', col: { span: 4 },
      options: levelOptions, value: levelInput,
      onChange: (v) => { setLevelInput(v as string); setTimeout(handleSearch, 0) },
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

  /** 所有列强制 width — 每列像素固定，拖动某列只影响那列，其它列不变 */
  const columns = useMemo(() => [
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170, fixed: 'left' as const,
      render: formatDateTime,
    },
    {
      title: '级别', dataIndex: 'level', key: 'level', width: 70,
      render: v => <Tag color={getLevelColor(v)} style={{ margin: 0 }}>{LEVEL_LABEL_MAP[v] || v || '-'}</Tag>,
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 100,
      render: v => translateCategory(v),
    },
    {
      title: '请求路径', dataIndex: 'path', key: 'path', width: 320,
      render: (v: string, record: any) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {v ? (
            <>
              {record.method && <Tag color="blue" style={{ marginRight: 4 }}>{record.method}</Tag>}
              <Tooltip title={v}><span style={{ display: 'inline-block', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{v}</span></Tooltip>
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
      title: '日志内容', dataIndex: 'message', key: 'message', width: 320,
      render: (v: string) => {
        const translated = translateMessage(v)
        return (
          <Tooltip title={translated}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{translated || '-'}</span>
          </Tooltip>
        )
      },
    },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>详情</Button>
      ),
    },
  ], [])

  return (
    <>
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
          <ResizableTable
            tableKey="pages_system_SystemLogs"
            columns={columns as any}
            dataSource={data}
            rowKey="log_id"
            size="small"
            loading={loading}
            scroll={{ x: 1190 }}
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

      {/* 详情抽屉 */}
      <Drawer
        title="日志详情"
        open={detailOpen}
        width={720}
        onClose={() => setDetailOpen(false)}
        destroyOnClose
      >
        {detailRow && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="日志ID">{detailRow.log_id}</Descriptions.Item>
              <Descriptions.Item label="级别">
                <Tag color={getLevelColor(detailRow.level)}>{LEVEL_LABEL_MAP[detailRow.level] || detailRow.level}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="分类">{translateCategory(detailRow.category)}</Descriptions.Item>
              <Descriptions.Item label="时间">{formatDateTime(detailRow.created_at)}</Descriptions.Item>
              <Descriptions.Item label="请求路径" span={2}>
                {detailRow.path ? (
                  <span style={{ fontFamily: 'monospace' }}>
                    {detailRow.method && <Tag color="blue" style={{ marginRight: 4 }}>{detailRow.method}</Tag>}
                    {detailRow.path}
                    {detailRow.status != null && <Tag color={detailRow.status >= 400 ? 'red' : 'green'} style={{ marginLeft: 4 }}>{detailRow.status}</Tag>}
                  </span>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="耗时(ms)">{detailRow.duration_ms ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="来源">{detailRow.source || '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>日志消息</div>
              <div style={{
                fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap',
                wordBreak: 'break-all', background: '#f7f7f7', padding: 12,
                borderRadius: 4, border: '1px solid #e8e8e8',
              }}>{translateMessage(detailRow.message) || '-'}</div>
            </div>

            {detailRow.details && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>详情上下文</div>
                <pre style={{
                  fontFamily: 'monospace', fontSize: 12, background: '#1e1e1e',
                  color: '#d4d4d4', padding: 12, borderRadius: 4, margin: 0,
                  maxHeight: 400, overflow: 'auto', border: '1px solid #333',
                }}>{safeFormatJson(detailRow.details)}</pre>
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
