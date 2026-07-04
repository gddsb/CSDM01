import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Drawer, Space, Popconfirm, message, Descriptions, Row, Col } from 'antd'
import {
  ProfileOutlined, CheckCircleOutlined, ExperimentOutlined, StopOutlined,
  PlusOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

// 状态标签颜色映射
const statusColorMap = { '启用': 'green', '试产': 'orange', '停产': 'red' }
const statusOptions = ['启用', '试产', '停产'].map(s => ({ label: s, value: s }))

export default function MaterialManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  const [categoryInput, setCategoryInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', status: undefined, category_code: undefined })

  const enabledCount = data.filter(m => m.status === '启用').length
  const trialCount = data.filter(m => m.status === '试产').length
  const stoppedCount = data.filter(m => m.status === '停产').length

  const stats = [
    { label: '料品总数', value: total, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '启用', value: enabledCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '试产', value: trialCount, icon: <ExperimentOutlined />, color: '#FF9800' },
    { label: '停产', value: stoppedCount, icon: <StopOutlined />, color: '#F44336' },
  ]

  const categoryOptions = [...new Set(data.map(m => m.category_code).filter(Boolean))].map(c => ({ label: c, value: c }))

  // 获取列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status !== undefined && query.status !== null) params.status = query.status
        if (query.category_code) params.category_code = query.category_code
        const res = await api.get('/basic/materials', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取料品列表失败')
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

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput, category_code: categoryInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setCategoryInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, category_code: undefined }))
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: '启用', min_safety_stock: 0, max_safety_stock: 0 })
    setModalOpen(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      material_code: record.material_code,
      material_name: record.material_name,
      specification: record.specification,
      film_version: record.film_version,
      version_no: record.version_no,
      category_code: record.category_code,
      category_name: record.category_name,
      customer_code: record.customer_code,
      customer_name: record.customer_name,
      unit: record.unit,
      min_safety_stock: record.min_safety_stock,
      max_safety_stock: record.max_safety_stock,
      status: record.status,
    })
    setModalOpen(true)
  }

  const handleDetail = (record) => {
    setCurrent(record)
    setDetailOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      if (editing) {
        const res = await api.put(`/basic/materials/${editing.material_id}`, payload)
        message.success(res.message || '料品编辑成功')
      } else {
        const res = await api.post('/basic/materials', payload)
        message.success(res.message || '料品新增成功')
      }
      setModalOpen(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record) => {
    try {
      const res = await api.delete(`/basic/materials/${record.material_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130 },
    { title: '品名', dataIndex: 'material_name', key: 'material_name' },
    { title: '规格', dataIndex: 'specification', key: 'specification' },
    { title: '菲林版本', dataIndex: 'film_version', key: 'film_version', width: 120 },
    { title: '版本号', dataIndex: 'version_no', key: 'version_no', width: 80 },
    { title: '分类', dataIndex: 'category_name', key: 'category_name', width: 90 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 110 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    {
      title: '安全库存', key: 'safety_stock', width: 150,
      render: (_, r) => {
        const min = Number(r.min_safety_stock || 0)
        const max = Number(r.max_safety_stock || 0)
        return `${min.toLocaleString()} - ${max.toLocaleString()}`
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleDetail(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该料品？"
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const filters = [
    { type: 'input', placeholder: '搜索料号/品名/规格', col: { span: 6 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: [{ label: '启用', value: 1 }, { label: '试产', value: 2 }, { label: '停产', value: 0 }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
    { type: 'select', placeholder: '分类编码筛选', options: categoryOptions, col: { span: 6 }, value: categoryInput, onChange: v => setCategoryInput(v) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="料品档案"
        breadcrumbs="基础数据 / 料品档案"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="reload" icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>,
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增料品</Button>,
            ]}
          />
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="material_id"
            size="small"
            loading={loading}
            scroll={{ x: 1200 }}
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
      <Modal
        title={editing ? '编辑料品' : '新增料品'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="material_code" label="料号" rules={[{ required: true, message: '请输入料号' }]}>
                <Input placeholder="请输入料号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="material_name" label="品名" rules={[{ required: true, message: '请输入品名' }]}>
                <Input placeholder="请输入品名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="specification" label="规格">
                <Input placeholder="请输入规格" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="film_version" label="菲林版本">
                <Input placeholder="请输入菲林版本" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="version_no" label="版本号">
                <Input placeholder="请输入版本号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category_name" label="分类">
                <Input placeholder="请输入分类" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="category_code" label="分类编码">
                <Input placeholder="请输入分类编码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customer_code" label="客户编码">
                <Input placeholder="请输入客户编码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="customer_name" label="客户名称">
                <Input placeholder="请输入客户名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
                <Input placeholder="请输入单位" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="min_safety_stock" label="最小安全库存">
                <Input placeholder="请输入最小安全库存" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_safety_stock" label="最大安全库存">
                <Input placeholder="请输入最大安全库存" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Drawer
        title="料品详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
      >
        {current && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="料号">{current.material_code}</Descriptions.Item>
            <Descriptions.Item label="品名">{current.material_name}</Descriptions.Item>
            <Descriptions.Item label="规格">{current.specification || '-'}</Descriptions.Item>
            <Descriptions.Item label="菲林版本">{current.film_version || '-'}</Descriptions.Item>
            <Descriptions.Item label="版本号">{current.version_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="分类编码">{current.category_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="分类">{current.category_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户编码">{current.customer_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户名称">{current.customer_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="单位">{current.unit || '-'}</Descriptions.Item>
            <Descriptions.Item label="最小安全库存">{Number(current.min_safety_stock || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="最大安全库存">{Number(current.max_safety_stock || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[current.status]}>{current.status}</Tag></Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
