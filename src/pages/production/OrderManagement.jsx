import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, Row, Col, message, Drawer, Descriptions, Popconfirm } from 'antd'
import {
  FileTextOutlined, PlusOutlined, SearchOutlined, ReloadOutlined,
  SendOutlined, ClockCircleOutlined, CheckCircleOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const statusColorMap = {
  '待下达': 'default',
  '已下达': 'processing',
  '已关闭': 'success',
}

const statusOptions = [
  { label: '待下达', value: '待下达' },
  { label: '已下达', value: '已下达' },
  { label: '已关闭', value: '已关闭' },
]

export default function OrderManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [materials, setMaterials] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState(null)
  const [editing, setEditing] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 20, keyword: '', status: undefined })

  // 获取订单列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status) params.status = query.status
        const res = await api.get('/production/orders', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取订单列表失败')
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

  // 获取料品列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get('/basic/materials', { params: { page: 1, pageSize: 1000 } })
        if (cancelled) return
        setMaterials(res.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取料品列表失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const pendingCount = data.filter(o => o.status === '待下达').length
  const releasedCount = data.filter(o => o.status === '已下达').length
  const closedCount = data.filter(o => o.status === '已关闭').length

  const stats = [
    { label: '总订单数', value: total, icon: <FileTextOutlined />, color: '#2196F3' },
    { label: '待下达', value: pendingCount, icon: <ClockCircleOutlined />, color: '#9E9E9E' },
    { label: '已下达', value: releasedCount, icon: <SendOutlined />, color: '#FF9800' },
    { label: '已关闭', value: closedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const handleRelease = (r) => {
    Modal.confirm({
      title: '确认下发',
      content: '确认下发该订单？下发后将不可修改和删除',
      okText: '确认下发',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/orders/${r.order_id}/release`)
          message.success(res.message || `订单 ${r.order_no} 已下发`)
          refresh()
        } catch (err) {
          message.error(err.message || '下发失败')
        }
      },
    })
  }

  const handleClose = (r) => {
    Modal.confirm({
      title: '确认关闭',
      content: `确认关闭订单 ${r.order_no}？关闭后将不可恢复`,
      okText: '确认关闭',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/orders/${r.order_id}/close`)
          message.success(res.message || '订单已关闭')
          refresh()
        } catch (err) {
          message.error(err.message || '关闭失败')
        }
      },
    })
  }

  const handleDelete = (r) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除订单 ${r.order_no}？此操作不可恢复`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.delete(`/production/orders/${r.order_id}`)
          message.success(res.message || '订单已删除')
          refresh()
        } catch (err) {
          message.error(err.message || '删除失败')
        }
      },
    })
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setSelectedMaterial(null)
    setAddOpen(true)
  }

  const handleEdit = (r) => {
    setEditing(r)
    const m = materials.find(mat => mat.material_id === r.material_id)
    setSelectedMaterial(m || null)
    form.setFieldsValue({
      material_id: r.material_id,
      planned_qty: r.planned_qty,
      plan_start_time: r.plan_start_time ? dayjs(r.plan_start_time) : undefined,
      plan_end_time: r.plan_end_time ? dayjs(r.plan_end_time) : undefined,
    })
    setAddOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        material_id: values.material_id,
        planned_qty: values.planned_qty,
        plan_start_time: values.plan_start_time.format('YYYY-MM-DD'),
        plan_end_time: values.plan_end_time.format('YYYY-MM-DD'),
      }
      if (editing) {
        const res = await api.put(`/production/orders/${editing.order_id}`, payload)
        message.success(res.message || '订单已更新')
      } else {
        const res = await api.post('/production/orders', payload)
        message.success(res.message || '订单已创建')
      }
      setAddOpen(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleView = (r) => {
    setCurrentOrder(r)
    setDetailOpen(true)
  }

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined }))
  }

  const renderActions = (r) => {
    if (r.status === '待下达') {
      return (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleRelease(r)}>下发</Button>
          <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm
            title={`确认删除订单 ${r.order_no}？`}
            onConfirm={() => handleDelete(r)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
    if (r.status === '已下达') {
      return (
        <Space size={0}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>查看</Button>
          <Button type="link" size="small" danger onClick={() => handleClose(r)}>关闭</Button>
        </Space>
      )
    }
    return <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>查看</Button>
  }

  const columns = [
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 160, fixed: 'left' },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 120, fixed: 'left' },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 140, fixed: 'left' },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 100 },
    { title: '菲林编号', dataIndex: 'film_version', key: 'film_version', width: 130 },
    { title: '版本', dataIndex: 'version_no', key: 'version_no', width: 60 },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 100, align: 'right', render: v => {
        const val = v || 0
        return <span style={{ color: val > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>{val.toLocaleString()}</span>
      }
    },
    {
      title: '计划时间', key: 'plan_time', width: 160,
      render: (_, r) => <span style={{ fontSize: 12 }}>{r.plan_start_time ? String(r.plan_start_time).substring(0, 10) : '-'}<br />~ {r.plan_end_time ? String(r.plan_end_time).substring(0, 10) : '-'}</span>,
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 180, render: (_, r) => renderActions(r) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="生产订单"
        breadcrumbs="生产管理 / 生产订单"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="reload" icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>,
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增订单</Button>,
            ]}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }} align="middle">
              <Col flex="220px">
                <Input
                  placeholder="订单号搜索"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onPressEnter={handleSearch}
                />
              </Col>
              <Col flex="140px">
                <Select
                  placeholder="状态筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={statusOptions}
                  value={statusInput}
                  onChange={setStatusInput}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={data}
              rowKey="order_id"
              size="small"
              loading={loading}
              scroll={{ x: 1300 }}
              pagination={{
                current: query.page,
                pageSize: query.pageSize,
                total,
                showSizeChanger: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
              }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? '编辑订单' : '新增订单'}
        open={addOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Form.Item label="订单编号">
            <Input value={editing ? editing.order_no : '创建时由系统生成'} disabled />
          </Form.Item>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="料号" name="material_id" rules={[{ required: true, message: '请选择料号' }]}>
                <Select
                  placeholder="请输入或选择料号"
                  disabled={!!editing}
                  showSearch
                  allowClear
                  filterOption={(input, option) => {
                    const m = materials.find(mat => mat.material_id === option.value)
                    if (!m) return false
                    return m.material_code.toLowerCase().includes(input.toLowerCase()) ||
                      (m.material_name || '').includes(input)
                  }}
                  onChange={v => {
                    const m = materials.find(mat => mat.material_id === v)
                    setSelectedMaterial(m || null)
                  }}
                  options={materials.map(m => ({ label: `${m.material_code} | ${m.material_name} | ${m.specification}`, value: m.material_id }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="料品名称">
                <Input value={selectedMaterial?.material_name || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="规格">
                <Input value={selectedMaterial?.specification || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="菲林编号">
                <Input value={selectedMaterial?.film_version || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="版本号">
                <Input value={selectedMaterial?.version_no || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="计划数量" name="planned_qty" rules={[{ required: true, message: '请输入计划数量' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入计划数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="计划开始日期" name="plan_start_time" rules={[{ required: true, message: '请选择计划开始日期' }]}>
                <DatePicker
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  disabled={!!editing}
                  disabledDate={current => {
                    const today = dayjs().startOf('day')
                    const maxDate = today.add(15, 'day')
                    return current && (current < today || current > maxDate)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划完成日期" name="plan_end_time" rules={[{ required: true, message: '请选择计划完成日期' }]}>
                <DatePicker
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  disabled={!!editing}
                  disabledDate={current => {
                    const today = dayjs().startOf('day')
                    const maxDate = today.add(30, 'day')
                    const startVal = form.getFieldValue('plan_start_time')
                    const minDate = startVal ? dayjs(startVal).startOf('day') : today
                    return current && (current < minDate || current > maxDate)
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="订单详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width="40%"
      >
        {currentOrder && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="订单编号">{currentOrder.order_no}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[currentOrder.status]}>{currentOrder.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="料号">{currentOrder.material_code}</Descriptions.Item>
            <Descriptions.Item label="品名">{currentOrder.material_name}</Descriptions.Item>
            <Descriptions.Item label="规格">{currentOrder.specification}</Descriptions.Item>
            <Descriptions.Item label="菲林编号">{currentOrder.film_version}</Descriptions.Item>
            <Descriptions.Item label="菲林版本">{currentOrder.version_no}</Descriptions.Item>
            <Descriptions.Item label="计划数量">{(currentOrder.planned_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="完工数量">{(currentOrder.finished_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="计划开始">{currentOrder.plan_start_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="计划完成">{currentOrder.plan_end_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="下发时间">{currentOrder.release_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="关闭时间">{currentOrder.close_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建人">{currentOrder.created_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{currentOrder.created_at || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
