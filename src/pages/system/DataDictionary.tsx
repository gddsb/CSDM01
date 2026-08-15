import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Input, Select, Space, Progress, Alert } from 'antd'
import { DatabaseOutlined, ReloadOutlined, SyncOutlined, TableOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'
import { formatDateTime } from '../../utils'

const categoryColorMap: Record<string, string> = {
  '系统表': 'blue',
  '基础数据表': 'green',
  '业务表': 'orange',
}

// 数据字典列表条目（简略）
interface DictRow {
  dict_id: number
  table_name: string
  category: string
  purpose?: string
  field_count: number
  record_count: number
  fields?: any[]
  last_update?: string
}

// 异步刷新进度响应
interface RefreshProgress {
  taskId: string
  status: 'pending' | 'running' | 'success' | 'failed'
  totalTables: number
  processedTables: number
  currentTable: string
  message: string
  progressPercent: number
  startedAt?: string
  finishedAt?: string
  error?: string | null
  result?: { total: number; refreshed_at: string } | null
}

export default function DataDictionary() {
  const message = useMessage()
  const [tableList, setTableList] = useState<DictRow[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentTable, setCurrentTable] = useState<DictRow | null>(null)
  const [columns, setColumns] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  // 表记录抽屉
  const [recordsVisible, setRecordsVisible] = useState(false)
  const [recordsTable, setRecordsTable] = useState<DictRow | null>(null)
  const [recordsData, setRecordsData] = useState<any[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsPageSize, setRecordsPageSize] = useState(20)
  const [recordFields, setRecordFields] = useState<any[]>([])

  const [keywordInput, setKeywordInput] = useState('')
  const [categoryInput, setCategoryInput] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', category: undefined as string | undefined })

  const fetchTables = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ list: DictRow[]; total: number }>('/system/config/data-dictionary', {
        params: { keyword: query.keyword, category: query.category, page: query.page, pageSize: query.pageSize },
      })
      const list = res.data?.list || []
      setTableList(list as DictRow[])
      setTotal(res.data?.total || 0)
    } catch (err: any) {
      message.error(err.message || '获取数据表清单失败')
      setTableList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [query, message])

  useEffect(() => {
    fetchTables()
    return () => stopPolling()
  }, [fetchTables])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, category: categoryInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setCategoryInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', category: undefined }))
  }

  const handleViewDetail = (record: DictRow) => {
    setCurrentTable(record)
    setColumns(record.fields || [])
    setDetailVisible(true)
  }

  const handleViewRecords = async (record: DictRow, page = 1, pageSize = 20) => {
    setRecordsTable(record)
    setRecordsVisible(true)
    setRecordsPage(page)
    setRecordsPageSize(pageSize)
    setRecordsLoading(true)
    try {
      const res = await api.get(`/system/config/data-dictionary/${record.table_name}/records`, {
        params: { page, pageSize },
        timeout: 120000,
      })
      setRecordsData(res.data?.list || [])
      setRecordsTotal(res.data?.total || 0)
      setRecordFields(res.data?.fields || [])
    } catch (err: any) {
      message.error(err.message || '获取表记录失败')
      setRecordsData([])
      setRecordsTotal(0)
    } finally {
      setRecordsLoading(false)
    }
  }

  // 轮询刷新进度
  const startProgressPolling = (taskId: string) => {
    stopPolling()
    let consecutiveFail = 0
    const poll = async () => {
      try {
        const res = await api.get<RefreshProgress>(`/system/config/data-dictionary/refresh/${taskId}`, { timeout: 10000 })
        const prog = res.data as unknown as RefreshProgress
        if (prog) {
          setRefreshProgress(prog)
        }
        consecutiveFail = 0
        if (!prog) return
        if (prog.status === 'success') {
          stopPolling()
          setRefreshing(false)
          message.success(prog.message || '数据字典更新成功')
          setQuery(q => ({ ...q, page: 1 }))
          return
        }
        if (prog.status === 'failed') {
          stopPolling()
          setRefreshing(false)
          message.error(prog.error || prog.message || '更新数据字典失败')
          return
        }
      } catch (e: any) {
        consecutiveFail++
        if (consecutiveFail > 10) {
          stopPolling()
          setRefreshing(false)
          message.error(e?.message || '查询刷新进度失败，请稍后刷新页面')
        }
      }
    }
    pollTimerRef.current = setInterval(poll, 1500)
    // 立即查询一次
    poll()
  }

  const handleRefreshDictionary = async () => {
    if (refreshing) return
    setRefreshing(true)
    setRefreshProgress(null)
    try {
      // 异步刷新：POST /refresh 返回 taskId，后台执行，前端轮询
      const res = await api.post<{ taskId: string; status: string; message: string }>(
        '/system/config/data-dictionary/refresh',
        undefined,
        { timeout: 10000 },
      )
      const taskId = res.data?.taskId
      if (!taskId) {
        // 兼容旧同步接口或频率限制返回的消息
        message.info(res.message || '刷新任务已提交')
        setRefreshing(false)
        return
      }
      // 初始化进度并启动轮询
      setRefreshProgress({
        taskId,
        status: res.data?.status as any || 'pending',
        totalTables: 0,
        processedTables: 0,
        currentTable: '',
        message: res.data?.message || '刷新任务已提交，等待执行...',
        progressPercent: 0,
      })
      startProgressPolling(taskId)
    } catch (err: any) {
      // 频率限制或错误：直接展示后端 message
      const msg = err.message || '更新数据字典失败'
      if (/频繁|rate|RATE_LIMITED|429|10042/.test(msg + (err.code || '') + (msg.includes('秒') ? 'Y' : ''))) {
        message.warning(msg)
      } else {
        message.error(msg)
      }
      setRefreshing(false)
    }
  }

  const tableColumns = [
    {
      title: '序号', key: 'index', width: 60,
      render: (_: any, __: any, index: number) => (query.page - 1) * query.pageSize + index + 1,
    },
    { title: '表名', dataIndex: 'table_name', key: 'table_name', width: 220, fixed: 'left' as const },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 100,
      render: (v: string) => <Tag color={categoryColorMap[v] || 'default'}>{v}</Tag>,
    },
    { title: '字段数', dataIndex: 'field_count', key: 'field_count', width: 80 },
    { title: '记录数', dataIndex: 'record_count', key: 'record_count', width: 100 },
    { title: '说明', dataIndex: 'purpose', key: 'purpose', ellipsis: true },
    {
      title: '最后更新', dataIndex: 'last_update', key: 'last_update', width: 160,
      render: formatDateTime,
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const,
      render: (_: any, record: DictRow) => (
        <Space size="small">
          <Button type="link" size="small" disabled={refreshing} onClick={() => handleViewDetail(record)}>结构</Button>
          <Button type="link" size="small" disabled={refreshing} onClick={() => handleViewRecords(record)}>记录</Button>
        </Space>
      ),
    },
  ]

  const categories = ['系统表', '基础数据表', '业务表']
  const interactiveDisabled = refreshing

  return (
    <>
      <ThreeSectionPage
        title="数据字典"
        breadcrumbs="系统管理 / 数据字典"
        stats={[
          { label: '数据表', value: total, icon: <TableOutlined />, color: '#2196F3' },
          { label: '系统表', value: tableList.filter(t => t.category === '系统表').length || 0, icon: <DatabaseOutlined />, color: '#00BCD4' },
          { label: '业务表', value: tableList.filter(t => t.category === '业务表').length || 0, icon: <TableOutlined />, color: '#FF9800' },
        ]}
        extra={
          refreshProgress && refreshing ? (
            <div style={{ flex: '1 1 100%', paddingTop: 8, paddingBottom: 4 }}>
              <Alert
                type={refreshProgress.status === 'failed' ? 'error' : 'info'}
                showIcon
                message={
                  <Space size={12} style={{ display: 'inline-flex', width: '100%' }}>
                    <span style={{ minWidth: 80 }}>字典刷新中</span>
                    <Progress
                      percent={refreshProgress.progressPercent || 0}
                      status={refreshProgress.status === 'failed' ? 'exception' : (refreshProgress.status === 'success' ? 'success' : 'active')}
                      style={{ flex: 1, minWidth: 360, maxWidth: 640 }}
                    />
                    <span style={{ color: '#666', fontSize: 12, minWidth: 380, maxWidth: 520, textAlign: 'left' }}>
                      {refreshProgress.message || '准备中...'}
                    </span>
                  </Space>
                }
              />
            </div>
          ) : undefined
        }
        filter={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              placeholder="搜索表名/说明"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onBlur={handleSearch}
              style={{ width: 220 }}
              allowClear
              disabled={interactiveDisabled}
            />
            <Select
              placeholder="表分类"
              value={categoryInput}
              onChange={v => { setCategoryInput(v); setTimeout(handleSearch, 0) }}
              allowClear
              style={{ width: 140 }}
              options={categories.map(c => ({ label: c, value: c }))}
              disabled={interactiveDisabled}
            />
            <Button onClick={handleReset} disabled={interactiveDisabled}>重置</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchTables} disabled={interactiveDisabled}>刷新</Button>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              loading={refreshing}
              onClick={handleRefreshDictionary}
              disabled={interactiveDisabled}
            >
              更新
            </Button>
          </div>
        }
        table={
          <ResizableTable tableKey="pages_system_DataDictionary"
            size="small"
            columns={tableColumns}
            dataSource={tableList}
            rowKey="dict_id"
            loading={loading || refreshing}
            scroll={{ x: 1100 }}
            pagination={{
              pageSize: query.pageSize,
              current: query.page,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (page, pageSize) => setQuery(q => ({ ...q, page, pageSize })),
              disabled: interactiveDisabled,
            }}
          />
        }
      />

      <Drawer
        title={currentTable?.table_name}
        placement="right"
        width={920}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        destroyOnClose
      >
        {currentTable && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="表名">{currentTable.table_name}</Descriptions.Item>
              <Descriptions.Item label="分类">
                <Tag color={categoryColorMap[currentTable.category]}>{currentTable.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="字段数">{currentTable.field_count}</Descriptions.Item>
              <Descriptions.Item label="记录数">{currentTable.record_count}</Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {formatDateTime(currentTable.last_update)}
              </Descriptions.Item>
              <Descriptions.Item label="说明" span={2}>{currentTable.purpose || '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ fontWeight: 600, marginBottom: 8 }}>字段明细</div>
            <ResizableTable tableKey="pages_system_DataDictionary"
              size="small"
              columns={[
                { title: '序号', key: 'idx', width: 50, render: (_: any, __: any, i: number) => i + 1 },
                { title: '字段名', dataIndex: 'name', key: 'name', width: 180 },
                { title: '类型', dataIndex: 'type', key: 'type', width: 140 },
                { title: '可空', dataIndex: 'nullable', key: 'nullable', width: 60, render: (v: boolean) => v ? '是' : '否' },
                { title: '主键', dataIndex: 'primaryKey', key: 'primaryKey', width: 60, render: (v: boolean) => v ? <Tag color="blue">是</Tag> : '否' },
                { title: '默认值', dataIndex: 'defaultValue', key: 'defaultValue', width: 100, render: (v: any) => v ?? '-' },
                { title: '说明', dataIndex: 'comment', key: 'comment' },
              ]}
              dataSource={columns}
              rowKey="name"
              pagination={false}
              scroll={{ x: 800, y: 400 }}
            />
          </>
        )}
      </Drawer>

      <Drawer
        title={`${recordsTable?.table_name || ''} - 记录`}
        placement="right"
        width={1100}
        open={recordsVisible}
        onClose={() => setRecordsVisible(false)}
        destroyOnClose
      >
        {recordsTable && (
          <>
            <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="表名">{recordsTable.table_name}</Descriptions.Item>
              <Descriptions.Item label="记录数">{recordsTotal}</Descriptions.Item>
              <Descriptions.Item label="说明">{recordsTable.purpose || '-'}</Descriptions.Item>
            </Descriptions>
            <ResizableTable tableKey="pages_system_DataDictionary"
              size="small"
              columns={(recordFields.length ? recordFields : Object.keys(recordsData[0] || {}).map(name => ({ name }))).map((f: any) => ({
                title: (
                  <div style={{ lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 600 }}>{f.name}</div>
                    {f.comment && <div style={{ fontSize: 12, color: '#888', whiteSpace: 'normal' }}>{f.comment}</div>}
                  </div>
                ),
                dataIndex: f.name,
                key: f.name,
                width: 160,
                ellipsis: true,
                render: (v: any) => {
                  if (v === null || v === undefined) return <span style={{ color: '#bbb' }}>-</span>
                  if (typeof v === 'object') return JSON.stringify(v)
                  return String(v)
                },
              }))}
              dataSource={recordsData}
              rowKey={(_: any, i: number) => i}
              loading={recordsLoading}
              scroll={{ x: 'max-content', y: 500 }}
              pagination={{
                current: recordsPage,
                pageSize: recordsPageSize,
                total: recordsTotal,
                showSizeChanger: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (page, pageSize) => handleViewRecords(recordsTable, page, pageSize),
              }}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
