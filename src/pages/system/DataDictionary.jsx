import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Input, Select, Space, message } from 'antd'
import { DatabaseOutlined, EyeOutlined, ReloadOutlined, TableOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import dayjs from 'dayjs'

const categoryColorMap = {
  '系统表': 'blue',
  '基础数据表': 'green',
  '业务表': 'orange',
}

export default function DataDictionary() {
  const [tableList, setTableList] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentTable, setCurrentTable] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [columns, setColumns] = useState([])

  const [keywordInput, setKeywordInput] = useState('')
  const [categoryInput, setCategoryInput] = useState(undefined)
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', category: undefined })

  const fetchTables = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/system/config/database')
      const tables = res.data?.tables || []
      const filtered = tables.filter(t => {
        if (query.keyword) {
          const kw = query.keyword.toLowerCase()
          if (!t.table_name.toLowerCase().includes(kw) && !t.purpose?.toLowerCase().includes(kw)) {
            return false
          }
        }
        if (query.category && t.category !== query.category) {
          return false
        }
        return true
      })
      setTotal(filtered.length)
      const start = (query.page - 1) * query.pageSize
      const end = start + query.pageSize
      setTableList(filtered.slice(start, end))
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

  const handleViewDetail = async (record) => {
    setCurrentTable(record)
    setDetailVisible(true)
    setDetailLoading(true)
    try {
      const tableName = record.table_name
      const res = await api.get('/system/config/database')
      const allColumns = res.data?.columns || {}
      setColumns(allColumns[tableName] || [])
    } catch (err) {
      message.error(err.message || '获取表字段信息失败')
      setColumns([])
    } finally {
      setDetailLoading(false)
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
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>查看</Button>
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
          </div>
        }
        table={
          <Table
            size="small"
            columns={tableColumns}
            dataSource={tableList}
            rowKey="table_name"
            loading={loading}
            scroll={{ x: 1000 }}
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
        width={720}
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
                { title: '说明', dataIndex: 'comment', key: 'comment', ellipsis: true },
              ]}
              dataSource={columns}
              rowKey="name"
              loading={detailLoading}
              pagination={false}
              scroll={{ y: 400 }}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
