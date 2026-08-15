import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback } from 'react'
import { Tag, Button, Space, Input, Select, Row, Col, Drawer, Descriptions, Popconfirm, Checkbox } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useMessage, useApp } from '../../contexts/AppContext'
import {
  FileProtectOutlined, AppstoreOutlined, SolutionOutlined,
  CheckCircleOutlined, SearchOutlined, PlusOutlined, ReloadOutlined,
  CopyOutlined, BranchesOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { ColumnsType } from 'antd/es/table'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { formatDate } from '../../utils'

const categoryColor: Record<string, string> = { '感官要求': 'blue', '尺寸要求': 'cyan', '理化性能要求': 'purple', '微生物检测要求': 'green', '环境检测要求': 'geekblue', '其它要求': 'default' }

const inspectionTypeOptions = [
  { label: '首件', value: '首件' },
  { label: '制程', value: '制程' },
  { label: '成品', value: '成品' },
  { label: '来料', value: '来料' },
  { label: '其它', value: '其它' },
]

const standardTypeOptions = [
  { label: '材料检验', value: '材料检验' },
  { label: '产品检验', value: '产品检验' },
  { label: '环境检验', value: '环境检验' },
  { label: '微生物检验标准', value: '微生物检验标准' },
  { label: '其它检验', value: '其它检验' },
]

const statusOptions = [
  { label: '开立', value: '开立' },
  { label: '生效', value: '生效' },
  { label: '失效', value: '失效' },
]

const standardTypeColorMap: Record<string, string> = {
  '材料检验': 'blue', '产品检验': 'orange', '环境检验': 'cyan', '微生物检验标准': 'green', '其它检验': 'default',
}

const typeColorMap: Record<string, string> = {
  '首件': 'blue', '制程': 'purple', '成品': 'green', '来料': 'cyan', '其它': 'default',
}

export default function InspectionStandard() {
  const navigate = useNavigate()
  const { hasPermission } = useApp()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const [keyword, setKeyword] = useState('')
  const [standardType, setStandardType] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<any>(['开立', '生效'])

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [currentItems, setCurrentItems] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const message = useMessage()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (keyword) params.keyword = keyword
      if (standardType) params.standard_type = standardType
      if (Array.isArray(statusFilter) && statusFilter.length) params.status = statusFilter.join(',')
      else if (statusFilter && !Array.isArray(statusFilter)) params.status = statusFilter
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
  }, [pagination.current, pagination.pageSize, keyword, standardType, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const materialCount = data.filter(s => s.standard_type === '材料检验').length
  const productCount = data.filter(s => s.standard_type === '产品检验').length
  const microbeCount = data.filter(s => s.standard_type === '微生物检验标准').length
  const effectiveCount = data.filter(s => s.status === '生效').length

  const stats: StatItem[] = [
    { label: '标准总数', value: pagination.total, icon: <FileProtectOutlined />, color: '#2196F3' },
    { label: '材料检验', value: materialCount, icon: <AppstoreOutlined />, color: '#00BCD4' },
    { label: '产品检验', value: productCount, icon: <SolutionOutlined />, color: '#FF9800' },
    { label: '微生物检验', value: microbeCount, icon: <SolutionOutlined />, color: '#9C27B0' },
    { label: '生效中', value: effectiveCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const handleAdd = () => navigate('/quality/standards/new')
  const handleEdit = (record: any) => navigate(`/quality/standards/${record.standard_id}/edit`)

  const handleView = async (record: any) => {
    setCurrent(record)
    setVersions([])
    try {
      const res = await api.get(`/basic/standards/${record.standard_id}`)
      const detail = res.data || record
      setCurrent(detail)
      setCurrentItems(detail.items || [])
      // 获取同标准号的所有版本
      if (detail.standard_no) {
        const verRes = await api.get('/basic/standards', {
          params: { standard_no: detail.standard_no, page: 1, page_size: 100 }
        })
        const verList = verRes.data?.list || verRes.data || []
        verList.sort((a: any, b: any) => (b.version_no || '').localeCompare(a.version_no || ''))
        setVersions(verList)
      }
    } catch (e) {
      setCurrentItems([])
    }
    setViewDrawerOpen(true)
  }

  const handleSwitchVersion = async (record: any) => {
    try {
      const res = await api.get(`/basic/standards/${record.standard_id}`)
      const detail = res.data || record
      setCurrent(detail)
      setCurrentItems(detail.items || [])
    } catch (e) {
      // 保持当前
    }
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

  const handleCopy = async (record: any) => {
    try {
      const res = await api.post(`/basic/standards/${record.standard_id}/copy`)
      if (res.success !== false) {
        message.success('复制成功，已生成新标准：' + (res.data?.standard_no || ''))
        fetchData()
      } else {
        message.error(res.message || '复制失败')
      }
    } catch (e: any) {
      message.error(e?.message || '复制失败')
    }
  }

  const handleRevise = async (record: any) => {
    try {
      const res = await api.post(`/basic/standards/${record.standard_id}/revise`)
      if (res.success !== false) {
        message.success('改版成功，新版本：' + (res.data?.version_no || ''))
        fetchData()
      } else {
        message.error(res.message || '改版失败')
      }
    } catch (e: any) {
      message.error(e?.message || '改版失败')
    }
  }

  const columns: ColumnsType<any> = [
    { title: '标准号', dataIndex: 'standard_no', key: 'standard_no', width: 160 },
    {
      title: '标准名称', dataIndex: 'standard_name', key: 'standard_name', width: 260,
      render: (v: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: 1.5 }}>{v}</div>
    },
    {
      title: '标准类型', dataIndex: 'standard_type', key: 'standard_type', width: 100,
      render: (v: string) => <Tag color={standardTypeColorMap[v] || 'default'}>{v}</Tag>
    },
    { title: '检验方案', dataIndex: 'inspection_plan', key: 'inspection_plan', width: 130, render: (v: string) => v || '-' },
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
      title: '操作', key: 'action', fixed: 'right', width: 150,
      render: (_: any, record: any) => (
        <Space size="small" wrap>
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
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name', width: 160, render: (v: string) => <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</span> },
    {
      title: '检验类型', dataIndex: 'inspection_types', key: 'inspection_types', width: 220,
      render: (v: string) => {
        if (!v) return '-'
        const types = v.split(',')
        return <Space wrap size={4}>{types.map(t => <Tag key={t} color={typeColorMap[t] || 'default'}>{t}</Tag>)}</Space>
      }
    },
    { title: '标准要求', dataIndex: 'standard_value', key: 'standard_value', width: 220, render: (v: string) => <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</span> },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: '缺陷等级', dataIndex: 'defect_level', key: 'defect_level', width: 130,
      render: (v: string) => {
        const colorMap: any = { 'A类致命缺陷': 'red', 'B类严重缺陷': 'orange', 'C类次要缺陷': 'blue' }
        return v ? <Tag color={colorMap[v] || 'default'}>{v}</Tag> : '-'
      }
    },
    { title: '检验方法', dataIndex: 'method', key: 'method', width: 180, render: (v: string) => <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</span> },
    { title: '抽样方式', dataIndex: 'sample_rule', key: 'sample_rule', width: 180, render: (v: string) => <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</span> },
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
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }} align="middle">
              <Col flex="220px">
                <Input
                  placeholder="标准号 / 标准名称"
                  prefix={<SearchOutlined />}
                  allowClear
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />
              </Col>
              <Col flex="160px">
                <Select
                  placeholder="标准类型"
                  allowClear
                  style={{ width: '100%' }}
                  options={standardTypeOptions}
                  value={standardType}
                  onChange={setStandardType}
                />
              </Col>
              <Col>
                <Space size="middle">
                  <span style={{ whiteSpace: 'nowrap', color: '#666' }}>状态：</span>
                  <Checkbox.Group
                    value={statusFilter}
                    onChange={(v: any) => setStatusFilter(v as string[])}
                    options={statusOptions.map(opt => ({ label: opt.label, value: opt.value }))}
                  />
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => {
                    setKeyword(''); setStandardType(undefined); setStatusFilter(['开立', '生效'])
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
              scroll={{ x: 1400 }}
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
        extra={
          current?.status === '生效' && (hasPermission('quality:standard:copy') || hasPermission('quality:standard:revise')) ? (
            <Space>
              {hasPermission('quality:standard:copy') && (
                <Popconfirm title="确认复制？将生成一份新的检验标准（新标准号，状态为开立）" onConfirm={() => handleCopy(current)} okText="确认" cancelText="取消">
                  <Button icon={<CopyOutlined />}>复制</Button>
                </Popconfirm>
              )}
              {hasPermission('quality:standard:revise') && (
                <Popconfirm title="确认改版？将生成新版本（标准号不变，版本号+1，状态为开立）" onConfirm={() => handleRevise(current)} okText="确认" cancelText="取消">
                  <Button type="primary" icon={<BranchesOutlined />}>改版</Button>
                </Popconfirm>
              )}
            </Space>
          ) : null
        }
      >
        {current && (
          <>
            {versions.length > 1 && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
                <Space wrap>
                  <span style={{ color: '#666', fontSize: 13 }}>版本切换：</span>
                  {versions.map((v) => {
                    const isActive = v.standard_id === current?.standard_id
                    return (
                      <Tag
                        key={v.standard_id}
                        style={{
                          cursor: 'pointer',
                          padding: '2px 10px',
                          fontSize: 13,
                          ...(isActive ? { background: '#e6f4ff', borderColor: '#69b1ff', fontWeight: 600 } : {})
                        }}
                        onClick={() => handleSwitchVersion(v)}
                      >
                        {v.version_no}
                        <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({v.status})</span>
                      </Tag>
                    )
                  })}
                </Space>
              </div>
            )}
            <Descriptions 
              column={2} 
              size="small" 
              bordered 
              style={{ marginBottom: 16 }}
              labelStyle={{ width: 96, textAlign: 'right', whiteSpace: 'nowrap' }}
            >
              <Descriptions.Item label="标准编号">{current.standard_no}</Descriptions.Item>
              <Descriptions.Item label="版本号">{current.version_no}</Descriptions.Item>
              <Descriptions.Item label="标准类型">
                <Tag color={standardTypeColorMap[current.standard_type] || 'default'}>{current.standard_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验方案">{current.inspection_plan || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={current.status === '生效' ? 'success' : current.status === '失效' ? 'error' : 'default'}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="生效日期">{formatDate(current.effective_date)}</Descriptions.Item>
              <Descriptions.Item label="参照料品">
                {current.material
                  ? `${current.material.material_code} ${current.material.material_name}`
                  : (current.material_name ? `${current.material_name}` : '-')}
              </Descriptions.Item>
              <Descriptions.Item label="标准名称" span={2}>
                {current.standard_no} {current.standard_name} ({current.version_no})
              </Descriptions.Item>
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
              scroll={{ x: 1400 }}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
