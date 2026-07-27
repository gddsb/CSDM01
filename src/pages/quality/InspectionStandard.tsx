import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback } from 'react'
import { Tag, Button, Space, Input, Select, Row, Col, Drawer, Descriptions, Popconfirm } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useMessage } from '../../contexts/AppContext'
import {
  FileProtectOutlined, AppstoreOutlined, SolutionOutlined,
  CheckCircleOutlined, SearchOutlined, PlusOutlined, ReloadOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { formatDate } from '../../utils'

const categoryColor: Record<string, string> = { '外观': 'blue', '理化': 'purple', '尺寸': 'cyan', '性能': 'orange', '微生物': 'green', '环境': 'geekblue' }

const inspectionTypeOptions = [
  { label: '首件', value: '首件' },
  { label: '制程', value: '制程' },
  { label: '成品', value: '成品' },
  { label: '其它', value: '其它' },
]

const standardTypeOptions = [
  { label: '通用标准', value: '通用标准' },
  { label: '专用标准', value: '专用标准' },
  { label: '临时标准', value: '临时标准' },
]

const statusOptions = [
  { label: '开立', value: '开立' },
  { label: '生效', value: '生效' },
  { label: '失效', value: '失效' },
]

const typeColorMap: Record<string, string> = {
  '首件': 'blue', '制程': 'purple', '成品': 'green', '其它': 'default',
}

export default function InspectionStandard() {
  const navigate = useNavigate()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const [keyword, setKeyword] = useState('')
  const [inspectionType, setInspectionType] = useState<any>(undefined)
  const [standardType, setStandardType] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<any>(undefined)

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [currentItems, setCurrentItems] = useState<any[]>([])
  const message = useMessage()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (keyword) params.keyword = keyword
      if (inspectionType) params.inspection_type = inspectionType
      if (standardType) params.standard_type = standardType
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/basic/standards', { params })
      if (res.success !== false) {
        setData(res.data?.list || res.data || [])
        setPagination(p => ({ ...p, total: res.data?.total || res.total || 0 }))
      } else {
        setData([])
        setPagination(p => ({ ...p, total: 0 }))
      }
    } catch (e) {
      setData([])
      setPagination(p => ({ ...p, total: 0 }))
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, keyword, inspectionType, standardType, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const generalCount = data.filter(s => s.standard_type === '通用标准').length
  const dedicatedCount = data.filter(s => s.standard_type === '专用标准').length
  const tempCount = data.filter(s => s.standard_type === '临时标准').length
  const effectiveCount = data.filter(s => s.status === '生效').length

  const stats = [
    { label: '标准总数', value: pagination.total, icon: <FileProtectOutlined />, color: '#2196F3' },
    { label: '通用标准', value: generalCount, icon: <AppstoreOutlined />, color: '#00BCD4' },
    { label: '专用标准', value: dedicatedCount, icon: <SolutionOutlined />, color: '#FF9800' },
    { label: '临时标准', value: tempCount, icon: <SolutionOutlined />, color: '#9C27B0' },
    { label: '生效中', value: effectiveCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const handleAdd = () => navigate('/quality/standards/new')
  const handleEdit = (record: any) => navigate(`/quality/standards/${record.standard_id}/edit`)

  const handleView = async (record: any) => {
    setCurrent(record)
    try {
      const res = await api.get(`/basic/standards/${record.standard_id}`)
      const detail = res.data || record
      setCurrent(detail)
      setCurrentItems(detail.items || [])
    } catch (e) {
      setCurrentItems([])
    }
    setViewDrawerOpen(true)
  }

  const handleDelete = async (record: any) => {
    try {
      await api.delete(`/basic/standards/${record.standard_id}`)
      message.success('删除成功')
      fetchData()
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  const columns = [
    { title: '标准号', dataIndex: 'standard_no', key: 'standard_no', width: 160 },
    {
      title: '标准名称', dataIndex: 'standard_name', key: 'standard_name', width: 260,
      render: (v: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: 1.5 }}>{v}</div>
    },
    {
      title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 90,
      render: (v: string) => <Tag color={typeColorMap[v] || 'default'}>{v}</Tag>
    },
    {
      title: '标准类型', dataIndex: 'standard_type', key: 'standard_type', width: 100,
      render: (v: string) => <Tag color={v === '通用标准' ? 'blue' : v === '专用标准' ? 'orange' : 'purple'}>{v}</Tag>
    },
    { title: '版本号', dataIndex: 'version_no', key: 'version_no', width: 80 },
    { title: '生效日期', dataIndex: 'effective_date', key: 'effective_date', width: 110, render: formatDate },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => {
        const colorMap: Record<string, string> = { '开立': 'default', '生效': 'success', '失效': 'error' }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      }
    },
    {
      title: '操作', key: 'action', fixed: 'right', width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleView(record)}>查看</Button>
          {record.status === '开立' && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
          {record.status === '开立' && (
            <Popconfirm title="确认删除？删除后不可恢复" onConfirm={() => handleDelete(record)} okText="确认" cancelText="取消">
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ]

  const itemTableColumns = [
    {
      title: '项目大类', dataIndex: 'category', key: 'category', width: 100,
      render: (v: string) => <Tag color={categoryColor[v] || 'default'}>{v}</Tag>
    },
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name' },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    { title: '标准要求', dataIndex: 'standard_value', key: 'standard_value', width: 180 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
    {
      title: '缺陷等级', dataIndex: 'defect_level', key: 'defect_level', width: 120,
      render: (v: string) => {
        const colorMap: any = { 'A类致命缺陷': 'red', 'B类严重缺陷': 'orange', 'C类次要缺陷': 'blue' }
        return v ? <Tag color={colorMap[v] || 'default'}>{v}</Tag> : '-'
      }
    },
    { title: '检验方法', dataIndex: 'method', key: 'method' },
    { title: '抽样方式', dataIndex: 'sample_rule', key: 'sample_rule', width: 140 },
  ]

  return (
    <>
      <ThreeSectionPage
        title="检验标准"
        breadcrumbs="质量管理 / 检验标准"
        stats={stats}
        actions={<ActionButtons onAdd={handleAdd} />}
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Input
                placeholder="标准号 / 标准名称"
                prefix={<SearchOutlined />}
                allowClear
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="检验类型"
                  allowClear
                  style={{ width: '100%' }}
                  options={inspectionTypeOptions}
                  value={inspectionType}
                  onChange={setInspectionType}
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="标准类型"
                  allowClear
                  style={{ width: '100%' }}
                  options={standardTypeOptions}
                  value={standardType}
                  onChange={setStandardType}
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="状态"
                  allowClear
                  style={{ width: '100%' }}
                  options={statusOptions}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </Col>
              <Col span={6}>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => {
                    setKeyword(''); setInspectionType(undefined)
                    setStandardType(undefined); setStatusFilter(undefined)
                  }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <ResizableTable
              tableKey="pages_quality_InspectionStandard"
              columns={columns}
              dataSource={data}
              rowKey="standard_id"
              size="small"
              loading={loading}
              scroll={{ x: 1200 }}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
                onChange: (p, ps) => setPagination(v => ({ ...v, current: p, pageSize: ps })),
              }}
            />
          </div>
        }
      />
      <Drawer
        title={current ? `检验标准详情 - ${current.standard_no}` : '检验标准详情'}
        open={viewDrawerOpen}
        onClose={() => setViewDrawerOpen(false)}
        width={900}
        destroyOnHidden
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="标准编号">{current.standard_no}</Descriptions.Item>
              <Descriptions.Item label="版本号">{current.version_no}</Descriptions.Item>
              <Descriptions.Item label="检验类型">
                <Tag color={typeColorMap[current.inspection_type]}>{current.inspection_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标准类型">
                <Tag color={current.standard_type === '通用标准' ? 'blue' : current.standard_type === '专用标准' ? 'orange' : 'purple'}>{current.standard_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={current.status === '生效' ? 'success' : current.status === '失效' ? 'error' : 'default'}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="生效日期">{formatDate(current.effective_date)}</Descriptions.Item>
              <Descriptions.Item label="参照料品" span={2}>{current.material_name ? `${current.material_name} (ID: ${current.material_id})` : '-'}</Descriptions.Item>
              <Descriptions.Item label="标准名称" span={2}>{current.standard_name}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{current.description || '-'}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 8 }}>检验项目</div>
            <ResizableTable
              tableKey="pages_quality_InspectionStandard_items_view"
              columns={itemTableColumns}
              dataSource={currentItems}
              rowKey="item_id"
              size="small"
              pagination={false}
              scroll={{ x: 1200 }}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
