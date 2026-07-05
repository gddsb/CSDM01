import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Drawer, Space, Popconfirm, message, Descriptions, Row, Col } from 'antd'
import {
  ProfileOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlusOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons, getQuickFilterRange } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const MaterialManagement = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const [keywordInput, setKeywordInput] = useState('')
  const [isActiveInput, setIsActiveInput] = useState(undefined)
  const [categoryInput, setCategoryInput] = useState(undefined)
  const [query, setQuery] = useState(() => {
    const { dateStart, dateEnd } = getQuickFilterRange('month')
    return { page: 1, pageSize: 30, keyword: '', is_active: undefined, category_name: undefined, dateStart, dateEnd }
  })

  const handleQuickFilterChange = (val) => {
    const { dateStart, dateEnd } = getQuickFilterRange(val)
    setQuery(q => ({ ...q, page: 1, dateStart, dateEnd }))
  }

  const activeCount = data.filter(m => m.is_active).length
  const inactiveCount = data.filter(m => !m.is_active).length

  const stats = [
    { label: '料品总数', value: total, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '生效', value: activeCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '失效', value: inactiveCount, icon: <CloseCircleOutlined />, color: '#F44336' },
  ]

  const categoryOptions = [...new Set(data.map(m => m.category_name).filter(Boolean))].map(c => ({ label: c, value: c }))

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.is_active !== undefined && query.is_active !== null) params.is_active = query.is_active
        if (query.category_name) params.category_name = query.category_name
        if (query.dateStart) params.dateStart = query.dateStart
        if (query.dateEnd) params.dateEnd = query.dateEnd
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
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, is_active: isActiveInput, category_name: categoryInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setIsActiveInput(undefined)
    setCategoryInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', is_active: undefined, category_name: undefined }))
  }

  const handleAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalOpen(true)
  }

  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        category_name: editing.category_name,
        material_code: editing.material_code,
        material_name: editing.material_name,
        specification: editing.specification,
        unit_name: editing.unit_name,
        film_no: editing.film_no,
        version_no: editing.version_no,
        cutting_size: editing.cutting_size,
        printing_process: editing.printing_process,
        color_separation: editing.color_separation,
        blanking_diameter: editing.blanking_diameter,
        material_thickness: editing.material_thickness,
        material_width: editing.material_width,
        material_height: editing.material_height,
        scrap_weight: editing.scrap_weight,
        unit_weight: editing.unit_weight,
        unit_volume: editing.unit_volume,
        weight_unit: editing.weight_unit,
        volume_unit: editing.volume_unit,
        inventory_category: editing.inventory_category,
        unit_code: editing.unit_code,
        is_active: editing.is_active,
        effective_date: editing.effective_date ? editing.effective_date.substring(0, 16) : '',
        expiry_date: editing.expiry_date ? editing.expiry_date.substring(0, 16) : '',
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ is_active: true })
    }
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
    { title: '分类名称', dataIndex: 'category_name', key: 'category_name', width: 100 },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130 },
    { title: '品名', dataIndex: 'material_name', key: 'material_name' },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 120 },
    { title: '单位名称', dataIndex: 'unit_name', key: 'unit_name', width: 80 },
    { title: '菲林编号', dataIndex: 'film_no', key: 'film_no', width: 100 },
    { title: '版本号', dataIndex: 'version_no', key: 'version_no', width: 80 },
    {
      title: '是否生效', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: v => <Tag color={v ? 'green' : 'red'}>{v ? '生效' : '失效'}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 180,
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
      options: [{ label: '生效', value: true }, { label: '失效', value: false }],
      value: isActiveInput, onChange: v => setIsActiveInput(v),
    },
    { type: 'select', placeholder: '分类名称筛选', options: categoryOptions, col: { span: 6 }, value: categoryInput, onChange: v => setCategoryInput(v) },
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
        onQuickFilterChange={handleQuickFilterChange}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
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
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={800}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="category_name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
                <Input placeholder="请输入分类名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="material_code" label="料号" rules={[{ required: true, message: '请输入料号' }]}>
                <Input placeholder="请输入料号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="material_name" label="品名" rules={[{ required: true, message: '请输入品名' }]}>
                <Input placeholder="请输入品名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="specification" label="规格">
                <Input placeholder="请输入规格" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit_name" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
                <Input placeholder="请输入单位名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="film_no" label="菲林编号">
                <Input placeholder="请输入菲林编号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="version_no" label="版本号">
                <Input placeholder="请输入版本号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cutting_size" label="开料尺寸">
                <Input placeholder="请输入开料尺寸" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="printing_process" label="印刷工艺">
                <Input placeholder="请输入印刷工艺" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="color_separation" label="分色信息">
                <Input placeholder="请输入分色信息" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="blanking_diameter" label="落料直径">
                <Input placeholder="请输入落料直径" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="material_thickness" label="材料厚度">
                <Input placeholder="请输入材料厚度" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="material_width" label="材料宽度">
                <Input placeholder="请输入材料宽度" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="material_height" label="材料高度">
                <Input placeholder="请输入材料高度" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="scrap_weight" label="边角料重量">
                <Input placeholder="请输入边角料重量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="unit_weight" label="库存单位重量">
                <Input placeholder="请输入库存单位重量" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit_volume" label="库存单位体积">
                <Input placeholder="请输入库存单位体积" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weight_unit" label="重量单位">
                <Input placeholder="请输入重量单位" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="volume_unit" label="体积单位">
                <Input placeholder="请输入体积单位" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inventory_category" label="存货分类">
                <Input placeholder="请输入存货分类" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit_code" label="单位编码">
                <Input placeholder="请输入单位编码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="is_active" label="是否生效" rules={[{ required: true, message: '请选择是否生效' }]}>
                <Select placeholder="请选择" options={[{ label: '生效', value: true }, { label: '失效', value: false }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="effective_date" label="生效日期" rules={[{ required: true, message: '请选择生效日期' }]}>
                <Input type="datetime-local" placeholder="请选择生效日期" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="expiry_date" label="失效日期" rules={[{ required: true, message: '请选择失效日期' }]}>
                <Input type="datetime-local" placeholder="请选择失效日期" />
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
            <Descriptions.Item label="分类名称">{current.category_name}</Descriptions.Item>
            <Descriptions.Item label="料号">{current.material_code}</Descriptions.Item>
            <Descriptions.Item label="品名">{current.material_name}</Descriptions.Item>
            <Descriptions.Item label="规格">{current.specification || '-'}</Descriptions.Item>
            <Descriptions.Item label="单位名称">{current.unit_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="菲林编号">{current.film_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="版本号">{current.version_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="开料尺寸">{current.cutting_size || '-'}</Descriptions.Item>
            <Descriptions.Item label="印刷工艺">{current.printing_process || '-'}</Descriptions.Item>
            <Descriptions.Item label="分色信息">{current.color_separation || '-'}</Descriptions.Item>
            <Descriptions.Item label="落料直径">{current.blanking_diameter || '-'}</Descriptions.Item>
            <Descriptions.Item label="材料厚度">{current.material_thickness || '-'}</Descriptions.Item>
            <Descriptions.Item label="材料宽度">{current.material_width || '-'}</Descriptions.Item>
            <Descriptions.Item label="材料高度">{current.material_height || '-'}</Descriptions.Item>
            <Descriptions.Item label="边角料重量">{current.scrap_weight || '-'}</Descriptions.Item>
            <Descriptions.Item label="库存单位重量">{current.unit_weight || '-'}</Descriptions.Item>
            <Descriptions.Item label="库存单位体积">{current.unit_volume || '-'}</Descriptions.Item>
            <Descriptions.Item label="重量单位">{current.weight_unit || '-'}</Descriptions.Item>
            <Descriptions.Item label="体积单位">{current.volume_unit || '-'}</Descriptions.Item>
            <Descriptions.Item label="存货分类">{current.inventory_category || '-'}</Descriptions.Item>
            <Descriptions.Item label="单位编码">{current.unit_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="是否生效"><Tag color={current.is_active ? 'green' : 'red'}>{current.is_active ? '生效' : '失效'}</Tag></Descriptions.Item>
            <Descriptions.Item label="生效日期">{current.effective_date?.substring(0, 16) || '-'}</Descriptions.Item>
            <Descriptions.Item label="失效日期">{current.expiry_date?.substring(0, 16) || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}

export default MaterialManagement