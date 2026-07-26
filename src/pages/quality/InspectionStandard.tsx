import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, Typography, Row, Col, Drawer, Descriptions, Popconfirm, InputNumber, message as antMsg } from 'antd'
import { useMessage } from '../../contexts/AppContext'
import {
  FileProtectOutlined, AppstoreOutlined, SolutionOutlined,
  CheckCircleOutlined, SearchOutlined, PlusOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, ReloadOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

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

const categoryOptions = [
  { label: '外观', value: '外观' },
  { label: '尺寸', value: '尺寸' },
  { label: '性能', value: '性能' },
  { label: '理化', value: '理化' },
  { label: '微生物', value: '微生物' },
  { label: '环境', value: '环境' },
]

const typeColorMap: Record<string, string> = {
  '首件': 'blue', '制程': 'purple', '成品': 'green', '其它': 'default',
}

export default function InspectionStandard() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const [keyword, setKeyword] = useState('')
  const [inspectionType, setInspectionType] = useState<any>(undefined)
  const [standardType, setStandardType] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<any>(undefined)

  const [modalVisible, setModalVisible] = useState(false)
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [current, setCurrent] = useState<any>(null)
  const [currentItems, setCurrentItems] = useState<any[]>([])
  const [form] = Form.useForm()
  const [itemForm] = Form.useForm()
  const [itemModalVisible, setItemModalVisible] = useState(false)
  const [itemEditing, setItemEditing] = useState<any>(null)
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

  const handleAdd = () => {
    setEditing(null)
    setCurrentItems([])
    form.resetFields()
    form.setFieldsValue({
      inspection_type: '首件',
      standard_type: '通用标准',
      status: '开立',
      version_no: 'V1',
    })
    setModalVisible(true)
  }

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

  const handleEdit = async (record: any) => {
    setEditing(record)
    form.resetFields()
    try {
      const res = await api.get(`/basic/standards/${record.standard_id}`)
      const detail = res.data || record
      setCurrentItems(detail.items || [])
    } catch (e) {
      setCurrentItems([])
    }
    form.setFieldsValue({
      standard_no: record.standard_no,
      standard_name: record.standard_name,
      inspection_type: record.inspection_type,
      standard_type: record.standard_type,
      material_id: record.material_id || undefined,
      version_no: record.version_no,
      status: record.status,
      description: record.description,
    })
    setModalVisible(true)
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

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        items: currentItems,
      }
      if (editing) {
        await api.put(`/basic/standards/${editing.standard_id}`, payload)
        message.success('编辑成功')
      } else {
        await api.post('/basic/standards', payload)
        message.success('新增成功')
      }
      setModalVisible(false)
      fetchData()
    } catch (e: any) {
      if (e?.message?.includes('validate')) return
      message.error(e?.message || '保存失败')
    }
  }

  const handleAddItem = () => {
    setItemEditing(null)
    itemForm.resetFields()
    itemForm.setFieldsValue({
      category: '外观',
      sort_order: currentItems.length + 1,
    })
    setItemModalVisible(true)
  }

  const handleEditItem = (record: any) => {
    setItemEditing(record)
    itemForm.setFieldsValue({
      item_name: record.item_name,
      category: record.category,
      method: record.method,
      sample_rule: record.sample_rule,
      standard_value: record.standard_value,
      unit: record.unit,
      sort_order: record.sort_order,
    })
    setItemModalVisible(true)
  }

  const handleDeleteItem = (record: any) => {
    setCurrentItems(prev => prev.filter((i: any) => i._key !== record._key && i.item_id !== record.item_id))
    antMsg.success('已删除')
  }

  const handleItemSubmit = async () => {
    try {
      const values = await itemForm.validateFields()
      if (itemEditing) {
        setCurrentItems(prev => prev.map((i: any) =>
          (i._key === itemEditing._key || i.item_id === itemEditing.item_id)
            ? { ...i, ...values }
            : i
        ))
      } else {
        setCurrentItems(prev => [...prev, { ...values, _key: 'new_' + Date.now() }])
      }
      setItemModalVisible(false)
    } catch (e) {
    }
  }

  const columns = [
    { title: '标准号', dataIndex: 'standard_no', key: 'standard_no', width: 160 },
    { title: '标准名称', dataIndex: 'standard_name', key: 'standard_name' },
    {
      title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 90,
      render: (v: string) => <Tag color={typeColorMap[v] || 'default'}>{v}</Tag>
    },
    {
      title: '标准类型', dataIndex: 'standard_type', key: 'standard_type', width: 100,
      render: (v: string) => <Tag color={v === '通用标准' ? 'blue' : v === '专用标准' ? 'orange' : 'purple'}>{v}</Tag>
    },
    { title: '版本号', dataIndex: 'version_no', key: 'version_no', width: 80 },
    { title: '生效日期', dataIndex: 'effective_date', key: 'effective_date', width: 110, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => {
        const colorMap: Record<string, string> = { '开立': 'default', '生效': 'success', '失效': 'error' }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      }
    },
    {
      title: '操作', key: 'action', width: 220, fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          {record.status === '开立' && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          )}
          {record.status === '开立' && (
            <Popconfirm title="确认删除？删除后不可恢复" onConfirm={() => handleDelete(record)} okText="确认" cancelText="取消">
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ]

  const itemTableColumns = [
    { title: '项目名称', dataIndex: 'item_name', key: 'item_name' },
    {
      title: '大类', dataIndex: 'category', key: 'category', width: 90,
      render: (v: string) => <Tag color={categoryColor[v] || 'default'}>{v}</Tag>
    },
    { title: '检验方法', dataIndex: 'method', key: 'method' },
    { title: '抽样方式', dataIndex: 'sample_rule', key: 'sample_rule', width: 140 },
    { title: '标准值', dataIndex: 'standard_value', key: 'standard_value', width: 140 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
  ]

  const itemTableColumnsWithAction = [
    ...itemTableColumns,
    {
      title: '操作', key: 'action', width: 140, fixed: 'right',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEditItem(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDeleteItem(record)}>删除</Button>
        </Space>
      )
    },
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
      <Modal
        title={editing ? '编辑检验标准' : '新增检验标准'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={900}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="standard_no" label="标准编号" rules={[{ required: true, message: '请输入标准编号' }]}>
                <Input placeholder="请输入标准编号" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select placeholder="请选择检验类型" options={inspectionTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="standard_type" label="标准类型" rules={[{ required: true, message: '请选择标准类型' }]}>
                <Select placeholder="请选择标准类型" options={standardTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="version_no" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
                <Input placeholder="如 V1" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} disabled />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="standard_name" label="标准名称" rules={[{ required: true, message: '请输入标准名称' }]}>
                <Input placeholder="请输入标准名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="description" label="描述">
                <Input.TextArea placeholder="请输入描述" rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>检验项目列表</Typography.Title>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddItem}>新增项目</Button>
        </div>
        <ResizableTable
          tableKey="pages_quality_InspectionStandard_items_edit"
          columns={itemTableColumnsWithAction}
          dataSource={currentItems}
          rowKey={(r: any) => r._key || r.item_id}
          size="small"
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: '暂无检验项目，点击右上角"新增项目"添加' }}
        />
      </Modal>
      <Modal
        title={itemEditing ? '编辑检验项目' : '新增检验项目'}
        open={itemModalVisible}
        onOk={handleItemSubmit}
        onCancel={() => setItemModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={itemForm} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="item_name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="category" label="项目大类" rules={[{ required: true, message: '请选择项目大类' }]}>
                <Select placeholder="请选择项目大类" options={categoryOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="standard_value" label="标准值" rules={[{ required: true, message: '请输入标准值' }]}>
                <Input placeholder="如 90.0±0.3、≥200 等" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
                <Input placeholder="如 mm、N、%等，无则填 -" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="method" label="检验方法">
                <Input placeholder="如 游标卡尺测量、拉力试验机等" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="sample_rule" label="抽样方式">
                <Input placeholder="如 AQL 0.65、每批5个等" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="sort_order" label="排序号">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
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
              <Descriptions.Item label="生效日期">{current.effective_date ? dayjs(current.effective_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label="标准名称" span={2}>{current.standard_name}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{current.description || '-'}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} style={{ marginTop: 8 }}>检验项目</Typography.Title>
            <ResizableTable
              tableKey="pages_quality_InspectionStandard_items_view"
              columns={itemTableColumns}
              dataSource={currentItems}
              rowKey="item_id"
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
