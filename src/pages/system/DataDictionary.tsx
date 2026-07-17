import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Input, Select, Space } from 'antd'
import { DatabaseOutlined, ReloadOutlined, SyncOutlined, TableOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import dayjs from 'dayjs'
import { useMessage } from '../../contexts/AppContext'

const categoryColorMap = {
  '系统表': 'blue',
  '基础数据表': 'green',
  '业务表': 'orange',
}

export default function DataDictionary() {
  const message = useMessage()
  const [tableList, setTableList] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentTable, setCurrentTable] = useState(null)
  const [columns, setColumns] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  // 表记录抽屉
  const [recordsVisible, setRecordsVisible] = useState(false)
  const [recordsTable, setRecordsTable] = useState(null)
  const [recordsData, setRecordsData] = useState([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsPageSize, setRecordsPageSize] = useState(20)
  const [recordFields, setRecordFields] = useState([])

  const [keywordInput, setKeywordInput] = useState('')
  const [categoryInput, setCategoryInput] = useState(undefined)
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', category: undefined })

  const fetchTables = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/system/config/data-dictionary', {
        params: { keyword: query.keyword, category: query.category, page: query.page, pageSize: query.pageSize },
      })
      const list = res.data?.list || []
      setTableList(list)
      setTotal(res.data?.total || 0)
    } catch (err) {
      message.error(err.message || '获取数据表清单失败')
      setTableList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, category: categoryInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setCategoryInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', category: undefined }))
  }

  const handleViewDetail = (record) => {
    setCurrentTable(record)
    setColumns(record.fields || [])
    setDetailVisible(true)
  }

  const handleViewRecords = async (record, page = 1, pageSize = 20) => {
    setRecordsTable(record)
    setRecordsVisible(true)
    setRecordsPage(page)
    setRecordsPageSize(pageSize)
    setRecordsLoading(true)
    try {
      const res = await api.get(`/system/config/data-dictionary/${record.table_name}/records`, {
        params: { page, pageSize },
      })
      setRecordsData(res.data?.list || [])
      setRecordsTotal(res.data?.total || 0)
      setRecordFields(res.data?.fields || [])
    } catch (err) {
      message.error(err.message || '获取表记录失败')
      setRecordsData([])
      setRecordsTotal(0)
    } finally {
      setRecordsLoading(false)
    }
  }

  const handleRefreshDictionary = async () => {
    setRefreshing(true)
    try {
      const res = await api.post('/system/config/data-dictionary/refresh')
      message.success(res.message || '数据字典更新成功')
      setQuery(q => ({ ...q, page: 1 }))
    } catch (err) {
      message.error(err.message || '更新数据字典失败')
    } finally {
      setRefreshing(false)
    }
  }

  const tableColumns = [
    {
      title: '序号', key: 'index', width: 60,
      render: (_, __, index) => (query.page - 1) * query.pageSize + index + 1,
    },
    { title: '表名', dataIndex: 'table_name', key: 'table_name', width: 220, fixed: 'left' },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 100,
      render: v => <Tag color={categoryColorMap[v] || 'default'}>{v}</Tag>,
    },
    { title: '字段数', dataIndex: 'field_count', key: 'field_count', width: 80 },
    { title: '记录数', dataIndex: 'record_count', key: 'record_count', width: 100 },
    { title: '说明', dataIndex: 'purpose', key: 'purpose', ellipsis: true },
    {
      title: '最后更新', dataIndex: 'last_update', key: 'last_update', width: 170,
      render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作', key: 'action', width: 130, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>结构</Button>
          <Button type="link" size="small" onClick={() => handleViewRecords(record)}>记录</Button>
        </Space>
      ),
    },
  ]

  const categories = ['系统表', '基础数据表', '业务表']

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
        filter={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              placeholder="搜索表名/说明"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onBlur={handleSearch}
              style={{ width: 220 }}
              allowClear
            />
            <Select
              placeholder="表分类"
              value={categoryInput}
              onChange={v => { setCategoryInput(v); setTimeout(handleSearch, 0) }}
              allowClear
              style={{ width: 140 }}
              options={categories.map(c => ({ label: c, value: c }))}
            />
            <Button onClick={handleReset}>重置</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchTables}>刷新</Button>
            <Button type="primary" icon={<SyncOutlined />} loading={refreshing} onClick={handleRefreshDictionary}>更新</Button>
          </div>
        }
        table={
          <Table
            size="small"
            columns={tableColumns}
            dataSource={tableList}
            rowKey="dict_id"
            loading={loading}
            scroll={{ x: 1100 }}
            pagination={{
              pageSize: query.pageSize,
              current: query.page,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (page, pageSize) => setQuery(q => ({ ...q, page, pageSize })),
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
                {currentTable.last_update ? dayjs(currentTable.last_update).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="说明" span={2}>{currentTable.purpose || '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ fontWeight: 600, marginBottom: 8 }}>字段明细</div>
            <Table
              size="small"
              columns={[
                { title: '序号', key: 'idx', width: 50, render: (_, __, i) => i + 1 },
                { title: '字段名', dataIndex: 'name', key: 'name', width: 180 },
                { title: '类型', dataIndex: 'type', key: 'type', width: 140 },
                { title: '可空', dataIndex: 'nullable', key: 'nullable', width: 60, render: v => v ? '是' : '否' },
                { title: '主键', dataIndex: 'primaryKey', key: 'primaryKey', width: 60, render: v => v ? <Tag color="blue">是</Tag> : '否' },
                { title: '默认值', dataIndex: 'defaultValue', key: 'defaultValue', width: 100, render: v => v ?? '-' },
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
            <Table
              size="small"
              columns={(recordFields.length ? recordFields : Object.keys(recordsData[0] || {}).map(name => ({ name }))).map(f => ({
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
                render: v => {
                  if (v === null || v === undefined) return <span style={{ color: '#bbb' }}>-</span>
                  if (typeof v === 'object') return JSON.stringify(v)
                  return String(v)
                },
              }))}
              dataSource={recordsData}
              rowKey={(_, i) => i}
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
